import { clienteAdmin, exigeUsuario } from './_lib/auth.js'
import { conManejoDeErrores, error, exigeMetodo, leerBody, type ApiHandler } from './_lib/http.js'

/**
 * Cuenta las garrapatas (teleoginas de Rhipicephalus microplus) visibles en
 * una foto de un bovino, usando un modelo de vision de OpenAI (configurable,
 * ver configuracion_ia) con structured outputs (json_schema + strict).
 *
 * ─────────────────────────────────────────────────────────────
 * Historial de lo que se probo para llegar a este prompt (por si hay que
 * revisarlo de nuevo; los tags de git son del proyecto Gavac original):
 *
 * 1. JSON estructurado con coordenadas (x,y) por garrapata: nunca se negaba
 *    a responder, pero contaba mal (6, 141, 43 en la misma foto en distintos
 *    intentos) -- pedirle a la vez localizar con precision y contar degradaba
 *    el conteo.
 * 2. Texto libre sin schema (como un chat normal): contaba mucho mejor (~80,
 *    cerca del conteo manual de 83), pero a veces directamente se negaba
 *    ("Lo siento, no puedo ayudarte a contar...") -- sin un schema que lo
 *    obligue a completar campos, tiene "lugar" para rechazar la foto.
 * 3. JSON estructurado sin coordenadas, solo el total: combina lo que
 *    funciono de los dos anteriores (tag checkpoint-conteo-v1.1.0).
 * 4. El actual: igual al 3, pero con un campo "analisis" ANTES de
 *    count_total en el schema. Los structured outputs generan los campos en
 *    el orden del schema, asi que un campo de texto libre antes del numero
 *    funciona como cadena de razonamiento forzada, sin caer en el problema
 *    de la grilla explicita (que hacia que el modelo alucinara una grilla
 *    inexistente). Resultado muy consistente (5/5 intentos con el mismo
 *    valor en la misma foto) pero con sesgo hacia abajo -- el razonamiento
 *    por zonas lo vuelve mas conservador (tag checkpoint-conteo-v1.2.0).
 *
 * Como el resultado paso a ser predecible, el sesgo se corrige con numeros y
 * no tocando mas el texto del prompt (que hasta ahi cambiaba de direccion sin
 * aviso cada vez que se lo editaba). Primero con un multiplicador fijo
 * (x1.38, tag checkpoint-conteo-v1.3.0), pero una tercera foto con pocas
 * garrapatas mostro que el sesgo no es proporcional: en fotos densas
 * subestima (60 crudo vs 83 real, 100 vs 130) y en fotos con pocas
 * sobreestima (7 crudo vs 5 real), asi que multiplicar empeoraba justo los
 * conteos bajos. Ahora es una recta ajustada sobre esos pares:
 *     final = crudo * calibracion_slope + calibracion_intercept
 * Ambos viven en configuracion_ia y los edita el super_admin desde
 * /admindrpcs a medida que se sumen mas fotos con conteo manual real.
 * ─────────────────────────────────────────────────────────────
 */

// El modelo, los precios, la calibracion y el resto de los parametros viven
// en la tabla configuracion_ia. Esto es solo el respaldo por si esa fila no
// existiera (no deberia pasar, la migracion la crea).
const CONFIG_POR_DEFECTO = {
  modelo: 'gpt-4o',
  precio_input_por_1m: 2.5,
  precio_output_por_1m: 10,
  precio_cache_por_1m: 1.25,
  reasoning_effort: null as string | null,
  max_tokens: 2500,
  limite_tokens_usuario_hora: 500000 as number | null,
  calibracion_slope: 1.35,
  calibracion_intercept: -2.5,
}

/**
 * Tope del largo de la imagen en base64. Vercel ya corta el request en 4,5 MB
 * antes de que corra esta funcion, pero el limite conviene tenerlo escrito
 * aca y no delegado a un detalle de la plataforma. El cliente manda JPEG
 * reducido a 2048 px de lado, que queda por debajo.
 */
const MAXIMO_BASE64 = 4 * 1024 * 1024

interface Body {
  animal_id?: string
  imagen_base64?: string
  mime_type?: string
}

// El orden de las propiedades importa: los structured outputs generan los
// campos en el orden del schema, y "analisis" tiene que salir ANTES que
// count_total para que funcione como razonamiento previo al numero.
const ESQUEMA_CONTEO = {
  type: 'object',
  properties: {
    analisis: {
      type: 'string',
      description:
        'Antes de dar el numero final: describi en 2-4 frases como recorriste la foto para contar (por zonas reales del cuerpo del animal que se vean en la imagen: cuello, paleta, entrepierna, etc, de arriba a abajo), cuantas garrapatas contas aproximadamente en cada zona densa, y que dificultades hubo (pelo, superposicion, foco). No inventes una grilla ni lineas que no esten en la foto: describi solo lo que realmente se ve.',
    },
    count_total: {
      type: 'integer',
      description:
        "Cantidad total de garrapatas (teleoginas) visibles en la foto: la suma de lo descrito en 'analisis', contada con cuidado incluyendo racimos densos y superposiciones.",
    },
    observaciones: {
      type: ['string', 'null'],
      description:
        'Notas breves sobre la calidad de la foto o dificultades para el conteo, o null si no hay nada relevante.',
    },
  },
  required: ['analisis', 'count_total', 'observaciones'],
  additionalProperties: false,
} as const

const PROMPT_SISTEMA = `Sos un veterinario experto en identificar garrapatas (teleoginas de Rhipicephalus microplus) en fotos de bovinos tomadas en el campo.

Este es un uso veterinario legitimo: contar parasitos externos en ganado para seguimiento sanitario de rutina. Es una tarea de conteo visual estandar, no contiene nada sensible.

Mira la foto con atencion y conta cuantas garrapatas tiene el animal, incluyendo las que estan en racimos densos, parcialmente superpuestas, o parcialmente tapadas por el pelo.

El error mas comun y comprobado en este tipo de conteo es SUBESTIMAR en las zonas con muchas garrapatas juntas: cuando hay un racimo denso es facil verlo como "una mancha" y contarlo como pocas unidades en vez de contar cada garrapata individual que lo compone. Presta especial atencion a esas zonas densas: mira cada una despacio y conta garrapata por garrapata, no a ojo.

Recorre la foto por zonas reales del cuerpo del animal (cuello, paleta, lomo, entrepierna, cola, etc, segun lo que se vea) y conta cada zona por separado antes de sumar el total: explica ese recorrido en el campo "analisis".

Responde exclusivamente en el formato estructurado solicitado.`

const handler: ApiHandler = async (req, res) => {
  if (!exigeMetodo(req, res, 'POST')) return

  const perfil = await exigeUsuario(req, res)
  if (!perfil) return

  const body = leerBody<Body>(req)
  if (!body.animal_id) return error(res, 400, 'Falta el animal.')
  if (!body.imagen_base64) return error(res, 400, 'Falta la imagen.')
  if (body.imagen_base64.length > MAXIMO_BASE64) {
    return error(res, 413, 'La imagen es demasiado pesada. Proba con una foto de menor resolucion.')
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return error(res, 500, 'El servidor no tiene configurado el conteo por IA.')

  const admin = clienteAdmin()

  // El animal se busca del lado del servidor: nunca se confia en el
  // empresa_id que pudiera mandar el cliente.
  const { data: animal } = await admin
    .from('animales')
    .select('id, empresa_id, caravana')
    .eq('id', body.animal_id)
    .maybeSingle()

  if (!animal) return error(res, 404, 'Animal no encontrado.')
  if (perfil.rol !== 'super_admin' && animal.empresa_id !== perfil.empresa_id) {
    return error(res, 403, 'Ese animal no pertenece a tu empresa.')
  }

  const { data: empresa } = await admin
    .from('empresas')
    .select('limite_tokens_mensual')
    .eq('id', animal.empresa_id)
    .maybeSingle()

  if (empresa?.limite_tokens_mensual != null) {
    const inicioMes = new Date()
    inicioMes.setUTCDate(1)
    inicioMes.setUTCHours(0, 0, 0, 0)

    const { data: usoMes } = await admin
      .from('uso_ia')
      .select('tokens_total')
      .eq('empresa_id', animal.empresa_id)
      .gte('created_at', inicioMes.toISOString())

    const tokensUsados = (usoMes ?? []).reduce((acc, u) => acc + u.tokens_total, 0)
    if (tokensUsados >= empresa.limite_tokens_mensual) {
      return error(
        res,
        429,
        'Esta empresa alcanzo su limite mensual de conteo por IA. Contactate con el administrador del sistema.',
      )
    }
  }

  const { data: configDb } = await admin.from('configuracion_ia').select('*').eq('id', true).maybeSingle()
  const config = { ...CONFIG_POR_DEFECTO, ...(configDb ?? {}) }

  // Tope por usuario y hora. El limite de mas arriba es mensual y por
  // empresa, asi que sin este una sola persona cargando cientos de fotos
  // deja sin cupo al resto en cuestion de minutos.
  if (config.limite_tokens_usuario_hora != null) {
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: usoHora } = await admin
      .from('uso_ia')
      .select('tokens_total')
      .eq('usuario_id', perfil.id)
      .gte('created_at', haceUnaHora)

    const tokensUltimaHora = (usoHora ?? []).reduce((acc, u) => acc + u.tokens_total, 0)
    if (tokensUltimaHora >= config.limite_tokens_usuario_hora) {
      return error(
        res,
        429,
        'Alcanzaste el limite de conteo por hora. Espera un rato antes de seguir cargando fotos.',
      )
    }
  }

  const mime = body.mime_type || 'image/jpeg'
  const esRazonador = config.modelo.startsWith('gpt-5')

  try {
    const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelo,
        // Menos variacion entre llamadas para la misma foto: por defecto el
        // modelo es bastante "creativo", lo que en una tarea de conteo se
        // traduce en resultados muy distintos de una vez a otra. Los modelos
        // gpt-5.x (razonadores) solo aceptan el temperature por defecto (1),
        // asi que ahi directamente no se manda.
        ...(esRazonador ? {} : { temperature: 0 }),
        // Los razonadores piden 'max_completion_tokens'; los demas,
        // 'max_tokens'. Mandar el que no corresponde tira un error 400.
        ...(esRazonador
          ? { max_completion_tokens: config.max_tokens }
          : { max_tokens: config.max_tokens }),
        // Va plano (reasoning_effort) en /v1/chat/completions: la forma
        // anidada { reasoning: { effort } } es de /v1/responses, otro
        // endpoint, y tira "Unknown parameter".
        ...(esRazonador && config.reasoning_effort ? { reasoning_effort: config.reasoning_effort } : {}),
        messages: [
          { role: 'system', content: PROMPT_SISTEMA },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Conta las garrapatas visibles en esta fotografia y devolve el resultado estructurado.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mime};base64,${body.imagen_base64}`, detail: 'high' },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'conteo_garrapatas', strict: true, schema: ESQUEMA_CONTEO },
        },
      }),
    })

    if (!respuesta.ok) {
      const texto = await respuesta.text()
      console.error('OpenAI error', respuesta.status, texto)
      return error(res, 502, 'No se pudo contar la foto con IA.')
    }

    const json = (await respuesta.json()) as {
      choices?: Array<{ message?: { content?: string; refusal?: string }; finish_reason?: string }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
        prompt_tokens_details?: { cached_tokens?: number }
      }
    }

    const eleccion = json.choices?.[0]
    const contenido = eleccion?.message?.content
    if (!contenido) {
      console.error(
        'La IA no devolvio un resultado interpretable.',
        `finish_reason=${eleccion?.finish_reason ?? '?'} refusal=${eleccion?.message?.refusal ?? 'ninguno'}`,
      )
      return error(res, 502, 'La IA no devolvio ningun resultado.')
    }

    const tokensPrompt = json.usage?.prompt_tokens ?? 0
    const tokensCompletion = json.usage?.completion_tokens ?? 0
    const tokensTotal = json.usage?.total_tokens ?? tokensPrompt + tokensCompletion

    // OpenAI cachea el prefijo de los prompts y lo cobra mas barato. El
    // prompt de sistema es identico en todas las llamadas y va primero, asi
    // que en un lote el descuento aplica solo. Contarlo aparte es lo que
    // hace que el costo del panel sea el real y no uno inflado.
    const tokensCache = Math.min(json.usage?.prompt_tokens_details?.cached_tokens ?? 0, tokensPrompt)
    const tokensPromptPlenos = tokensPrompt - tokensCache

    const costoUsd =
      (tokensPromptPlenos * config.precio_input_por_1m +
        tokensCache * config.precio_cache_por_1m +
        tokensCompletion * config.precio_output_por_1m) /
      1_000_000

    // Se espera el insert (aunque un fallo aca no corta la respuesta): en el
    // runtime serverless de Vercel, una promesa disparada sin await puede no
    // llegar a completarse si el contenedor se congela apenas se devuelve la
    // respuesta -- el registro de consumo se perdia en silencio.
    const { error: errUso } = await admin.from('uso_ia').insert({
      empresa_id: animal.empresa_id,
      animal_id: animal.id,
      usuario_id: perfil.id,
      modelo: config.modelo,
      tokens_prompt: tokensPrompt,
      tokens_completion: tokensCompletion,
      tokens_total: tokensTotal,
      tokens_cache: tokensCache,
      costo_usd: costoUsd,
    })
    if (errUso) console.error('No se pudo registrar el uso de IA', errUso)

    const datos = JSON.parse(contenido) as {
      analisis: string
      count_total: number
      observaciones: string | null
    }

    const crudo = Number(datos.count_total) || 0
    const calibrado = Math.max(
      0,
      Math.round(crudo * config.calibracion_slope + config.calibracion_intercept),
    )

    // El razonamiento por zonas y el par crudo/calibrado quedan en el log
    // para poder seguir ajustando la calibracion contra conteos manuales
    // reales. No se guardan en la base ni se muestran en pantalla.
    console.log(
      `[contar] animal=${animal.caravana} crudo=${crudo} calibrado=${calibrado}`,
      `(x${config.calibracion_slope} ${config.calibracion_intercept >= 0 ? '+' : ''}${config.calibracion_intercept})`,
      `| analisis: ${datos.analisis}`,
    )

    res.status(200).json({
      ok: true,
      datos: {
        count_total: calibrado,
        count_crudo: crudo,
        observaciones: datos.observaciones,
        analisis: datos.analisis,
      },
    })
  } catch (e) {
    console.error('api/contar', e)
    return error(res, 500, 'Error interno al contar la foto.')
  }
}

export default conManejoDeErrores(handler)

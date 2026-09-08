// La extension .js es necesaria: este archivo tambien lo importa
// api/cron/vacunaciones.ts, y ahi corre bajo Node ESM nativo (sin bundler
// de por medio) que exige la extension explicita en imports relativos. Vite
// resuelve igual este mismo specifier contra format.ts sin problema.
import { hoyISO } from './format.js'

/**
 * Cronograma de vacunacion antigarrapata.
 *
 *   1ra dosis  →  dia 0
 *   2da dosis  →  `diasSegundaDosis` despues de la 1ra
 *   3ra dosis  →  `diasRefuerzo` despues de la 1ra
 *   siguientes →  cada `diasRefuerzo`
 *
 * Con los valores por defecto, contado desde la primera: 0, 30, 180, 360...
 * El prospecto de Gavac indica la 2da a la semana 4 (28 dias) y refuerzos
 * cada 6 meses, pero los numeros los fija cada empresa: son una decision
 * sanitaria, no una constante del sistema.
 *
 * Nada de esto se guarda en la base: se calcula a partir de las dosis
 * efectivamente aplicadas. Guardar las fechas previstas obligaria a
 * reescribir filas cada vez que una dosis se aplica fuera de termino, y la
 * fila que quedara sin actualizar mostraria una fecha mentirosa.
 */

export type ModoCronograma = 'reajustar' | 'anclar'

export interface PlanVacunacion {
  /** Que hacer con las dosis siguientes cuando una se aplica fuera de termino. */
  modo: ModoCronograma
  diasSegundaDosis: number
  diasRefuerzo: number
  /** Dias de anticipacion con los que una dosis empieza a avisar. */
  diasAviso: number
}

export const PLAN_POR_DEFECTO: PlanVacunacion = {
  modo: 'reajustar',
  diasSegundaDosis: 30,
  diasRefuerzo: 180,
  diasAviso: 15,
}

/** Lee el plan de la empresa, cayendo a los valores por defecto. */
export function planDeEmpresa(empresa: {
  modo_cronograma_vacunacion?: ModoCronograma | null
  dias_segunda_dosis?: number | null
  dias_refuerzo?: number | null
  dias_aviso_vacunacion?: number | null
} | null | undefined): PlanVacunacion {
  if (!empresa) return PLAN_POR_DEFECTO
  return {
    modo: empresa.modo_cronograma_vacunacion ?? PLAN_POR_DEFECTO.modo,
    diasSegundaDosis: empresa.dias_segunda_dosis ?? PLAN_POR_DEFECTO.diasSegundaDosis,
    diasRefuerzo: empresa.dias_refuerzo ?? PLAN_POR_DEFECTO.diasRefuerzo,
    diasAviso: empresa.dias_aviso_vacunacion ?? PLAN_POR_DEFECTO.diasAviso,
  }
}

/** Dias desde la 1ra dosis a los que corresponde cada dosis. */
export function diasDesdePrimera(dosis: number, plan: PlanVacunacion = PLAN_POR_DEFECTO): number {
  if (dosis <= 1) return 0
  if (dosis === 2) return plan.diasSegundaDosis
  return plan.diasRefuerzo * (dosis - 2)
}

/** Dias que separan una dosis de la siguiente, segun el plan. */
export function intervaloHastaSiguiente(
  dosis: number,
  plan: PlanVacunacion = PLAN_POR_DEFECTO,
): number {
  return diasDesdePrimera(dosis + 1, plan) - diasDesdePrimera(dosis, plan)
}

export const MODOS_CRONOGRAMA: { value: ModoCronograma; label: string; descripcion: string }[] = [
  {
    value: 'reajustar',
    label: 'Reajustar desde la fecha real',
    descripcion:
      'Si una dosis se aplica tarde, las siguientes se corren para respetar el intervalo entre dosis.',
  },
  {
    value: 'anclar',
    label: 'Anclar al plan original',
    descripcion:
      'Las fechas se cuentan siempre desde la primera dosis, aunque alguna se haya aplicado tarde.',
  },
]

export type EstadoVacunacion = 'sin_iniciar' | 'al_dia' | 'por_vencer' | 'vencida'

export const ESTADO_LABEL: Record<EstadoVacunacion, string> = {
  sin_iniciar: 'Sin iniciar',
  al_dia: 'Al día',
  por_vencer: 'Por vencer',
  vencida: 'Vencida',
}

export interface DosisAplicada {
  numero_dosis: number
  fecha_aplicada: string
}

export interface Cronograma {
  /** Numero de la ultima dosis aplicada; 0 si todavia no se vacuno. */
  ultimaDosis: number
  ultimaFecha: string | null
  /** Dosis que toca aplicar. Siempre hay una siguiente. */
  proximaDosis: number
  /** null cuando no se aplico ninguna dosis: no hay desde donde contar. */
  proximaFecha: string | null
  estado: EstadoVacunacion
  /** Negativo si ya vencio. null si no hay fecha calculable. */
  diasRestantes: number | null
}

/** Suma dias a una fecha 'YYYY-MM-DD'. En UTC, para que no la corra el huso. */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  f.setUTCDate(f.getUTCDate() + dias)
  return f.toISOString().slice(0, 10)
}

/** Dias enteros entre dos fechas 'YYYY-MM-DD' (b - a). */
export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/**
 * Calcula en que anda un animal a partir de las dosis que tiene aplicadas.
 *
 * Tolera huecos (que se haya cargado la 3ra sin la 2da) y desorden: se toma
 * como referencia la dosis de numero mas alto, que es la que manda para
 * saber que sigue.
 */
export function calcularCronograma(
  dosis: DosisAplicada[],
  plan: PlanVacunacion = PLAN_POR_DEFECTO,
  hoy: string = hoyISO(),
): Cronograma {
  if (dosis.length === 0) {
    return {
      ultimaDosis: 0,
      ultimaFecha: null,
      proximaDosis: 1,
      proximaFecha: null,
      estado: 'sin_iniciar',
      diasRestantes: null,
    }
  }

  const ordenadas = [...dosis].sort((x, y) => x.numero_dosis - y.numero_dosis)
  const ultima = ordenadas[ordenadas.length - 1]
  const primera = ordenadas.find((d) => d.numero_dosis === 1)
  const proximaDosis = ultima.numero_dosis + 1

  // El modo 'anclar' necesita la 1ra dosis para tener desde donde contar.
  // Si no esta cargada (se empezo a registrar por la mitad), se cae a
  // 'reajustar', que solo necesita la anterior.
  const proximaFecha =
    plan.modo === 'anclar' && primera
      ? sumarDias(primera.fecha_aplicada, diasDesdePrimera(proximaDosis, plan))
      : sumarDias(ultima.fecha_aplicada, intervaloHastaSiguiente(ultima.numero_dosis, plan))

  const diasRestantes = diasEntre(hoy, proximaFecha)

  return {
    ultimaDosis: ultima.numero_dosis,
    ultimaFecha: ultima.fecha_aplicada,
    proximaDosis,
    proximaFecha,
    estado:
      diasRestantes < 0 ? 'vencida' : diasRestantes <= plan.diasAviso ? 'por_vencer' : 'al_dia',
    diasRestantes,
  }
}

/** Texto corto para mostrar al lado de la fecha. */
export function textoRestante(c: Cronograma): string {
  if (c.diasRestantes === null) return 'Sin primera dosis'
  const d = c.diasRestantes
  if (d < 0) return `Vencida hace ${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'}`
  if (d === 0) return 'Vence hoy'
  return `En ${d} ${d === 1 ? 'día' : 'días'}`
}

/** Orden para el panel: primero lo mas urgente. */
export function ordenUrgencia(c: Cronograma): number {
  if (c.estado === 'sin_iniciar') return Number.MAX_SAFE_INTEGER - 1
  return c.diasRestantes ?? Number.MAX_SAFE_INTEGER
}

import webpush from 'web-push'
import { calcularCronograma, ordenUrgencia, planDeEmpresa } from '../../src/lib/vacunacion.js'
import { clienteAdmin } from '../_lib/auth.js'
import { conManejoDeErrores, error, type ApiHandler } from '../_lib/http.js'

/**
 * Corre una vez al dia (ver el cron en vercel.json) y manda una notificacion
 * push por empresa con un resumen de vacunaciones vencidas o por vencer.
 *
 * No hay un usuario logueado disparando esto -- lo llama el propio Vercel --
 * asi que la autenticacion es distinta a la del resto de /api: en vez de un
 * JWT de Supabase, se exige el `CRON_SECRET` que Vercel manda solo en sus
 * propias invocaciones programadas (ver vercel.json → crons).
 */

interface FilaAnimal {
  id: string
  empresa_id: string
}

interface FilaVacunacion {
  animal_id: string
  numero_dosis: number
  fecha_aplicada: string
}

interface FilaEmpresa {
  id: string
  nombre: string
  modo_cronograma_vacunacion: 'reajustar' | 'anclar'
  dias_segunda_dosis: number
  dias_refuerzo: number
  dias_aviso_vacunacion: number
}

interface FilaSuscripcion {
  id: string
  empresa_id: string
  usuario_id: string
  endpoint: string
  p256dh: string
  auth: string
}

function autorizado(req: Parameters<ApiHandler>[0]): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const cabecera = req.headers.authorization
  const valor = Array.isArray(cabecera) ? cabecera[0] : cabecera
  return valor === `Bearer ${secreto}`
}

const handler: ApiHandler = async (req, res) => {
  if (!autorizado(req)) return error(res, 401, 'No autorizado.')

  const publica = process.env.VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publica || !privada || !subject) {
    return error(res, 500, 'Faltan las claves VAPID en el servidor.')
  }
  webpush.setVapidDetails(subject, publica, privada)

  const admin = clienteAdmin()

  const [{ data: empresas }, { data: animales }, { data: vacunas }, { data: usuarios }, { data: suscripciones }] =
    await Promise.all([
      admin
        .from('empresas')
        .select(
          'id, nombre, modo_cronograma_vacunacion, dias_segunda_dosis, dias_refuerzo, dias_aviso_vacunacion',
        )
        .eq('activo', true),
      admin.from('animales').select('id, empresa_id').eq('activo', true),
      admin.from('vacunaciones').select('animal_id, numero_dosis, fecha_aplicada'),
      admin.from('usuarios').select('id, activo').eq('activo', true),
      admin.from('push_subscripciones').select('id, empresa_id, usuario_id, endpoint, p256dh, auth'),
    ])

  const usuariosActivos = new Set(((usuarios as { id: string }[]) ?? []).map((u) => u.id))
  const animalesPorEmpresa = new Map<string, FilaAnimal[]>()
  for (const a of (animales as FilaAnimal[]) ?? []) {
    const previos = animalesPorEmpresa.get(a.empresa_id) ?? []
    previos.push(a)
    animalesPorEmpresa.set(a.empresa_id, previos)
  }

  const dosisPorAnimal = new Map<string, { numero_dosis: number; fecha_aplicada: string }[]>()
  for (const v of (vacunas as FilaVacunacion[]) ?? []) {
    const previas = dosisPorAnimal.get(v.animal_id) ?? []
    previas.push({ numero_dosis: v.numero_dosis, fecha_aplicada: v.fecha_aplicada })
    dosisPorAnimal.set(v.animal_id, previas)
  }

  // Suscripciones vivas, agrupadas por empresa. Se filtran los usuarios ya
  // desactivados: si alguien perdio el acceso, tambien deja de recibir avisos.
  const suscripcionesPorEmpresa = new Map<string, FilaSuscripcion[]>()
  for (const s of (suscripciones as FilaSuscripcion[]) ?? []) {
    if (!usuariosActivos.has(s.usuario_id)) continue
    const previas = suscripcionesPorEmpresa.get(s.empresa_id) ?? []
    previas.push(s)
    suscripcionesPorEmpresa.set(s.empresa_id, previas)
  }

  let empresasNotificadas = 0
  let notificacionesEnviadas = 0
  const endpointsMuertos: string[] = []

  for (const empresa of (empresas as FilaEmpresa[]) ?? []) {
    const suscriptores = suscripcionesPorEmpresa.get(empresa.id) ?? []
    if (suscriptores.length === 0) continue

    const plan = planDeEmpresa(empresa)
    const cronogramas = (animalesPorEmpresa.get(empresa.id) ?? [])
      .map((a) => calcularCronograma(dosisPorAnimal.get(a.id) ?? [], plan))
      .sort((x, y) => ordenUrgencia(x) - ordenUrgencia(y))

    const vencidas = cronogramas.filter((c) => c.estado === 'vencida').length
    const porVencer = cronogramas.filter((c) => c.estado === 'por_vencer').length
    if (vencidas === 0 && porVencer === 0) continue

    const partes: string[] = []
    if (vencidas > 0) partes.push(`${vencidas} ${vencidas === 1 ? 'vencida' : 'vencidas'}`)
    if (porVencer > 0) partes.push(`${porVencer} por vencer`)

    const payload = JSON.stringify({
      titulo: 'Vacunaciones pendientes',
      cuerpo: `${empresa.nombre}: ${partes.join(' · ')}.`,
      url: '/vacunaciones',
    })

    empresasNotificadas++

    for (const s of suscriptores) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        notificacionesEnviadas++
      } catch (e) {
        // 404/410: el navegador ya no reconoce esa suscripcion (se
        // desinstalo la app, se borraron datos del sitio, etc). Se limpia
        // para no reintentar en vano cada dia.
        const codigo = (e as { statusCode?: number }).statusCode
        if (codigo === 404 || codigo === 410) endpointsMuertos.push(s.endpoint)
      }
    }
  }

  if (endpointsMuertos.length > 0) {
    await admin.from('push_subscripciones').delete().in('endpoint', endpointsMuertos)
  }

  res.status(200).json({
    empresasNotificadas,
    notificacionesEnviadas,
    suscripcionesEliminadas: endpointsMuertos.length,
  })
}

export default conManejoDeErrores(handler)

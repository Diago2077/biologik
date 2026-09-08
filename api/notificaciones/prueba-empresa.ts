import webpush from 'web-push'
import { clienteAdmin, exigeSuperAdmin } from '../_lib/auth.js'
import { conManejoDeErrores, error, exigeMetodo, leerBody, type ApiHandler } from '../_lib/http.js'

/**
 * Manda una notificacion de prueba a TODOS los dispositivos suscriptos de
 * UNA empresa. Es la herramienta del super_admin para confirmar que las
 * claves VAPID estan bien cargadas y que a los usuarios de esa empresa les
 * llega de verdad, sin tener que loguearse como ellos ni esperar a que haya
 * una vacunacion vencida real.
 */

interface Body {
  empresa_id?: string
}

interface FilaSuscripcion {
  endpoint: string
  p256dh: string
  auth: string
}

const handler: ApiHandler = async (req, res) => {
  if (!exigeMetodo(req, res, 'POST')) return

  const actor = await exigeSuperAdmin(req, res)
  if (!actor) return

  const body = leerBody<Body>(req)
  if (!body.empresa_id) return error(res, 400, 'Falta la empresa.')

  const publica = process.env.VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publica || !privada || !subject) {
    return error(res, 500, 'Faltan las claves VAPID en el servidor.')
  }
  webpush.setVapidDetails(subject, publica, privada)

  const admin = clienteAdmin()
  const { data: suscripciones } = await admin
    .from('push_subscripciones')
    .select('endpoint, p256dh, auth')
    .eq('empresa_id', body.empresa_id)

  const filas = (suscripciones as FilaSuscripcion[]) ?? []
  if (filas.length === 0) {
    return error(res, 400, 'Esta empresa todavía no tiene ningún dispositivo con notificaciones activadas.')
  }

  const payload = JSON.stringify({
    titulo: 'Notificación de prueba',
    cuerpo: 'Si ves esto, las notificaciones push están funcionando.',
    url: '/',
  })

  let enviadas = 0
  const endpointsMuertos: string[] = []

  for (const s of filas) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      enviadas++
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode
      if (codigo === 404 || codigo === 410) endpointsMuertos.push(s.endpoint)
    }
  }

  if (endpointsMuertos.length > 0) {
    await admin.from('push_subscripciones').delete().in('endpoint', endpointsMuertos)
  }

  if (enviadas === 0) {
    return error(res, 500, 'No se pudo entregar la notificación a ningún dispositivo.')
  }

  res.status(200).json({ enviadas })
}

export default conManejoDeErrores(handler)

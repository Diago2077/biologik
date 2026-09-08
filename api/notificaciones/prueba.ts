import webpush from 'web-push'
import { clienteAdmin, exigeUsuario } from '../_lib/auth.js'
import { conManejoDeErrores, error, exigeMetodo, type ApiHandler } from '../_lib/http.js'

/**
 * Manda una notificacion de prueba a TODAS las suscripciones (dispositivos)
 * del usuario que la pide. Sirve para confirmar que las claves VAPID estan
 * bien cargadas en Vercel sin tener que esperar al cron diario ni fabricar
 * una vacunacion vencida de mentira.
 */

interface FilaSuscripcion {
  endpoint: string
  p256dh: string
  auth: string
}

const handler: ApiHandler = async (req, res) => {
  if (!exigeMetodo(req, res, 'POST')) return

  const perfil = await exigeUsuario(req, res)
  if (!perfil) return

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
    .eq('usuario_id', perfil.id)

  const filas = (suscripciones as FilaSuscripcion[]) ?? []
  if (filas.length === 0) {
    return error(res, 400, 'Este dispositivo no tiene notificaciones activadas.')
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

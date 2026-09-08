import { supabase } from './supabase'

/**
 * Notificaciones push del navegador.
 *
 * La suscripcion es POR DISPOSITIVO, no por usuario: activarla en el celular
 * no la activa en la PC. Cada suscripcion se guarda en `push_subscripciones`
 * con el endpoint que el propio navegador entrega, y el envio real lo hace
 * el cron del servidor (api/cron/vacunaciones.ts) con la clave privada VAPID.
 *
 * En iOS, Safari solo entrega PushManager si la app esta instalada a la
 * pantalla de inicio (modo standalone) -- abierta en una pestana normal,
 * `soportaPush()` da false.
 */

export function soportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** El navegador convierte la clave VAPID a este formato para `subscribe`. */
function base64UrlAUint8Array(base64Url: string): Uint8Array {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(base64)
  return Uint8Array.from(binario, (c) => c.charCodeAt(0))
}

/** Suscripcion activa en ESTE dispositivo, si existe. */
export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!soportaPush()) return null
  const registro = await navigator.serviceWorker.ready
  return registro.pushManager.getSubscription()
}

/**
 * Pide permiso, suscribe el dispositivo y guarda el endpoint en la base.
 * `upsert` por endpoint: si el usuario ya se habia suscrito antes con este
 * mismo dispositivo, actualiza en vez de duplicar.
 */
export async function activarNotificaciones(
  usuarioId: string,
  empresaId: string,
): Promise<{ error: string | null }> {
  if (!soportaPush()) {
    return { error: 'Este navegador no admite notificaciones push.' }
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    return { error: 'Las notificaciones todavía no están configuradas.' }
  }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    return { error: 'Permiso de notificaciones denegado.' }
  }

  const registro = await navigator.serviceWorker.ready
  let suscripcion = await registro.pushManager.getSubscription()
  if (!suscripcion) {
    suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      // TS tipa applicationServerKey contra ArrayBuffer puro, pero
      // Uint8Array.buffer es ArrayBufferLike (incluye SharedArrayBuffer):
      // el cast es inofensivo, esto nunca corre sobre un SharedArrayBuffer.
      applicationServerKey: base64UrlAUint8Array(vapidKey) as BufferSource,
    })
  }

  const json = suscripcion.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    return { error: 'El navegador no devolvió una suscripción válida.' }
  }

  const { error } = await supabase.from('push_subscripciones').upsert(
    {
      usuario_id: usuarioId,
      empresa_id: empresaId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  return { error: error ? 'No se pudo guardar la suscripción.' : null }
}

/** Cancela la suscripcion de este dispositivo, en el navegador y en la base. */
export async function desactivarNotificaciones(): Promise<{ error: string | null }> {
  const suscripcion = await suscripcionActual()
  if (!suscripcion) return { error: null }

  const endpoint = suscripcion.endpoint
  await suscripcion.unsubscribe()

  const { error } = await supabase.from('push_subscripciones').delete().eq('endpoint', endpoint)
  return { error: error ? 'No se pudo dar de baja la suscripción.' : null }
}

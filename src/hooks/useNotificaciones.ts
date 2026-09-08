import { useCallback, useEffect, useState } from 'react'
import { activarNotificaciones, desactivarNotificaciones, soportaPush, suscripcionActual } from '@/lib/notificaciones'
import { useAuth } from './useAuth'

/** Estado de la suscripción a notificaciones push de ESTE dispositivo. */
export function useNotificaciones() {
  const { perfil, empresa } = useAuth()
  const [suscripto, setSuscripto] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const sub = await suscripcionActual()

      // El navegador (sobre todo Android/Chrome vía FCM) de tanto en tanto
      // rota el token de push por su cuenta -- el permiso sigue en
      // "granted" pero la suscripcion vieja quedo invalida. Sin esto, la
      // campanita se ve "apagada" hasta que el usuario la toca nuevamente:
      // si ya habia permiso concedido, no hace falta pedirselo de nuevo, asi
      // que se re-suscribe sola sin que se note.
      if (
        !sub &&
        soportaPush() &&
        Notification.permission === 'granted' &&
        perfil &&
        empresa
      ) {
        await activarNotificaciones(perfil.id, empresa.id)
        if (!cancelado) {
          setSuscripto(true)
          setCargando(false)
        }
        return
      }

      if (!cancelado) {
        setSuscripto(sub !== null)
        setCargando(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [perfil, empresa])

  const alternar = useCallback(async (): Promise<{ error: string | null }> => {
    if (!perfil || !empresa) return { error: 'Tu usuario no tiene una empresa asignada.' }

    setCargando(true)
    if (suscripto) {
      const { error } = await desactivarNotificaciones()
      setCargando(false)
      if (!error) setSuscripto(false)
      return { error }
    }

    const { error } = await activarNotificaciones(perfil.id, empresa.id)
    setCargando(false)
    if (!error) setSuscripto(true)
    return { error }
  }, [perfil, empresa, suscripto])

  return { soportado: soportaPush(), suscripto, cargando, alternar }
}

import { useCallback, useEffect, useState } from 'react'
import {
  activarNotificaciones,
  desactivarNotificaciones,
  enviarNotificacionDePrueba,
  soportaPush,
  suscripcionActual,
} from '@/lib/notificaciones'
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
      if (!cancelado) {
        setSuscripto(sub !== null)
        setCargando(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

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

  return { soportado: soportaPush(), suscripto, cargando, alternar, enviarPrueba: enviarNotificacionDePrueba }
}

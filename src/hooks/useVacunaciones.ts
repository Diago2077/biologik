import { useCallback, useEffect, useState } from 'react'
import type { Vacunacion } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

interface Estado {
  data: Vacunacion[]
  loading: boolean
  error: string | null
}

/** Dosis aplicadas a un animal, de la mas nueva a la mas vieja. */
export function useVacunaciones(animalId: string | undefined) {
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const cargar = useCallback(async (): Promise<Estado> => {
    if (!animalId) return { data: [], loading: false, error: null }

    const { data, error } = await supabase
      .from('vacunaciones')
      .select('*')
      .eq('animal_id', animalId)
      .order('numero_dosis', { ascending: false })

    return {
      data: (data as Vacunacion[]) ?? [],
      loading: false,
      error: error ? 'No se pudieron cargar las vacunaciones.' : null,
    }
  }, [animalId])

  const refetch = useCallback(async () => {
    setEstado((s) => ({ ...s, loading: true, error: null }))
    setEstado(await cargar())
  }, [cargar])

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      setEstado((s) => ({ ...s, loading: true }))
      const resultado = await cargar()
      if (!cancelado) setEstado(resultado)
    })()
    return () => {
      cancelado = true
    }
  }, [cargar])

  async function eliminar(id: string) {
    const { error } = await supabase.from('vacunaciones').delete().eq('id', id)
    if (error) return { error: 'No se pudo eliminar la dosis.' }
    setEstado((s) => ({ ...s, data: s.data.filter((v) => v.id !== id) }))
    return { error: null }
  }

  return { ...estado, refetch, eliminar }
}

export interface AltaMasiva {
  animalIds: string[]
  numeroDosis: number
  fechaAplicada: string
  producto: string
  lote: string
  observaciones: string
}

/**
 * Registrar una vacunacion de a un animal por vez no es realista: se vacuna
 * un lote entero en una jornada. Esto inserta una fila por animal en una
 * sola operacion.
 */
export function useVacunacionMasiva() {
  const { perfil, empresa } = useAuth()
  const [guardando, setGuardando] = useState(false)

  async function aplicar(alta: AltaMasiva): Promise<{ error: string | null; aplicadas: number }> {
    if (!empresa) return { error: 'Tu usuario no tiene una empresa asignada.', aplicadas: 0 }
    if (alta.animalIds.length === 0) return { error: 'Elegí al menos un animal.', aplicadas: 0 }
    if (!alta.fechaAplicada) return { error: 'Falta la fecha de aplicación.', aplicadas: 0 }

    setGuardando(true)
    const filas = alta.animalIds.map((animal_id) => ({
      empresa_id: empresa.id,
      animal_id,
      numero_dosis: alta.numeroDosis,
      fecha_aplicada: alta.fechaAplicada,
      producto: alta.producto.trim() || null,
      lote: alta.lote.trim() || null,
      observaciones: alta.observaciones.trim() || null,
      created_by: perfil?.id ?? null,
    }))

    // upsert y no insert: si se re-carga una jornada (porque se agrego un
    // animal que faltaba), los que ya tenian esa dosis se actualizan en vez
    // de romper todo el lote contra el unique (animal_id, numero_dosis).
    const { error } = await supabase
      .from('vacunaciones')
      .upsert(filas, { onConflict: 'animal_id,numero_dosis' })
    setGuardando(false)

    if (error) return { error: 'No se pudo registrar la vacunación.', aplicadas: 0 }
    return { error: null, aplicadas: filas.length }
  }

  return { aplicar, guardando }
}

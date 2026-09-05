import { useCallback, useEffect, useState } from 'react'
import type { Animal, Finca } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import {
  calcularCronograma,
  ordenUrgencia,
  type Cronograma,
  type DosisAplicada,
  type ModoCronograma,
} from '@/lib/vacunacion'
import { useAuth } from './useAuth'

export interface PendienteVacunacion {
  animal: Animal
  finca: Finca | null
  cronograma: Cronograma
}

interface Estado {
  data: PendienteVacunacion[]
  loading: boolean
  error: string | null
}

/**
 * Todos los animales de la empresa con su cronograma, ordenados por
 * urgencia. Es lo que alimenta el panel de alertas.
 *
 * Se traen las tres tablas enteras y se cruzan en memoria en vez de hacer
 * una consulta con joins: el cronograma no es una columna, se calcula, asi
 * que Postgres no podria ordenar por el sin una vista que duplique la
 * logica de fechas que ya vive (y esta testeada) en src/lib/vacunacion.ts.
 */
export function useVacunacionesPendientes() {
  const { empresa } = useAuth()
  const modo: ModoCronograma = empresa?.modo_cronograma_vacunacion ?? 'reajustar'
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const cargar = useCallback(async (): Promise<Estado> => {
    const [{ data: animales, error }, { data: fincas }, { data: vacunas }] = await Promise.all([
      supabase.from('animales').select('*').eq('activo', true).order('caravana'),
      supabase.from('fincas').select('*'),
      supabase.from('vacunaciones').select('animal_id, numero_dosis, fecha_aplicada'),
    ])

    if (error) return { data: [], loading: false, error: 'No se pudieron cargar las vacunaciones.' }

    const porFinca = new Map((fincas as Finca[] ?? []).map((f) => [f.id, f]))

    const dosisPorAnimal = new Map<string, DosisAplicada[]>()
    for (const v of (vacunas as (DosisAplicada & { animal_id: string })[]) ?? []) {
      const previas = dosisPorAnimal.get(v.animal_id) ?? []
      previas.push({ numero_dosis: v.numero_dosis, fecha_aplicada: v.fecha_aplicada })
      dosisPorAnimal.set(v.animal_id, previas)
    }

    const data = ((animales as Animal[]) ?? [])
      .map((animal) => ({
        animal,
        finca: porFinca.get(animal.finca_id) ?? null,
        cronograma: calcularCronograma(dosisPorAnimal.get(animal.id) ?? [], modo),
      }))
      .sort((a, b) => ordenUrgencia(a.cronograma) - ordenUrgencia(b.cronograma))

    return { data, loading: false, error: null }
  }, [modo])

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

  const vencidas = estado.data.filter((p) => p.cronograma.estado === 'vencida').length
  const porVencer = estado.data.filter((p) => p.cronograma.estado === 'por_vencer').length

  return { ...estado, refetch, vencidas, porVencer }
}

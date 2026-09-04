import { useCallback, useEffect, useState } from 'react'
import type { Animal, AnimalConTotal, AnimalInsert, AnimalUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: AnimalConTotal[]
  loading: boolean
  error: string | null
}

/**
 * Animales de una finca, con el total de garrapatas ya sumado.
 *
 * El resumen se arma en el cliente con una segunda consulta en vez de una
 * vista o un rpc: son dos selects planos que PostgREST cachea bien, y evita
 * tener que mantener una funcion en la base sincronizada con el esquema.
 */
export function useAnimales(fincaId: string | undefined) {
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const cargar = useCallback(async (): Promise<Estado> => {
    if (!fincaId) return { data: [], loading: false, error: null }

    const { data: animales, error } = await supabase
      .from('animales')
      .select('*')
      .eq('finca_id', fincaId)
      .order('caravana', { ascending: true })

    if (error) {
      return { data: [], loading: false, error: 'No se pudieron cargar los animales.' }
    }

    const lista = (animales as Animal[]) ?? []
    if (lista.length === 0) return { data: [], loading: false, error: null }

    const { data: conteos } = await supabase
      .from('conteos')
      .select('animal_id, count_total, fecha_conteo')
      .in(
        'animal_id',
        lista.map((a) => a.id),
      )

    const resumen = new Map<string, { total: number; cantidad: number; ultimo: string | null }>()
    for (const c of (conteos as { animal_id: string; count_total: number; fecha_conteo: string }[]) ?? []) {
      const actual = resumen.get(c.animal_id) ?? { total: 0, cantidad: 0, ultimo: null }
      resumen.set(c.animal_id, {
        total: actual.total + c.count_total,
        cantidad: actual.cantidad + 1,
        ultimo: !actual.ultimo || c.fecha_conteo > actual.ultimo ? c.fecha_conteo : actual.ultimo,
      })
    }

    return {
      data: lista.map((a) => {
        const r = resumen.get(a.id)
        return {
          ...a,
          total_garrapatas: r?.total ?? 0,
          cantidad_conteos: r?.cantidad ?? 0,
          ultimo_conteo: r?.ultimo ?? null,
        }
      }),
      loading: false,
      error: null,
    }
  }, [fincaId])

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

  async function crear(payload: AnimalInsert) {
    const { data, error } = await supabase.from('animales').insert(payload).select().single()
    return { data: data as Animal | null, error: mensajeError(error?.message) }
  }

  async function actualizar(id: string, payload: AnimalUpdate) {
    const { error } = await supabase.from('animales').update(payload).eq('id', id)
    return { error: mensajeError(error?.message) }
  }

  async function eliminar(id: string) {
    const { error } = await supabase.from('animales').delete().eq('id', id)
    return { error: error ? 'No se pudo eliminar el animal.' : null }
  }

  return { ...estado, refetch, crear, actualizar, eliminar }
}

/** Un solo animal, para su ficha. Trae tambien la finca a la que pertenece. */
export function useAnimal(id: string | undefined) {
  const [data, setData] = useState<Animal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      if (!id) {
        if (!cancelado) {
          setData(null)
          setLoading(false)
        }
        return
      }
      setLoading(true)
      const { data: fila } = await supabase.from('animales').select('*').eq('id', id).maybeSingle()
      if (cancelado) return
      setData((fila as Animal) ?? null)
      setLoading(false)
    })()
    return () => {
      cancelado = true
    }
  }, [id])

  return { data, loading }
}

/** El unique (finca_id, caravana) es el error que el usuario va a ver seguido. */
function mensajeError(mensaje: string | undefined): string | null {
  if (!mensaje) return null
  if (/duplicate key|unique/i.test(mensaje)) return 'Ya existe un animal con esa caravana en esta finca.'
  return 'No se pudo guardar el animal.'
}

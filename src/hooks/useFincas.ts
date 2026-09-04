import { useCallback, useEffect, useState } from 'react'
import type { Finca, FincaInsert, FincaUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: Finca[]
  loading: boolean
  error: string | null
}

/** La RLS ya limita el listado a la empresa del usuario: aca no se filtra a mano. */
export function useFincas() {
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const cargar = useCallback(async (): Promise<Estado> => {
    const { data, error } = await supabase
      .from('fincas')
      .select('*')
      .order('nombre', { ascending: true })

    return {
      data: (data as Finca[]) ?? [],
      loading: false,
      error: error ? 'No se pudieron cargar las fincas.' : null,
    }
  }, [])

  const refetch = useCallback(async () => {
    setEstado((s) => ({ ...s, loading: true, error: null }))
    setEstado(await cargar())
  }, [cargar])

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const resultado = await cargar()
      if (!cancelado) setEstado(resultado)
    })()
    return () => {
      cancelado = true
    }
  }, [cargar])

  async function crear(payload: FincaInsert) {
    const { data, error } = await supabase.from('fincas').insert(payload).select().single()
    return { data: data as Finca | null, error: mensajeError(error?.message) }
  }

  async function actualizar(id: string, payload: FincaUpdate) {
    const { error } = await supabase.from('fincas').update(payload).eq('id', id)
    return { error: mensajeError(error?.message) }
  }

  async function eliminar(id: string) {
    const { error } = await supabase.from('fincas').delete().eq('id', id)
    return { error: error ? 'No se pudo eliminar la finca.' : null }
  }

  return { ...estado, refetch, crear, actualizar, eliminar }
}

/** Una sola finca, para la ficha. */
export function useFinca(id: string | undefined) {
  const [data, setData] = useState<Finca | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!id) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data: fila } = await supabase.from('fincas').select('*').eq('id', id).maybeSingle()
    setData((fila as Finca) ?? null)
    setLoading(false)
  }, [id])

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
      const { data: fila } = await supabase.from('fincas').select('*').eq('id', id).maybeSingle()
      if (cancelado) return
      setData((fila as Finca) ?? null)
      setLoading(false)
    })()
    return () => {
      cancelado = true
    }
  }, [id])

  return { data, loading, refetch }
}

/** El unique (empresa_id, nombre) es el error que el usuario va a ver seguido. */
function mensajeError(mensaje: string | undefined): string | null {
  if (!mensaje) return null
  if (/duplicate key|unique/i.test(mensaje)) return 'Ya existe una finca con ese nombre.'
  return 'No se pudo guardar la finca.'
}

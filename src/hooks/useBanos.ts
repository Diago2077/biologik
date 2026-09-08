import { useCallback, useEffect, useState } from 'react'
import type { Bano } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

interface Estado {
  data: Bano[]
  loading: boolean
  error: string | null
}

export interface AltaBano {
  fecha: string
  producto: string
  observaciones: string
}

/** Baños acaricidas de una finca, del mas nuevo al mas viejo. */
export function useBanos(fincaId: string | undefined) {
  const { perfil, empresa } = useAuth()
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const cargar = useCallback(async (): Promise<Estado> => {
    if (!fincaId) return { data: [], loading: false, error: null }

    const { data, error } = await supabase
      .from('banos')
      .select('*')
      .eq('finca_id', fincaId)
      .order('fecha', { ascending: false })

    return {
      data: (data as Bano[]) ?? [],
      loading: false,
      error: error ? 'No se pudieron cargar los baños.' : null,
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

  async function crear(alta: AltaBano) {
    if (!fincaId) return { error: 'Falta la finca.' }
    if (!empresa) return { error: 'Tu usuario no tiene una empresa asignada.' }
    if (!alta.fecha) return { error: 'Falta la fecha del baño.' }

    const { error } = await supabase.from('banos').insert({
      empresa_id: empresa.id,
      finca_id: fincaId,
      fecha: alta.fecha,
      producto: alta.producto.trim() || null,
      observaciones: alta.observaciones.trim() || null,
      created_by: perfil?.id ?? null,
    })
    if (error) return { error: 'No se pudo registrar el baño.' }
    return { error: null }
  }

  async function eliminar(id: string) {
    const { error } = await supabase.from('banos').delete().eq('id', id)
    if (error) return { error: 'No se pudo eliminar el baño.' }
    setEstado((s) => ({ ...s, data: s.data.filter((b) => b.id !== id) }))
    return { error: null }
  }

  return { ...estado, refetch, crear, eliminar }
}

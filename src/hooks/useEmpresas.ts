import { useCallback, useEffect, useState } from 'react'
import type { Empresa, EmpresaInsert, EmpresaUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: Empresa[]
  loading: boolean
  error: string | null
}

/** Solo el super_admin puede ver mas de una fila aca (RLS). */
export function useEmpresas() {
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    setEstado((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .order('nombre', { ascending: true })

    setEstado({
      data: (data as Empresa[]) ?? [],
      loading: false,
      error: error ? 'No se pudieron cargar las empresas.' : null,
    })
  }, [])

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      setEstado((s) => ({ ...s, loading: true }))
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('nombre', { ascending: true })
      if (cancelado) return
      setEstado({
        data: (data as Empresa[]) ?? [],
        loading: false,
        error: error ? 'No se pudieron cargar las empresas.' : null,
      })
    })()
    return () => {
      cancelado = true
    }
  }, [])

  async function crear(payload: EmpresaInsert) {
    const { data, error } = await supabase.from('empresas').insert(payload).select().single()
    return { data: data as Empresa | null, error: error?.message ?? null }
  }

  async function actualizar(id: string, payload: EmpresaUpdate) {
    const { error } = await supabase.from('empresas').update(payload).eq('id', id)
    return { error: error?.message ?? null }
  }

  return { ...estado, refetch, crear, actualizar }
}

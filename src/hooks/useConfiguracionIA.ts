import { useCallback, useEffect, useState } from 'react'
import type { ConfiguracionIA, ConfiguracionIAUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: ConfiguracionIA | null
  loading: boolean
  error: string | null
}

/** Configuracion global del modelo de IA (fila unica), solo visible/editable por el super_admin (RLS). */
export function useConfiguracionIA() {
  const [estado, setEstado] = useState<Estado>({ data: null, loading: true, error: null })

  const refetch = useCallback(async () => {
    setEstado((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase.from('configuracion_ia').select('*').eq('id', true).maybeSingle()
    setEstado({
      data: (data as ConfiguracionIA) ?? null,
      loading: false,
      error: error ? 'No se pudo cargar la configuracion.' : null,
    })
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function actualizar(payload: ConfiguracionIAUpdate) {
    const { error } = await supabase.from('configuracion_ia').update(payload).eq('id', true)
    return { error: error?.message ?? null }
  }

  return { ...estado, refetch, actualizar }
}

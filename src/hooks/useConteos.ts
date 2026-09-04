import { useCallback, useEffect, useState } from 'react'
import type { Conteo, ConteoUpdate } from '@/lib/database.types'
import { eliminarFoto } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: Conteo[]
  loading: boolean
  error: string | null
}

/** Conteos de un animal, del mas reciente al mas viejo. */
export function useConteos(animalId: string | undefined) {
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const cargar = useCallback(async (): Promise<Estado> => {
    if (!animalId) return { data: [], loading: false, error: null }

    const { data, error } = await supabase
      .from('conteos')
      .select('*')
      .eq('animal_id', animalId)
      .order('fecha_conteo', { ascending: false })
      .order('created_at', { ascending: false })

    return {
      data: (data as Conteo[]) ?? [],
      loading: false,
      error: error ? 'No se pudieron cargar los conteos.' : null,
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

  async function actualizar(id: string, payload: ConteoUpdate) {
    const { error } = await supabase.from('conteos').update(payload).eq('id', id)
    if (error) return { error: 'No se pudo guardar el conteo.' }
    await refetch()
    return { error: null }
  }

  /**
   * Borra la fila y despues la foto. En ese orden a proposito: si fallara al
   * reves, quedaria una fila apuntando a un archivo inexistente. Un archivo
   * huerfano en Storage es menos grave que una foto que no se puede abrir.
   */
  async function eliminar(conteo: Conteo) {
    const { error } = await supabase.from('conteos').delete().eq('id', conteo.id)
    if (error) return { error: 'No se pudo eliminar el conteo.' }
    if (conteo.archivo_path) await eliminarFoto(conteo.archivo_path)
    setEstado((s) => ({ ...s, data: s.data.filter((c) => c.id !== conteo.id) }))
    return { error: null }
  }

  return { ...estado, refetch, actualizar, eliminar }
}

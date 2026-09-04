import { useCallback, useEffect, useState } from 'react'
import type { Usuario } from '@/lib/database.types'
import { apiFetch } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: Usuario[]
  loading: boolean
  error: string | null
}

/**
 * Lista usuarios. Sin `empresaId`, trae los que la RLS deje ver: todos si es
 * super_admin, solo los del propia empresa si no.
 */
export function useUsuarios(empresaId?: string) {
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    setEstado((s) => ({ ...s, loading: true, error: null }))
    let q = supabase.from('usuarios').select('*').order('nombre', { ascending: true })
    if (empresaId) q = q.eq('empresa_id', empresaId)
    const { data, error } = await q

    setEstado({
      data: (data as Usuario[]) ?? [],
      loading: false,
      error: error ? 'No se pudieron cargar los usuarios.' : null,
    })
  }, [empresaId])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function crear(payload: {
    empresa_id: string
    nombre: string
    email: string
    password: string
    rol: 'admin' | 'usuario'
  }) {
    try {
      await apiFetch('/api/admin/usuarios', { accion: 'crear', ...payload })
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Error al crear el usuario.' }
    }
  }

  async function editar(payload: { id: string; nombre: string; email: string; rol: 'admin' | 'usuario' }) {
    try {
      await apiFetch('/api/admin/usuarios', { accion: 'editar', ...payload })
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Error al guardar el usuario.' }
    }
  }

  async function eliminar(id: string) {
    try {
      await apiFetch('/api/admin/usuarios', { accion: 'eliminar', id })
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Error al eliminar el usuario.' }
    }
  }

  async function cambiarPassword(id: string, password: string) {
    try {
      await apiFetch('/api/admin/usuarios', { accion: 'password', id, password })
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Error al cambiar la contrasena.' }
    }
  }

  /** Activar/desactivar SI puede hacerse directo: no toca auth.users. */
  async function setActivo(id: string, activo: boolean) {
    const { error } = await supabase.from('usuarios').update({ activo }).eq('id', id)
    return { error: error?.message ?? null }
  }

  return { ...estado, refetch, crear, editar, eliminar, cambiarPassword, setActivo }
}

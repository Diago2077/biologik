import { useCallback } from 'react'
import type { ConteoFormState, ConteoIA } from '@/lib/conteo'
import { validarConteo } from '@/lib/conteo'
import type { LadoCuerpo } from '@/lib/database.types'
import { eliminarFoto, subirFoto } from '@/lib/storage'
import { apiFetch, supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/**
 * Las dos mitades del alta de un conteo: mandar la foto a la IA y, ya
 * revisada, guardarla junto con el archivo original.
 */
export function useConteoAlta() {
  const { perfil } = useAuth()

  const contar = useCallback(
    async (
      animalId: string,
      imagenBase64: string,
      mimeType: string,
    ): Promise<{ datos: ConteoIA | null; error: string | null }> => {
      try {
        const res = await apiFetch<{ ok: boolean; datos: ConteoIA }>('/api/contar', {
          animal_id: animalId,
          imagen_base64: imagenBase64,
          mime_type: mimeType,
        })
        return { datos: res.datos, error: null }
      } catch (e) {
        return { datos: null, error: e instanceof Error ? e.message : 'No se pudo contar la foto.' }
      }
    },
    [],
  )

  const guardar = useCallback(
    async (
      animalId: string,
      empresaId: string,
      archivo: File,
      form: ConteoFormState,
      raw?: ConteoIA,
    ): Promise<{ error: string | null }> => {
      const problema = validarConteo(form)
      if (problema) return { error: problema }

      const subida = await subirFoto(empresaId, animalId, archivo)
      if ('error' in subida) return { error: subida.error }

      const { error } = await supabase.from('conteos').insert({
        empresa_id: empresaId,
        animal_id: animalId,
        lado_cuerpo: form.lado_cuerpo as LadoCuerpo,
        count_total: Number(form.count_total),
        fecha_conteo: form.fecha_conteo,
        detecciones: [],
        observaciones: form.observaciones.trim() || null,
        archivo_path: subida.path,
        archivo_nombre: subida.nombre,
        archivo_mime: subida.mime,
        extraccion_raw: raw ?? null,
        created_by: perfil?.id ?? null,
      })

      if (error) {
        // Sin esto quedaria la foto ocupando lugar en Storage sin ninguna
        // fila que la referencie ni forma de encontrarla desde la app.
        await eliminarFoto(subida.path)
        return { error: 'No se pudo guardar el conteo.' }
      }

      return { error: null }
    },
    [perfil],
  )

  return { contar, guardar }
}

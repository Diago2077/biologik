import { supabase } from './supabase'

const BUCKET = 'fotos'
const UNA_HORA = 60 * 60

function extensionDe(mime: string, nombreOriginal: string): string {
  const porMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  if (porMime[mime]) return porMime[mime]
  const ext = nombreOriginal.split('.').pop()
  return ext && ext.length <= 5 ? ext.toLowerCase() : 'bin'
}

/**
 * Sube la foto ORIGINAL (no la version reducida que se le manda a la IA) al
 * bucket privado, bajo {empresa_id}/{animal_id}/... que es lo que la politica
 * de Storage usa para el aislamiento por empresa.
 */
export async function subirFoto(
  empresaId: string,
  animalId: string,
  archivo: File,
): Promise<{ path: string; nombre: string; mime: string } | { error: string }> {
  const ext = extensionDe(archivo.type, archivo.name)
  const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${empresaId}/${animalId}/${nombreArchivo}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, {
    contentType: archivo.type || undefined,
    upsert: false,
  })

  if (error) return { error: 'No se pudo subir la foto.' }
  return { path, nombre: archivo.name, mime: archivo.type || 'application/octet-stream' }
}

export async function eliminarFoto(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

export async function eliminarFotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await supabase.storage.from(BUCKET).remove(paths)
}

/** URL firmada de corta duracion para previsualizar una foto del bucket privado. */
export async function urlFirmada(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, UNA_HORA)
  return data?.signedUrl ?? null
}

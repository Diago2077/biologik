/**
 * Copia las fotos de la app Gavac anterior al bucket privado de Biologik.
 *
 * Las viejas estaban en el bucket publico `fotos-garrapatas` bajo
 * {animal_id}/{archivo}; las nuevas van a `fotos` bajo
 * {empresa_id}/{animal_id}/{archivo}, que es lo que la politica de Storage
 * usa para el aislamiento por empresa. Como el primer segmento del path
 * cambia, no alcanza con un rename: hay que subirlas de nuevo.
 *
 * Se sube desde el respaldo local (no se bajan otra vez) y se completa
 * conteos.archivo_path con la ruta nueva.
 *
 * Uso:  node scripts/migrar-fotos.mjs <carpeta-del-respaldo> <email> <password>
 * Se corre una sola vez; es idempotente (upsert + update por id).
 */
import { createClient } from '@supabase/supabase-js'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const [carpeta, email, password] = process.argv.slice(2)
if (!carpeta || !email || !password) {
  console.error('Uso: node scripts/migrar-fotos.mjs <carpeta-respaldo> <email> <password>')
  process.exit(1)
}

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
if (!URL || !ANON) {
  console.error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en el entorno.')
  process.exit(1)
}

const supabase = createClient(URL, ANON)

const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password })
if (errLogin) {
  console.error('No se pudo iniciar sesion:', errLogin.message)
  process.exit(1)
}

// El respaldo guardo cada foto como {animal_id}__{archivo}.jpg
const archivos = await readdir(join(carpeta, 'fotos'))
const porAnimal = new Map()
for (const nombre of archivos) {
  const [animalId, archivo] = nombre.split('__')
  if (!animalId || !archivo) continue
  if (!porAnimal.has(animalId)) porAnimal.set(animalId, [])
  porAnimal.get(animalId).push({ nombre, archivo })
}

// Los conteos viejos guardaban la URL publica completa: de ahi sale que foto
// le corresponde a cada fila.
const viejos = JSON.parse(await readFile(join(carpeta, 'conteos.json'), 'utf-8'))

const { data: empresa } = await supabase.from('empresas').select('id').eq('nombre', 'Gavac').single()
if (!empresa) {
  console.error('No se encontro la empresa Gavac.')
  process.exit(1)
}

let subidas = 0
let fallas = 0

for (const conteo of viejos) {
  if (!conteo.foto_url) continue
  const relativa = conteo.foto_url.split('/fotos-garrapatas/')[1]
  if (!relativa) continue

  const nombreLocal = relativa.replaceAll('/', '__')
  const destino = `${empresa.id}/${relativa}`

  try {
    const contenido = await readFile(join(carpeta, 'fotos', nombreLocal))
    const { error: errSubida } = await supabase.storage
      .from('fotos')
      .upload(destino, contenido, { contentType: 'image/jpeg', upsert: true })
    if (errSubida) throw new Error(errSubida.message)

    const { error: errFila } = await supabase
      .from('conteos')
      .update({
        archivo_path: destino,
        archivo_nombre: relativa.split('/').pop(),
        archivo_mime: 'image/jpeg',
      })
      .eq('id', conteo.id)
    if (errFila) throw new Error(errFila.message)

    subidas++
  } catch (e) {
    console.error(`  falla ${relativa}: ${e.message}`)
    fallas++
  }
}

console.log(`Fotos migradas: ${subidas}${fallas ? ` (${fallas} fallaron)` : ''}`)

export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
export const EXTENSIONES_PERMITIDAS = '.jpg,.jpeg,.png,.webp'
const LIMITE_MB = 15

/**
 * Lado maximo de la imagen que se le manda a la IA.
 *
 * No es una eleccion arbitraria: los modelos de vision reescalan la imagen
 * antes de tokenizarla (la encajan en 2048x2048 y despues llevan el lado
 * corto a 768), asi que todo lo que se mande por encima de esto se descarta
 * del otro lado. Mandarlo igual no mejora la lectura ni cuesta mas tokens:
 * solo infla el request -- que ademas viaja en base64, un 33% mas grande --
 * y hace esperar al usuario.
 *
 * Aca se usa 2048 y no menos porque contar garrapatas necesita mas detalle
 * que leer texto: son manchas de pocos pixeles y bajar la resolucion las
 * funde entre si.
 */
const LADO_MAXIMO = 2048
const CALIDAD_JPEG = 0.9

export function tipoPermitido(archivo: File): boolean {
  return TIPOS_PERMITIDOS.includes(archivo.type)
}

export function archivoDemasiadoGrande(archivo: File): boolean {
  return archivo.size > LIMITE_MB * 1024 * 1024
}

function leerComoDataUrl(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result as string)
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    lector.readAsDataURL(archivo)
  })
}

function cargarImagen(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    img.src = dataUrl
  })
}

/**
 * Baja la imagen a LADO_MAXIMO y la reencoda como JPEG. Se reencoda siempre,
 * aunque no haga falta escalar: un PNG de camara o de captura pesa varias
 * veces mas que el JPEG equivalente sin aportar nada para el conteo.
 */
async function reducir(dataUrl: string): Promise<string> {
  const img = await cargarImagen(dataUrl)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * escala))
  canvas.height = Math.max(1, Math.round(img.height * escala))
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('No se pudo preparar el canvas.')

  // Los PNG y WEBP pueden ser transparentes; el JPEG no, y sin fondo blanco
  // esas zonas salen negras.
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, canvas.width, canvas.height)
  contexto.drawImage(img, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', CALIDAD_JPEG)
}

/**
 * Devuelve la imagen que se manda a la IA de vision (JPEG en base64) y la que
 * se muestra en pantalla. El archivo ORIGINAL se sube a Storage aparte, sin
 * pasar por aca.
 */
export async function prepararParaConteo(
  archivo: File,
): Promise<{ base64: string; mime: string; previewDataUrl: string }> {
  const original = await leerComoDataUrl(archivo)
  const reducido = await reducir(original)
  return { base64: reducido.split(',')[1] ?? '', mime: 'image/jpeg', previewDataUrl: reducido }
}

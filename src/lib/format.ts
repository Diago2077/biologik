/** Formateo y parseo con las convenciones locales. */

/** '2026-03-14' → '14/03/2026'. Recorta la hora si viene un timestamp. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [fecha] = iso.split('T')
  const [a, m, d] = fecha.split('-')
  if (!a || !m || !d) return iso
  return `${d}/${m}/${a}`
}

export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return '—'
  return `${formatFecha(iso)} ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`
}

/** Fecha de hoy en 'YYYY-MM-DD', en hora local (no UTC). */
export function hoyISO(): string {
  const f = new Date()
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

/**
 * Normaliza a 'YYYY-MM-DD' lo que sea que venga de un formulario.
 * Ante '03/04/2026' asume dia/mes, que es como se escribe aca.
 */
export function parseFecha(entrada: string | null | undefined): string | null {
  if (!entrada) return null
  const s = String(entrada).trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    const dia = Number(m[1])
    const mes = Number(m[2])
    let anio = Number(m[3])
    if (anio < 100) anio += anio < 70 ? 2000 : 1900
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null
    return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  const f = new Date(s)
  if (!Number.isNaN(f.getTime())) return f.toISOString().slice(0, 10)
  return null
}

export function formatNumero(valor: number | null | undefined): string {
  const n = Number(valor ?? 0)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-PY').format(n)
}

/** Costos de IA: dolares con dos decimales. */
export function formatUsd(valor: number | string | null | undefined): string {
  const n = typeof valor === 'number' ? valor : Number(valor ?? 0)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/**
 * Digito verificador del RUC, algoritmo modulo 11 de la SET.
 * Los RUC viejos podian traer letras: se convierten a su codigo ASCII.
 *
 * ADVERTENCIA: esto sirve para AVISAR, nunca para bloquear. Si el algoritmo
 * tuviera un detalle mal, rechazar un RUC valido seria peor que no avisar.
 * Ver `rucSospechoso`.
 */
export function calcularDV(rucSinDV: string, baseMax = 11): number | null {
  const limpio = String(rucSinDV).trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (!limpio) return null

  let digitos = ''
  for (const c of limpio) {
    digitos += c >= '0' && c <= '9' ? c : String(c.charCodeAt(0))
  }

  let total = 0
  let k = 2
  for (let i = digitos.length - 1; i >= 0; i--) {
    if (k > baseMax) k = 2
    total += Number(digitos[i]) * k
    k++
  }
  const resto = total % 11
  return resto > 1 ? 11 - resto : 0
}

/**
 * true si el RUC tiene forma '80012345-6' y el DV NO cierra.
 * Se usa solo para pintar una advertencia al lado del campo; el guardado
 * nunca se frena por esto. Un RUC sin guion no se considera sospechoso
 * porque simplemente no se puede evaluar.
 */
export function rucSospechoso(ruc: string | null | undefined): boolean {
  if (!ruc) return false
  const m = String(ruc).trim().match(/^([0-9A-Za-z]+)-(\d)$/)
  if (!m) return false
  return calcularDV(m[1]) !== Number(m[2])
}

/** '800123456' → '80012345-6'. Deja intacto lo que ya trae guion. */
export function formatRuc(ruc: string | null | undefined): string {
  if (!ruc) return '—'
  const s = String(ruc).trim()
  if (s.includes('-')) return s
  const d = s.replace(/\D/g, '')
  if (d.length < 2) return s
  return `${d.slice(0, -1)}-${d.slice(-1)}`
}

/** Normaliza texto para buscar sin tildes ni mayusculas. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

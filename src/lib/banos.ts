import { hoyISO } from './format'
import { diasEntre } from './vacunacion'

/**
 * Metricas de los baños acaricidas de una finca.
 *
 * Es lo que el Programa de Control Integrado usa para medirse: no cuantas
 * garrapatas se contaron, sino cuantos baños hicieron falta y cuantos dias
 * se pudo esperar entre uno y el siguiente. Un intervalo que crece es la
 * prueba de que la vacunacion esta funcionando; un promedio de garrapatas
 * que baja, solo, no prueba nada (baja tambien en invierno).
 *
 * Todas estas funciones reciben las fechas ordenadas de la mas nueva a la
 * mas vieja, que es como vienen de la base.
 */

export interface BanoConIntervalo {
  fecha: string
  /** Dias que pasaron desde el baño anterior. null en el mas viejo. */
  dias: number | null
}

/** Le pega a cada baño los dias que pasaron desde el anterior. */
export function conIntervalos(fechasDesc: string[]): BanoConIntervalo[] {
  return fechasDesc.map((fecha, i) => {
    const anterior = fechasDesc[i + 1]
    return { fecha, dias: anterior ? diasEntre(anterior, fecha) : null }
  })
}

/** Promedio de dias entre baños. null con menos de dos baños. */
export function promedioIntervalo(fechasDesc: string[]): number | null {
  const dias = conIntervalos(fechasDesc)
    .map((b) => b.dias)
    .filter((d): d is number => d !== null)
  if (dias.length === 0) return null
  return Math.round(dias.reduce((s, n) => s + n, 0) / dias.length)
}

/** Dias transcurridos desde el ultimo baño. null si nunca se baño. */
export function diasDesdeUltimo(fechasDesc: string[], hoy: string = hoyISO()): number | null {
  const ultimo = fechasDesc[0]
  return ultimo ? diasEntre(ultimo, hoy) : null
}

/** Cuantos baños se hicieron en los ultimos 365 dias. */
export function banosUltimoAno(fechasDesc: string[], hoy: string = hoyISO()): number {
  return fechasDesc.filter((f) => diasEntre(f, hoy) <= 365).length
}

/**
 * Compara el intervalo de los ultimos baños contra el de los anteriores.
 *
 * Es el numero que el productor quiere ver: si el intervalo se alarga, cada
 * vez hace falta bañar menos seguido. Devuelve null hasta que haya cuatro
 * baños, que es el minimo para tener dos intervalos de cada lado.
 */
export function tendenciaIntervalo(
  fechasDesc: string[],
): { recientes: number; previos: number; variacionPct: number } | null {
  const dias = conIntervalos(fechasDesc)
    .map((b) => b.dias)
    .filter((d): d is number => d !== null)
  if (dias.length < 4) return null

  const mitad = Math.floor(dias.length / 2)
  const promedio = (xs: number[]) => xs.reduce((s, n) => s + n, 0) / xs.length
  const recientes = promedio(dias.slice(0, mitad))
  const previos = promedio(dias.slice(mitad))
  if (previos === 0) return null

  return {
    recientes: Math.round(recientes),
    previos: Math.round(previos),
    variacionPct: Math.round(((recientes - previos) / previos) * 100),
  }
}

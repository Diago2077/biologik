/**
 * Umbral de infestacion: a partir de cuantas garrapatas conviene bañar.
 *
 * El programa de control integrado no baña por calendario sino por nivel de
 * infestacion, justamente para espaciar los tratamientos todo lo que la
 * carga real permita. El numero no es universal --depende de la zona, la
 * raza y la epoca del año-- por eso lo fija cada empresa; este es solo el
 * valor con el que arranca.
 */
export const UMBRAL_POR_DEFECTO = 20

export type NivelInfestacion = 'sin_datos' | 'bajo' | 'cerca' | 'supera'

/** En que nivel esta un animal segun la carga de su ultimo muestreo. */
export function nivelInfestacion(carga: number | null, umbral: number): NivelInfestacion {
  if (carga === null) return 'sin_datos'
  if (carga >= umbral) return 'supera'
  // El 70% del umbral avisa antes de llegar: da tiempo a planificar el baño
  // en vez de descubrirlo el dia que ya hay que hacerlo.
  if (carga >= umbral * 0.7) return 'cerca'
  return 'bajo'
}

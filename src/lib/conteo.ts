import type { LadoCuerpo } from './database.types'
import { hoyISO } from './format'

/** Lo que devuelve api/contar.ts para una foto. */
export interface ConteoIA {
  /** Numero ya calibrado: es el que se propone en el formulario. */
  count_total: number
  /** Numero crudo del modelo, antes de la correccion lineal. Solo informativo. */
  count_crudo: number
  observaciones: string | null
  /** Razonamiento por zonas que hizo el modelo antes de dar el numero. */
  analisis: string
}

/**
 * Estado editable de un conteo en la pantalla de revision.
 * El total llega de la IA pero se puede corregir a mano antes de guardar:
 * la IA propone, la persona decide.
 */
export interface ConteoFormState {
  lado_cuerpo: LadoCuerpo | ''
  count_total: string
  fecha_conteo: string
  observaciones: string
}

export function conteoIAAFormState(datos: ConteoIA): ConteoFormState {
  return {
    lado_cuerpo: '',
    count_total: String(datos.count_total),
    fecha_conteo: hoyISO(),
    observaciones: datos.observaciones ?? '',
  }
}

export function formStateVacio(): ConteoFormState {
  return { lado_cuerpo: '', count_total: '', fecha_conteo: hoyISO(), observaciones: '' }
}

/** null si el formulario esta completo; si no, que le falta. */
export function validarConteo(form: ConteoFormState): string | null {
  if (!form.lado_cuerpo) return 'Elegi la zona del cuerpo.'
  const n = Number(form.count_total)
  if (!Number.isInteger(n) || n < 0) return 'El total tiene que ser un numero entero de 0 o mas.'
  if (!form.fecha_conteo) return 'Falta la fecha.'
  return null
}

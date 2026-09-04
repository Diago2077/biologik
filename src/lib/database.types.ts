/**
 * Tipos de la base, escritos a mano.
 *
 * Se mantienen a mano y no generados porque afinan cosas que el generador no
 * puede saber -- que `rol` es una union y no un string suelto, que
 * `lado_cuerpo` solo puede ser uno de siete valores -- y porque llevan los
 * comentarios que explican para que sirve cada campo.
 *
 * El riesgo de eso es que una migracion los deje desactualizados en silencio.
 * Por eso al final del archivo hay un chequeo contra el esquema real que
 * convierte ese tipo de desfasaje en un error de compilacion.
 */

import type { Database } from './database.generated'

export type Rol = 'super_admin' | 'admin' | 'usuario'

export const ROL_LABEL: Record<Rol, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  usuario: 'Usuario',
}

/**
 * Partes del cuerpo del animal que se fotografian. El conteo se hace por
 * zona: son las regiones donde la garrapata se prende con mas frecuencia.
 */
export const LADOS_CUERPO = [
  { value: 'lado_izquierdo', label: 'Lado izquierdo' },
  { value: 'lado_derecho', label: 'Lado derecho' },
  { value: 'paleta', label: 'Paleta' },
  { value: 'cuello', label: 'Cuello' },
  { value: 'axila', label: 'Axila' },
  { value: 'entrepierna', label: 'Entrepierna' },
  { value: 'cola', label: 'Cola' },
] as const

export type LadoCuerpo = (typeof LADOS_CUERPO)[number]['value']

export function ladoLabel(valor: string): string {
  return LADOS_CUERPO.find((l) => l.value === valor)?.label ?? valor
}

export const CATEGORIAS_ANIMAL = ['Vaca', 'Toro', 'Novillo', 'Vaquilla', 'Ternero', 'Ternera'] as const

export interface Empresa {
  id: string
  nombre: string
  ruc: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  logo_url: string | null
  activo: boolean
  /** null = sin limite. Al superarlo en el mes, api/contar.ts corta el conteo por IA. */
  limite_tokens_mensual: number | null
  created_at: string
}

/** Un registro por cada llamada a la IA que efectivamente proceso una foto. */
export interface UsoIA {
  id: string
  empresa_id: string
  animal_id: string | null
  usuario_id: string | null
  modelo: string | null
  tokens_prompt: number
  tokens_completion: number
  tokens_total: number
  /** Parte de tokens_prompt que vino del cache de OpenAI, facturada mas barato. */
  tokens_cache: number
  costo_usd: number
  created_at: string
}

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** Fila unica (singleton): que modelo de IA usar y con que parametros, editable por el super_admin. */
export interface ConfiguracionIA {
  id: true
  modelo: string
  precio_input_por_1m: number
  precio_output_por_1m: number
  /** Tokens de prompt servidos desde el cache de OpenAI, mas baratos que los plenos. */
  precio_cache_por_1m: number
  /** null = no se manda el parametro (modelos que no son gpt-5.x lo ignoran igual). */
  reasoning_effort: ReasoningEffort | null
  max_tokens: number
  /** Tokens que un mismo usuario puede gastar por hora. null = sin tope. */
  limite_tokens_usuario_hora: number | null
  /**
   * Correccion lineal sobre el numero crudo del modelo:
   *   final = round(crudo * slope + intercept)
   * En fotos con garrapatas apinadas el modelo tiende a quedarse corto, y el
   * sesgo es proporcional, no constante: por eso una recta y no un factor.
   */
  calibracion_slope: number
  calibracion_intercept: number
  updated_at: string
}
export type ConfiguracionIAUpdate = Partial<Omit<ConfiguracionIA, 'id' | 'updated_at'>>

export interface Usuario {
  id: string
  empresa_id: string | null
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  created_at: string
}

export interface Finca {
  id: string
  empresa_id: string
  nombre: string
  propietario: string | null
  ubicacion: string | null
  ciudad: string | null
  telefono: string | null
  email: string | null
  activo: boolean
  created_at: string
}

export interface Animal {
  id: string
  empresa_id: string
  finca_id: string
  caravana: string
  raza: string | null
  categoria: string | null
  observaciones: string | null
  activo: boolean
  created_at: string
}

export interface Deteccion {
  /** 0-1, posicion relativa horizontal en la imagen. */
  x: number
  /** 0-1, posicion relativa vertical en la imagen. */
  y: number
  tamano_mm_estimado: number | null
}

export interface Conteo {
  id: string
  empresa_id: string
  animal_id: string

  lado_cuerpo: LadoCuerpo
  /** Numero final que queda registrado: sale de la IA pero es corregible a mano. */
  count_total: number
  fecha_conteo: string

  /** Posiciones relativas devueltas por la IA, para marcar la foto. */
  detecciones: Deteccion[]
  observaciones: string | null

  archivo_path: string | null
  archivo_nombre: string | null
  archivo_mime: string | null

  extraccion_raw: unknown | null

  created_by: string | null
  created_at: string
  updated_at: string
}

/** Campos que la base calcula sola y que no se mandan nunca en un insert/update. */
type Generados = 'id' | 'created_at' | 'updated_at'

export type ConteoInsert = Omit<Conteo, Generados>
export type ConteoUpdate = Partial<ConteoInsert>
export type FincaInsert = Omit<Finca, 'id' | 'created_at'>
export type FincaUpdate = Partial<FincaInsert>
export type AnimalInsert = Omit<Animal, 'id' | 'created_at'>
export type AnimalUpdate = Partial<AnimalInsert>
export type EmpresaInsert = Omit<Empresa, 'id' | 'created_at'>
export type EmpresaUpdate = Partial<EmpresaInsert>

/** Animal con el resumen de sus conteos ya agregado, para el listado de la finca. */
export interface AnimalConTotal extends Animal {
  total_garrapatas: number
  cantidad_conteos: number
  ultimo_conteo: string | null
}

// ─────────────────────────────────────────────────────────────
// Chequeo contra el esquema real (ver el comentario de arriba)
//
// No compara los tipos de cada campo -- eso romperia a proposito las uniones
// afinadas de mas arriba -- sino los NOMBRES de las columnas, que es donde
// estan los desfasajes que pasan desapercibidos: una columna renombrada o
// borrada por una migracion deja de existir en el tipo generado y el build
// falla nombrando la tabla.
//
// Para regenerar database.generated.ts despues de migrar: npm run tipos
// ─────────────────────────────────────────────────────────────
type Fila<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type Afirmar<T extends true> = T
type ColumnasExisten<Propio, EnLaBase> =
  Extract<keyof Propio, string> extends Extract<keyof EnLaBase, string> ? true : false

export type ChequeoDeEsquema = [
  Afirmar<ColumnasExisten<Empresa, Fila<'empresas'>>>,
  Afirmar<ColumnasExisten<Usuario, Fila<'usuarios'>>>,
  Afirmar<ColumnasExisten<Finca, Fila<'fincas'>>>,
  Afirmar<ColumnasExisten<Animal, Fila<'animales'>>>,
  Afirmar<ColumnasExisten<Conteo, Fila<'conteos'>>>,
  Afirmar<ColumnasExisten<UsoIA, Fila<'uso_ia'>>>,
  Afirmar<ColumnasExisten<ConfiguracionIA, Fila<'configuracion_ia'>>>,
]

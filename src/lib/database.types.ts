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
import type { Cronograma, ModoCronograma } from './vacunacion'

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
  /** Que hacer con las dosis siguientes cuando una se aplica fuera de termino. */
  modo_cronograma_vacunacion: ModoCronograma
  /** Carga a partir de la cual el animal necesita tratamiento acaricida. */
  umbral_garrapatas: number
  dias_segunda_dosis: number
  /** La 3ra dosis cae a esta distancia de la 1ra, y de ahi en mas cada tanto. */
  dias_refuerzo: number
  dias_aviso_vacunacion: number
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

/**
 * Una dosis aplicada a un animal. El cronograma de las que faltan NO se
 * guarda: se calcula desde estas filas (ver src/lib/vacunacion.ts).
 */
export interface Vacunacion {
  id: string
  empresa_id: string
  animal_id: string
  /** 1 = primera, 2 = refuerzo a los 30 dias, 3 = a los 180 de la primera, etc. */
  numero_dosis: number
  fecha_aplicada: string
  producto: string | null
  lote: string | null
  observaciones: string | null
  created_by: string | null
  created_at: string
}

/**
 * Un baño acaricida. Es un evento de finca, no de animal: el rodeo entero
 * pasa por el baño en la misma jornada, y el intervalo entre baños --que es
 * la metrica del programa-- es de la finca.
 */
export interface Bano {
  id: string
  empresa_id: string
  finca_id: string
  fecha: string
  producto: string | null
  observaciones: string | null
  created_by: string | null
  created_at: string
}

/**
 * Lo que el navegador de UN dispositivo entrega al suscribirse a push
 * (PushManager.subscribe). Un mismo usuario puede tener varias filas -- una
 * por celular/PC en el que activo las notificaciones -- por eso la clave es
 * el endpoint, no el usuario.
 */
export interface PushSubscripcion {
  id: string
  usuario_id: string
  empresa_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
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
export type VacunacionInsert = Omit<Vacunacion, 'id' | 'created_at'>
export type BanoInsert = Omit<Bano, 'id' | 'created_at'>
export type PushSubscripcionInsert = Omit<PushSubscripcion, 'id' | 'created_at'>

/**
 * Un muestreo: lo que se le conto a UN animal en UNA fecha, sumando todas
 * las zonas que se le fotografiaron ese dia.
 *
 * Es la unidad con la que hay que medir. El acumulado historico no sirve
 * como indicador sanitario: solo crece con cada visita, asi que nunca podria
 * mostrar que la carga bajo.
 */
export interface Muestreo {
  fecha: string
  /** Suma de las garrapatas de todas las zonas fotografiadas ese dia. */
  carga: number
  /** Cuantas zonas del cuerpo se fotografiaron. */
  zonas: number
}

/** Animal con el resumen de sus muestreos, para el listado de la finca. */
export interface AnimalConResumen extends Animal {
  /** Carga del ultimo muestreo: cuan cargado esta HOY. */
  ultima_carga: number | null
  /** Promedio de la carga entre todos sus muestreos. */
  promedio_carga: number | null
  cantidad_muestreos: number
  ultimo_conteo: string | null
  /** Estado del cronograma de vacunacion, ya resuelto. */
  cronograma: Cronograma
}

/** Promedio de carga de una finca en una fecha de muestreo. */
export interface MuestreoFinca {
  fecha: string
  /** Promedio de la carga entre los animales medidos ese dia. */
  promedio: number
  animales_medidos: number
  total: number
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
  Afirmar<ColumnasExisten<Vacunacion, Fila<'vacunaciones'>>>,
  Afirmar<ColumnasExisten<Bano, Fila<'banos'>>>,
  Afirmar<ColumnasExisten<PushSubscripcion, Fila<'push_subscripciones'>>>,
  Afirmar<ColumnasExisten<UsoIA, Fila<'uso_ia'>>>,
  Afirmar<ColumnasExisten<ConfiguracionIA, Fila<'configuracion_ia'>>>,
]

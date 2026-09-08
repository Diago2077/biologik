import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Animal,
  AnimalConResumen,
  AnimalInsert,
  AnimalUpdate,
  MuestreoFinca,
} from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { calcularCronograma, planDeEmpresa, type DosisAplicada } from '@/lib/vacunacion'
import { useAuth } from './useAuth'

interface Estado {
  data: AnimalConResumen[]
  /** Serie de muestreos de la finca, del mas reciente al mas viejo. */
  muestreos: MuestreoFinca[]
  loading: boolean
  error: string | null
}

const VACIO: Estado = { data: [], muestreos: [], loading: false, error: null }

interface FilaConteo {
  animal_id: string
  count_total: number
  fecha_conteo: string
}

/**
 * Animales de una finca con el resumen de sus muestreos y su cronograma de
 * vacunacion.
 *
 * **La unidad de medida es el muestreo (animal + fecha), no el acumulado.**
 * Sumar todo lo contado desde siempre da un numero que solo crece con cada
 * visita: serviria para saber cuantas garrapatas se contaron en total, pero
 * nunca podria mostrar que la carga bajo despues de vacunar, que es
 * justamente para lo que se usa el sistema.
 *
 * El resumen se arma en el cliente con selects planos en vez de una vista o
 * un rpc: evita mantener una funcion en la base sincronizada con el esquema,
 * y son volumenes chicos (una finca, sus animales y sus conteos).
 */
export function useAnimales(fincaId: string | undefined) {
  const { empresa } = useAuth()
  // Memoizado: es dependencia del useCallback de abajo, y un objeto nuevo en
  // cada render dispararia una recarga infinita.
  const plan = useMemo(() => planDeEmpresa(empresa), [empresa])
  const [estado, setEstado] = useState<Estado>({ ...VACIO, loading: true })

  const cargar = useCallback(async (): Promise<Estado> => {
    if (!fincaId) return VACIO

    const { data: animales, error } = await supabase
      .from('animales')
      .select('*')
      .eq('finca_id', fincaId)
      .order('caravana', { ascending: true })

    if (error) {
      return { ...VACIO, error: 'No se pudieron cargar los animales.' }
    }

    const lista = (animales as Animal[]) ?? []
    if (lista.length === 0) return VACIO

    const ids = lista.map((a) => a.id)
    const [{ data: conteos }, { data: vacunas }] = await Promise.all([
      supabase.from('conteos').select('animal_id, count_total, fecha_conteo').in('animal_id', ids),
      supabase.from('vacunaciones').select('animal_id, numero_dosis, fecha_aplicada').in('animal_id', ids),
    ])

    // Primero se agrupa por animal Y fecha: esa suma es la carga del animal
    // ese dia. Recien despues se promedia.
    const cargaPorAnimalYFecha = new Map<string, Map<string, number>>()
    for (const c of (conteos as FilaConteo[]) ?? []) {
      let porFecha = cargaPorAnimalYFecha.get(c.animal_id)
      if (!porFecha) {
        porFecha = new Map()
        cargaPorAnimalYFecha.set(c.animal_id, porFecha)
      }
      porFecha.set(c.fecha_conteo, (porFecha.get(c.fecha_conteo) ?? 0) + c.count_total)
    }

    const dosisPorAnimal = new Map<string, DosisAplicada[]>()
    for (const v of (vacunas as (DosisAplicada & { animal_id: string })[]) ?? []) {
      const previas = dosisPorAnimal.get(v.animal_id) ?? []
      previas.push({ numero_dosis: v.numero_dosis, fecha_aplicada: v.fecha_aplicada })
      dosisPorAnimal.set(v.animal_id, previas)
    }

    const data: AnimalConResumen[] = lista.map((animal) => {
      const porFecha = cargaPorAnimalYFecha.get(animal.id)
      const fechas = porFecha ? [...porFecha.keys()].sort() : []
      const cargas = fechas.map((f) => porFecha!.get(f) as number)
      const ultimaFecha = fechas.at(-1) ?? null

      return {
        ...animal,
        ultima_carga: ultimaFecha ? (porFecha!.get(ultimaFecha) as number) : null,
        promedio_carga: cargas.length
          ? Math.round(cargas.reduce((s, n) => s + n, 0) / cargas.length)
          : null,
        cantidad_muestreos: fechas.length,
        ultimo_conteo: ultimaFecha,
        cronograma: calcularCronograma(dosisPorAnimal.get(animal.id) ?? [], plan),
      }
    })

    // Serie de la finca: por cada fecha en que se midio, el promedio de la
    // carga entre los animales medidos ESE dia. Los que no se midieron no
    // entran en el promedio -- contarlos como cero lo hundiria.
    const porFechaFinca = new Map<string, number[]>()
    for (const [, porFecha] of cargaPorAnimalYFecha) {
      for (const [fecha, carga] of porFecha) {
        const previas = porFechaFinca.get(fecha) ?? []
        previas.push(carga)
        porFechaFinca.set(fecha, previas)
      }
    }

    const muestreos: MuestreoFinca[] = [...porFechaFinca.entries()]
      .map(([fecha, cargas]) => {
        const total = cargas.reduce((s, n) => s + n, 0)
        return {
          fecha,
          total,
          animales_medidos: cargas.length,
          promedio: Math.round(total / cargas.length),
        }
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))

    return { data, muestreos, loading: false, error: null }
  }, [fincaId, plan])

  const refetch = useCallback(async () => {
    setEstado((s) => ({ ...s, loading: true, error: null }))
    setEstado(await cargar())
  }, [cargar])

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      setEstado((s) => ({ ...s, loading: true }))
      const resultado = await cargar()
      if (!cancelado) setEstado(resultado)
    })()
    return () => {
      cancelado = true
    }
  }, [cargar])

  async function crear(payload: AnimalInsert) {
    const { data, error } = await supabase.from('animales').insert(payload).select().single()
    return { data: data as Animal | null, error: mensajeError(error?.message) }
  }

  async function actualizar(id: string, payload: AnimalUpdate) {
    const { error } = await supabase.from('animales').update(payload).eq('id', id)
    return { error: mensajeError(error?.message) }
  }

  async function eliminar(id: string) {
    const { error } = await supabase.from('animales').delete().eq('id', id)
    return { error: error ? 'No se pudo eliminar el animal.' : null }
  }

  return { ...estado, refetch, crear, actualizar, eliminar }
}

/** Un solo animal, para su ficha. */
export function useAnimal(id: string | undefined) {
  const [data, setData] = useState<Animal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      if (!id) {
        if (!cancelado) {
          setData(null)
          setLoading(false)
        }
        return
      }
      setLoading(true)
      const { data: fila } = await supabase.from('animales').select('*').eq('id', id).maybeSingle()
      if (cancelado) return
      setData((fila as Animal) ?? null)
      setLoading(false)
    })()
    return () => {
      cancelado = true
    }
  }, [id])

  return { data, loading }
}

/** El unique (finca_id, caravana) es el error que el usuario va a ver seguido. */
function mensajeError(mensaje: string | undefined): string | null {
  if (!mensaje) return null
  if (/duplicate key|unique/i.test(mensaje)) return 'Ya existe un animal con esa caravana en esta finca.'
  return 'No se pudo guardar el animal.'
}

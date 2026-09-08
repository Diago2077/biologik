import { describe, expect, it } from 'vitest'
import {
  banosUltimoAno,
  conIntervalos,
  diasDesdeUltimo,
  promedioIntervalo,
  tendenciaIntervalo,
} from './banos'
import { nivelInfestacion } from './umbral'

// Las fechas llegan de la base ordenadas de la mas nueva a la mas vieja.
const BANOS = ['2026-09-01', '2026-06-01', '2026-04-01', '2026-03-01']

describe('intervalos entre baños', () => {
  it('le pega a cada baño los dias desde el anterior', () => {
    const filas = conIntervalos(BANOS)
    expect(filas[0]).toEqual({ fecha: '2026-09-01', dias: 92 })
    expect(filas[1]).toEqual({ fecha: '2026-06-01', dias: 61 })
    expect(filas[2]).toEqual({ fecha: '2026-04-01', dias: 31 })
  })

  it('deja el baño mas viejo sin intervalo: no hay anterior con que comparar', () => {
    expect(conIntervalos(BANOS).at(-1)).toEqual({ fecha: '2026-03-01', dias: null })
  })

  it('promedia los intervalos', () => {
    expect(promedioIntervalo(BANOS)).toBe(61) // (92 + 61 + 31) / 3
  })

  it('no promedia nada con menos de dos baños', () => {
    expect(promedioIntervalo([])).toBeNull()
    expect(promedioIntervalo(['2026-09-01'])).toBeNull()
  })
})

describe('dias desde el ultimo baño', () => {
  it('cuenta desde el mas reciente', () => {
    expect(diasDesdeUltimo(BANOS, '2026-09-11')).toBe(10)
  })

  it('es null si nunca se baño', () => {
    expect(diasDesdeUltimo([], '2026-09-11')).toBeNull()
  })
})

describe('baños del ultimo año', () => {
  it('cuenta solo los de los ultimos 365 dias', () => {
    const fechas = ['2026-09-01', '2026-01-01', '2025-06-01']
    expect(banosUltimoAno(fechas, '2026-09-11')).toBe(2)
  })
})

describe('tendencia del intervalo', () => {
  it('no opina hasta tener cuatro baños', () => {
    expect(tendenciaIntervalo(['2026-09-01', '2026-06-01', '2026-04-01'])).toBeNull()
  })

  it('detecta que el intervalo se esta alargando', () => {
    // De mas nuevo a mas viejo, con intervalos 90, 90, 30, 30.
    const fechas = ['2026-10-01', '2026-07-03', '2026-04-04', '2026-03-05', '2026-02-03']
    const t = tendenciaIntervalo(fechas)
    expect(t).not.toBeNull()
    expect(t!.recientes).toBeGreaterThan(t!.previos)
    expect(t!.variacionPct).toBeGreaterThan(0)
  })
})

describe('umbral de infestacion', () => {
  it('marca al animal que llega o supera el umbral', () => {
    expect(nivelInfestacion(20, 20)).toBe('supera')
    expect(nivelInfestacion(35, 20)).toBe('supera')
  })

  it('avisa cuando se esta acercando', () => {
    expect(nivelInfestacion(14, 20)).toBe('cerca') // 70% de 20
    expect(nivelInfestacion(13, 20)).toBe('bajo')
  })

  it('distingue el que no tiene conteos del que tiene cero', () => {
    expect(nivelInfestacion(null, 20)).toBe('sin_datos')
    expect(nivelInfestacion(0, 20)).toBe('bajo')
  })
})

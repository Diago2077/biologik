import { describe, expect, it } from 'vitest'
import {
  calcularCronograma,
  diasDesdePrimera,
  diasEntre,
  intervaloHastaSiguiente,
  sumarDias,
} from './vacunacion'

describe('el plan de dosis', () => {
  it('sigue 0, 30, 180 y despues cada 180 dias desde la primera', () => {
    expect(diasDesdePrimera(1)).toBe(0)
    expect(diasDesdePrimera(2)).toBe(30)
    expect(diasDesdePrimera(3)).toBe(180)
    expect(diasDesdePrimera(4)).toBe(360)
    expect(diasDesdePrimera(5)).toBe(540)
  })

  it('separa la 2da de la 3ra por 150 dias, para que la 3ra caiga a los 180', () => {
    expect(intervaloHastaSiguiente(1)).toBe(30)
    expect(intervaloHastaSiguiente(2)).toBe(150)
    expect(intervaloHastaSiguiente(3)).toBe(180)
    expect(intervaloHastaSiguiente(4)).toBe(180)
  })
})

describe('aritmetica de fechas', () => {
  it('suma dias cruzando fin de mes y de anio', () => {
    expect(sumarDias('2026-01-15', 30)).toBe('2026-02-14')
    expect(sumarDias('2026-12-20', 30)).toBe('2027-01-19')
  })

  it('contempla el anio bisiesto', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('cuenta los dias entre dos fechas, con signo', () => {
    expect(diasEntre('2026-03-01', '2026-03-31')).toBe(30)
    expect(diasEntre('2026-03-31', '2026-03-01')).toBe(-30)
    expect(diasEntre('2026-03-01', '2026-03-01')).toBe(0)
  })
})

describe('cronograma sin dosis aplicadas', () => {
  it('queda sin iniciar y no inventa una fecha', () => {
    const c = calcularCronograma([], 'reajustar', '2026-03-01')
    expect(c.estado).toBe('sin_iniciar')
    expect(c.proximaDosis).toBe(1)
    expect(c.proximaFecha).toBeNull()
    expect(c.diasRestantes).toBeNull()
  })
})

describe('cronograma al dia (todo aplicado en fecha)', () => {
  const primera = [{ numero_dosis: 1, fecha_aplicada: '2026-01-01' }]

  it('pide la 2da a los 30 dias', () => {
    for (const modo of ['reajustar', 'anclar'] as const) {
      const c = calcularCronograma(primera, modo, '2026-01-02')
      expect(c.proximaDosis).toBe(2)
      expect(c.proximaFecha).toBe('2026-01-31')
    }
  })

  it('pide la 3ra a los 180 dias de la primera, en los dos modos', () => {
    const dosis = [...primera, { numero_dosis: 2, fecha_aplicada: '2026-01-31' }]
    for (const modo of ['reajustar', 'anclar'] as const) {
      const c = calcularCronograma(dosis, modo, '2026-02-01')
      expect(c.proximaDosis).toBe(3)
      expect(c.proximaFecha).toBe('2026-06-30') // 2026-01-01 + 180
    }
  })

  it('despues de la 3ra pide cada 180 dias', () => {
    const dosis = [
      ...primera,
      { numero_dosis: 2, fecha_aplicada: '2026-01-31' },
      { numero_dosis: 3, fecha_aplicada: '2026-06-30' },
    ]
    for (const modo of ['reajustar', 'anclar'] as const) {
      const c = calcularCronograma(dosis, modo, '2026-07-01')
      expect(c.proximaDosis).toBe(4)
      expect(c.proximaFecha).toBe('2026-12-27') // 2026-01-01 + 360
    }
  })
})

describe('cuando una dosis se aplica tarde, los dos modos difieren', () => {
  // La 2da se dio a los 45 dias en vez de a los 30
  const dosis = [
    { numero_dosis: 1, fecha_aplicada: '2026-01-01' },
    { numero_dosis: 2, fecha_aplicada: '2026-02-15' },
  ]

  it("'reajustar' corre la 3ra para respetar los 150 dias desde la 2da real", () => {
    const c = calcularCronograma(dosis, 'reajustar', '2026-02-16')
    expect(c.proximaFecha).toBe('2026-07-15') // 2026-02-15 + 150
  })

  it("'anclar' deja la 3ra a los 180 dias de la primera, sin moverla", () => {
    const c = calcularCronograma(dosis, 'anclar', '2026-02-16')
    expect(c.proximaFecha).toBe('2026-06-30') // 2026-01-01 + 180
  })
})

describe('estados que disparan el aviso', () => {
  const dosis = [{ numero_dosis: 1, fecha_aplicada: '2026-01-01' }] // 2da: 2026-01-31

  it('al dia mientras falte mas que el margen de aviso', () => {
    const c = calcularCronograma(dosis, 'reajustar', '2026-01-10')
    expect(c.estado).toBe('al_dia')
    expect(c.diasRestantes).toBe(21)
  })

  it('por vencer dentro de los 15 dias', () => {
    expect(calcularCronograma(dosis, 'reajustar', '2026-01-16').estado).toBe('por_vencer')
    expect(calcularCronograma(dosis, 'reajustar', '2026-01-31').estado).toBe('por_vencer')
  })

  it('vencida cuando la fecha ya paso, con los dias en negativo', () => {
    const c = calcularCronograma(dosis, 'reajustar', '2026-02-10')
    expect(c.estado).toBe('vencida')
    expect(c.diasRestantes).toBe(-10)
  })
})

describe('casos de carga imperfecta', () => {
  it('no se marea si las dosis vienen desordenadas', () => {
    const c = calcularCronograma(
      [
        { numero_dosis: 2, fecha_aplicada: '2026-01-31' },
        { numero_dosis: 1, fecha_aplicada: '2026-01-01' },
      ],
      'anclar',
      '2026-02-01',
    )
    expect(c.ultimaDosis).toBe(2)
    expect(c.proximaFecha).toBe('2026-06-30')
  })

  it("si falta la 1ra dosis, 'anclar' se cae a contar desde la ultima", () => {
    // Sin 1ra cargada no hay desde donde anclar: mejor una fecha razonable
    // que ninguna.
    const c = calcularCronograma(
      [{ numero_dosis: 3, fecha_aplicada: '2026-06-30' }],
      'anclar',
      '2026-07-01',
    )
    expect(c.proximaDosis).toBe(4)
    expect(c.proximaFecha).toBe('2026-12-27') // 2026-06-30 + 180
  })
})

/**
 * Tests del helper de días hábiles. Cubren la lógica que decide si una fecha
 * es laborable y la generación de los próximos N días hábiles a partir de una
 * fecha base.
 */

import { describe, it, expect } from 'vitest'
import { esDiaHabil, proximasFechasHabiles } from '../dias-habiles'

describe('esDiaHabil', () => {
  it('lunes a viernes sin feriado → true', () => {
    // 2026-05-04 es lunes
    expect(esDiaHabil(new Date('2026-05-04T12:00:00Z'), new Set())).toBe(true)
    // 2026-05-08 es viernes
    expect(esDiaHabil(new Date('2026-05-08T12:00:00Z'), new Set())).toBe(true)
  })

  it('sábado y domingo → false', () => {
    // 2026-05-09 es sábado
    expect(esDiaHabil(new Date('2026-05-09T12:00:00Z'), new Set())).toBe(false)
    // 2026-05-10 es domingo
    expect(esDiaHabil(new Date('2026-05-10T12:00:00Z'), new Set())).toBe(false)
  })

  it('feriado en día laboral → false', () => {
    const feriados = new Set(['2026-05-04'])
    expect(esDiaHabil(new Date('2026-05-04T12:00:00Z'), feriados)).toBe(false)
  })
})

describe('proximasFechasHabiles', () => {
  it('jueves cierre → viernes/lunes/martes (saltea fin de semana)', () => {
    // 2026-04-30 es jueves. Próximos 3 hábiles: vie 1-may, lun 4-may, mar 5-may.
    const cierre = new Date('2026-04-30T12:00:00Z')
    const fechas = proximasFechasHabiles(cierre, 3, new Set()).map(d => d.toISOString().split('T')[0])
    expect(fechas).toEqual(['2026-05-01', '2026-05-04', '2026-05-05'])
  })

  it('saltea feriado en medio del rango', () => {
    // 2026-04-30 es jueves. Si 1-may es feriado (típico Día del Trabajador):
    // hábiles: lun 4, mar 5, mié 6.
    const cierre = new Date('2026-04-30T12:00:00Z')
    const feriados = new Set(['2026-05-01'])
    const fechas = proximasFechasHabiles(cierre, 3, feriados).map(d => d.toISOString().split('T')[0])
    expect(fechas).toEqual(['2026-05-04', '2026-05-05', '2026-05-06'])
  })

  it('n=0 devuelve array vacío', () => {
    const cierre = new Date('2026-04-30T12:00:00Z')
    expect(proximasFechasHabiles(cierre, 0, new Set())).toEqual([])
  })
})

/**
 * Tests del cálculo de periodo relevante y periodo anterior.
 * Cubren la heurística temporal usada por las tools personales de Salix IA.
 */

import { describe, it, expect, vi } from 'vitest'
import { periodoAnterior, periodoRelevante } from '../periodo-relevante'
import { calcularPeriodo, type RangoPeriodo } from '../periodo-actual'

describe('periodoAnterior', () => {
  it('mayo (mensual) → abril', () => {
    const mayo: RangoPeriodo = {
      desde: '2026-05-01',
      hasta: '2026-05-31',
      etiqueta: 'Mayo 2026',
      tipo: 'mes',
    }
    const anterior = periodoAnterior(mayo)
    expect(anterior.desde).toBe('2026-04-01')
    expect(anterior.hasta).toBe('2026-04-30')
    expect(anterior.tipo).toBe('mes')
  })

  it('quincena 16-31 mayo → quincena 1-15 mayo', () => {
    const segunda: RangoPeriodo = {
      desde: '2026-05-16',
      hasta: '2026-05-31',
      etiqueta: 'Quincena 16-31 Mayo 2026',
      tipo: 'quincena',
    }
    const anterior = periodoAnterior(segunda)
    expect(anterior.desde).toBe('2026-05-01')
    expect(anterior.hasta).toBe('2026-05-15')
  })

  it('quincena 1-15 mayo → quincena 16-30 abril', () => {
    const primera: RangoPeriodo = {
      desde: '2026-05-01',
      hasta: '2026-05-15',
      etiqueta: 'Quincena 1-15 Mayo 2026',
      tipo: 'quincena',
    }
    const anterior = periodoAnterior(primera)
    expect(anterior.desde).toBe('2026-04-16')
    expect(anterior.hasta).toBe('2026-04-30')
  })
})

describe('periodoRelevante', () => {
  // Mock de Supabase admin que devuelve un pago según se le indique.
  function admin(pagoEncontrado: { monto_abonado: number } | null) {
    return {
      from: () => ({
        select: () => ({
          eq: function() { return this },
          is: function() { return this },
          maybeSingle: () => Promise.resolve({ data: pagoEncontrado, error: null }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('si el último cerrado NO está pagado → devuelve el cerrado', async () => {
    // 2 de mayo: el último mes cerrado es abril, sin pago.
    const fechaRef = new Date('2026-05-02T12:00:00Z')
    const resultado = await periodoRelevante(
      admin(null),
      { id: 'm-1', compensacion_frecuencia: 'mensual' },
      fechaRef,
    )
    expect(resultado.estado).toBe('cerrado_pendiente_pago')
    expect(resultado.rango.desde).toBe('2026-04-01')
    expect(resultado.rango.hasta).toBe('2026-04-30')
  })

  it('si el último cerrado YA está pagado → devuelve el actual', async () => {
    // 2 de mayo: abril ya cobrado, ergo el relevante es mayo en curso.
    const fechaRef = new Date('2026-05-02T12:00:00Z')
    const resultado = await periodoRelevante(
      admin({ monto_abonado: 100000 }),
      { id: 'm-1', compensacion_frecuencia: 'mensual' },
      fechaRef,
    )
    expect(resultado.estado).toBe('en_curso')
    expect(resultado.rango.desde).toBe('2026-05-01')
    expect(resultado.rango.hasta).toBe('2026-05-31')
  })
})

describe('calcularPeriodo (sanity para quincena cross-month)', () => {
  it('20 mayo (quincena 16-31)', () => {
    const r = calcularPeriodo(new Date('2026-05-20T12:00:00Z'), 'quincena')
    expect(r.desde).toBe('2026-05-16')
    expect(r.hasta).toBe('2026-05-31')
  })

  it('5 mayo (quincena 1-15)', () => {
    const r = calcularPeriodo(new Date('2026-05-05T12:00:00Z'), 'quincena')
    expect(r.desde).toBe('2026-05-01')
    expect(r.hasta).toBe('2026-05-15')
  })
})

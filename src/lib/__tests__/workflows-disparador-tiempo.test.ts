/**
 * Tests unit del módulo de disparadores tiempo (PR 17).
 *
 * Cubre:
 *   - parsearCron: válidos + inválidos.
 *   - matcheaCron: distintas expresiones contra fechas conocidas.
 *   - proximaEjecucion: REGLA CRÍTICA `ultima = null` → desde now()
 *     (no retroactivo).
 *   - cargarMatchsRelativoACampo: query construida correctamente
 *     contra la tabla, filtros aplicados.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  parsearCron,
  matcheaCron,
  proximaEjecucion,
  cargarMatchsRelativoACampo,
  CronInvalidoError,
} from '../workflows/disparador-tiempo'

// =============================================================
// parsearCron
// =============================================================

describe('parsearCron', () => {
  it('cinco asteriscos = todo', () => {
    const p = parsearCron('* * * * *')
    expect(p.minutos.size).toBe(60)
    expect(p.horas.size).toBe(24)
    expect(p.diasMes.size).toBe(31)
    expect(p.meses.size).toBe(12)
    expect(p.diasSemana.size).toBe(7)
  })

  it('valor literal', () => {
    const p = parsearCron('30 14 * * *')
    expect([...p.minutos]).toEqual([30])
    expect([...p.horas]).toEqual([14])
  })

  it('rango N-M', () => {
    const p = parsearCron('* * * * 1-5')
    expect([...p.diasSemana].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('lista N,M,O', () => {
    const p = parsearCron('0 9,12,18 * * *')
    expect([...p.horas].sort((a, b) => a - b)).toEqual([9, 12, 18])
  })

  it('step */N sobre todo el rango', () => {
    const p = parsearCron('*/15 * * * *')
    expect([...p.minutos].sort((a, b) => a - b)).toEqual([0, 15, 30, 45])
  })

  it('step en rango N-M/S', () => {
    const p = parsearCron('* 9-17/2 * * *')
    expect([...p.horas].sort((a, b) => a - b)).toEqual([9, 11, 13, 15, 17])
  })

  it('rechaza expresión con < 5 campos', () => {
    expect(() => parsearCron('* * * *')).toThrow(CronInvalidoError)
  })

  it('rechaza valor fuera de rango', () => {
    expect(() => parsearCron('60 * * * *')).toThrow(CronInvalidoError)
    expect(() => parsearCron('* 24 * * *')).toThrow(CronInvalidoError)
  })

  it('rechaza step <= 0', () => {
    expect(() => parsearCron('*/0 * * * *')).toThrow(CronInvalidoError)
  })
})

// =============================================================
// matcheaCron
// =============================================================

describe('matcheaCron', () => {
  it('* * * * * matchea cualquier fecha', () => {
    const p = parsearCron('* * * * *')
    expect(matcheaCron(p, new Date('2026-05-04T14:30:00Z'))).toBe(true)
    expect(matcheaCron(p, new Date('2027-01-01T00:00:00Z'))).toBe(true)
  })

  it('0 9 * * * matchea solo a las 9:00 UTC', () => {
    const p = parsearCron('0 9 * * *')
    expect(matcheaCron(p, new Date('2026-05-04T09:00:00Z'))).toBe(true)
    expect(matcheaCron(p, new Date('2026-05-04T09:01:00Z'))).toBe(false)
    expect(matcheaCron(p, new Date('2026-05-04T08:59:00Z'))).toBe(false)
    expect(matcheaCron(p, new Date('2026-05-05T09:00:00Z'))).toBe(true)
  })

  it('1-5 en día_semana matchea lun-vie', () => {
    const p = parsearCron('0 9 * * 1-5')
    // 2026-05-04 es lunes
    expect(matcheaCron(p, new Date('2026-05-04T09:00:00Z'))).toBe(true)
    // 2026-05-09 es sábado
    expect(matcheaCron(p, new Date('2026-05-09T09:00:00Z'))).toBe(false)
    // 2026-05-10 es domingo
    expect(matcheaCron(p, new Date('2026-05-10T09:00:00Z'))).toBe(false)
  })

  it('*/15 matchea cada 15 minutos', () => {
    const p = parsearCron('*/15 * * * *')
    expect(matcheaCron(p, new Date('2026-05-04T14:00:00Z'))).toBe(true)
    expect(matcheaCron(p, new Date('2026-05-04T14:15:00Z'))).toBe(true)
    expect(matcheaCron(p, new Date('2026-05-04T14:30:00Z'))).toBe(true)
    expect(matcheaCron(p, new Date('2026-05-04T14:45:00Z'))).toBe(true)
    expect(matcheaCron(p, new Date('2026-05-04T14:01:00Z'))).toBe(false)
    expect(matcheaCron(p, new Date('2026-05-04T14:14:00Z'))).toBe(false)
  })
})

// =============================================================
// proximaEjecucion — REGLA CRÍTICA NULL=now()
// =============================================================

describe('proximaEjecucion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('REGLA CRÍTICA: ultima=null parte desde ahora, NO retroactivo', () => {
    // Caso del comentario en el código:
    // Usuario crea flujo `0 9 * * *` a las 09:00:30 UTC.
    // `ultima_ejecucion_tiempo` = null porque nunca disparó.
    // Esperamos: primer disparo es MAÑANA 9am, no hoy en el tick siguiente.
    const ahora = new Date('2026-05-04T09:00:30Z')
    vi.setSystemTime(ahora)

    const proxima = proximaEjecucion('0 9 * * *', null, ahora)

    expect(proxima).not.toBeNull()
    expect(proxima!.toISOString()).toBe('2026-05-05T09:00:00.000Z')
  })

  it('ultima=null + ahora antes de la primera ventana del día → dispara hoy', () => {
    // Si el usuario crea el flujo a las 8:30am, la ventana de 9am
    // de HOY todavía no pasó → primer disparo hoy 9am.
    const ahora = new Date('2026-05-04T08:30:00Z')
    vi.setSystemTime(ahora)

    const proxima = proximaEjecucion('0 9 * * *', null, ahora)
    expect(proxima!.toISOString()).toBe('2026-05-04T09:00:00.000Z')
  })

  it('ultima presente: arranca desde ultima + 1 minuto', () => {
    const ahora = new Date('2026-05-04T10:00:00Z')
    vi.setSystemTime(ahora)
    // Última ejecución fue hoy 9am. Siguiente: mañana 9am.
    const proxima = proximaEjecucion(
      '0 9 * * *',
      '2026-05-04T09:00:00Z',
      ahora,
    )
    expect(proxima!.toISOString()).toBe('2026-05-05T09:00:00.000Z')
  })

  it('cron atrasado: si la próxima desde ultima ya pasó, devuelve esa fecha en el pasado', () => {
    // Caso: el cron estuvo caído 2 horas. Última ejecución 9am.
    // Próxima debería haber sido a las 10am (cron */1 hora). Ahora es 11:30am.
    // proximaEjecucion devuelve 10am (en el pasado), y el endpoint
    // ve proxima <= ahora → dispara la ventana perdida.
    const ahora = new Date('2026-05-04T11:30:00Z')
    vi.setSystemTime(ahora)
    const proxima = proximaEjecucion(
      '0 * * * *', // cada hora en punto
      '2026-05-04T09:00:00Z',
      ahora,
    )
    expect(proxima!.toISOString()).toBe('2026-05-04T10:00:00.000Z')
  })

  it('expresión inválida → null', () => {
    const r = proximaEjecucion('not a cron', null, new Date('2026-05-04T09:00:00Z'))
    expect(r).toBeNull()
  })
})

// =============================================================
// cargarMatchsRelativoACampo
// =============================================================

describe('cargarMatchsRelativoACampo', () => {
  it('construye query con WHERE campo_fecha en el rango correcto', async () => {
    let queryCapturada: { tabla?: string; gte?: [string, string]; lt?: [string, string]; in?: [string, string[]]; eq?: [string, string] } = {}
    const admin = {
      from: vi.fn((tabla: string) => {
        queryCapturada.tabla = tabla
        const builder: Record<string, unknown> = {
          select: vi.fn(() => builder),
          eq: vi.fn((col: string, val: string) => {
            queryCapturada.eq = [col, val]
            return builder
          }),
          gte: vi.fn((col: string, val: string) => {
            queryCapturada.gte = [col, val]
            return builder
          }),
          lt: vi.fn((col: string, val: string) => {
            queryCapturada.lt = [col, val]
            return builder
          }),
          in: vi.fn((col: string, val: string[]) => {
            queryCapturada.in = [col, val]
            return builder
          }),
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: [{ id: 'cuota-1' }, { id: 'cuota-2' }], error: null }),
        }
        return builder
      }),
    }

    const r = await cargarMatchsRelativoACampo(
      {
        id: 'flujo-1',
        empresa_id: 'emp-1',
        disparador: {
          tipo: 'tiempo.relativo_a_campo',
          configuracion: {
            entidad_tipo: 'cuota',
            campo_fecha: 'fecha_vencimiento',
            delta_dias: -3,
            filtro_estado_clave: ['pendiente', 'parcial'],
          },
        },
      },
      'America/Argentina/Buenos_Aires',
      new Date('2026-05-04T18:00:00Z'),
      admin as never,
    )

    expect(r).toHaveLength(2)
    expect(r[0].entidad_id).toBe('cuota-1')
    expect(queryCapturada.tabla).toBe('presupuesto_cuotas')
    expect(queryCapturada.eq).toEqual(['empresa_id', 'emp-1'])
    // hoy local en BA es 2026-05-04, delta -3 → buscar fechas = 2026-05-07.
    expect(queryCapturada.gte?.[0]).toBe('fecha_vencimiento')
    expect(queryCapturada.gte?.[1]).toBe('2026-05-07')
    expect(queryCapturada.lt?.[0]).toBe('fecha_vencimiento')
    expect(queryCapturada.lt?.[1]).toBe('2026-05-08')
    expect(queryCapturada.in).toEqual(['estado_clave', ['pendiente', 'parcial']])
  })

  it('tolerancia_dias amplía el rango hacia atrás', async () => {
    let queryCapturada: { gte?: [string, string]; lt?: [string, string] } = {}
    const admin = {
      from: vi.fn(() => {
        const builder: Record<string, unknown> = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          gte: vi.fn((col: string, val: string) => {
            queryCapturada.gte = [col, val]
            return builder
          }),
          lt: vi.fn((col: string, val: string) => {
            queryCapturada.lt = [col, val]
            return builder
          }),
          in: vi.fn(() => builder),
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: [], error: null }),
        }
        return builder
      }),
    }

    await cargarMatchsRelativoACampo(
      {
        id: 'f',
        empresa_id: 'e',
        disparador: {
          tipo: 'tiempo.relativo_a_campo',
          configuracion: {
            entidad_tipo: 'cuota',
            campo_fecha: 'fecha_vencimiento',
            delta_dias: -3,
            tolerancia_dias: 2,
          },
        },
      },
      'America/Argentina/Buenos_Aires',
      new Date('2026-05-04T18:00:00Z'),
      admin as never,
    )

    // Con tolerancia 2: rango = [2026-05-05, 2026-05-08)
    expect(queryCapturada.gte?.[1]).toBe('2026-05-05')
    expect(queryCapturada.lt?.[1]).toBe('2026-05-08')
  })
})

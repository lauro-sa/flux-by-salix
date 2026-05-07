/**
 * Tests de helpers puros del historial (sub-PR 19.6).
 *
 * Verifica colorEstadoEjecucion, duracionSegundos, formatearDuracion
 * y tipoDisparadoPor — funciones puras que el listado, drawer y
 * chatter consumen.
 */

import { describe, expect, it } from 'vitest'
import { ESTADOS_EJECUCION } from '@/tipos/workflow'
import {
  colorEstadoEjecucion,
  duracionSegundos,
  formatearDuracion,
  tipoDisparadoPor,
} from '@/app/(flux)/flujos/[id]/_componentes/_historial/formato-ejecucion'

describe('colorEstadoEjecucion', () => {
  it('mapea cada EstadoEjecucion a un ColorInsignia válido', () => {
    // No nos importa el valor exacto del color (puede cambiar por
    // diseño); sólo que devuelva algo no-undefined para todos.
    for (const estado of ESTADOS_EJECUCION) {
      const color = colorEstadoEjecucion(estado)
      expect(color, `falta color para estado: ${estado}`).toBeTruthy()
    }
  })

  it('estado completado mapea a exito y fallado a peligro', () => {
    expect(colorEstadoEjecucion('completado')).toBe('exito')
    expect(colorEstadoEjecucion('fallado')).toBe('peligro')
  })
})

describe('duracionSegundos', () => {
  it('retorna null si falta inicio_en', () => {
    expect(duracionSegundos(null, '2026-05-07T10:00:01Z')).toBeNull()
  })

  it('retorna null si falta fin_en', () => {
    expect(duracionSegundos('2026-05-07T10:00:00Z', null)).toBeNull()
  })

  it('retorna duración positiva en segundos', () => {
    const dur = duracionSegundos(
      '2026-05-07T10:00:00Z',
      '2026-05-07T10:00:01.500Z',
    )
    expect(dur).toBeCloseTo(1.5, 3)
  })

  it('retorna null si fin es anterior al inicio (clock skew o data corrupta)', () => {
    expect(
      duracionSegundos(
        '2026-05-07T10:00:01Z',
        '2026-05-07T10:00:00Z',
      ),
    ).toBeNull()
  })
})

describe('formatearDuracion', () => {
  it('null se muestra como em-dash', () => {
    expect(formatearDuracion(null)).toBe('—')
  })

  it('valores < 1s en milisegundos', () => {
    expect(formatearDuracion(0.123)).toBe('123ms')
    expect(formatearDuracion(0.5)).toBe('500ms')
  })

  it('valores < 60s en segundos con decimales', () => {
    expect(formatearDuracion(1.5)).toMatch(/^1\.5\d?s$/)
    expect(formatearDuracion(45)).toMatch(/^45\.\ds$/)
  })

  it('valores >= 60s en minutos y segundos', () => {
    expect(formatearDuracion(60)).toBe('1m 0s')
    expect(formatearDuracion(125)).toBe('2m 5s')
  })
})

describe('tipoDisparadoPor', () => {
  it('parsea prefijos válidos', () => {
    expect(tipoDisparadoPor('manual:user-1')).toBe('manual')
    expect(tipoDisparadoPor('cron:0 9 * * *')).toBe('cron')
    expect(tipoDisparadoPor('cambios_estado:cambio-1')).toBe('cambios_estado')
    expect(tipoDisparadoPor('webhook:https://example.com')).toBe('webhook')
  })

  it('null o vacío retorna null', () => {
    expect(tipoDisparadoPor(null)).toBeNull()
    expect(tipoDisparadoPor('')).toBeNull()
  })

  it('prefijo desconocido retorna null', () => {
    expect(tipoDisparadoPor('foo:bar')).toBeNull()
  })
})

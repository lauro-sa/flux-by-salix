/**
 * Tests unit de evaluarTransicion (PR 18.2).
 *
 * Cubrimos la matriz completa: 4 transiciones × 3 estados × 2
 * (con/sin borrador) = 24 combinaciones. Asserts explícitos por
 * combinación así un cambio futuro en la matriz se nota inmediato.
 */

import { describe, expect, it } from 'vitest'
import {
  evaluarTransicion,
  type TransicionFlujo,
} from '../workflows/transiciones-flujo'
import type { EstadoFlujo } from '@/tipos/workflow'

const ESTADOS: EstadoFlujo[] = ['borrador', 'activo', 'pausado']
const BORRADORES = [false, true]
const TRANSICIONES: TransicionFlujo[] = [
  'publicar',
  'descartar_borrador',
  'activar',
  'pausar',
]

describe('evaluarTransicion — publicar', () => {
  it('rechaza con sin_borrador cuando no hay borrador, en cualquier estado', () => {
    for (const estado of ESTADOS) {
      const r = evaluarTransicion(estado, false, 'publicar')
      expect(r.permitida).toBe(false)
      expect(r.error?.codigo).toBe('sin_borrador')
    }
  })

  it('acepta cuando hay borrador, en cualquier estado (incluido borrador → publicar el contenido del borrador interno)', () => {
    for (const estado of ESTADOS) {
      const r = evaluarTransicion(estado, true, 'publicar')
      expect(r.permitida).toBe(true)
      expect(r.error).toBeUndefined()
      expect(r.requierePublicar).toBeUndefined()
    }
  })
})

describe('evaluarTransicion — descartar_borrador', () => {
  it('rechaza con sin_borrador cuando no hay borrador', () => {
    for (const estado of ESTADOS) {
      const r = evaluarTransicion(estado, false, 'descartar_borrador')
      expect(r.permitida).toBe(false)
      expect(r.error?.codigo).toBe('sin_borrador')
    }
  })

  it('acepta cuando hay borrador, en cualquier estado', () => {
    for (const estado of ESTADOS) {
      const r = evaluarTransicion(estado, true, 'descartar_borrador')
      expect(r.permitida).toBe(true)
    }
  })
})

describe('evaluarTransicion — activar', () => {
  it('rechaza con ya_activo cuando estado ya es activo (con o sin borrador)', () => {
    for (const tieneBorrador of BORRADORES) {
      const r = evaluarTransicion('activo', tieneBorrador, 'activar')
      expect(r.permitida).toBe(false)
      expect(r.error?.codigo).toBe('ya_activo')
    }
  })

  it('acepta desde borrador sin borrador → no requiere publicar', () => {
    const r = evaluarTransicion('borrador', false, 'activar')
    expect(r.permitida).toBe(true)
    expect(r.requierePublicar).toBe(false)
  })

  it('acepta desde borrador con borrador → requiere publicar', () => {
    const r = evaluarTransicion('borrador', true, 'activar')
    expect(r.permitida).toBe(true)
    expect(r.requierePublicar).toBe(true)
  })

  it('acepta desde pausado sin borrador → no requiere publicar', () => {
    const r = evaluarTransicion('pausado', false, 'activar')
    expect(r.permitida).toBe(true)
    expect(r.requierePublicar).toBe(false)
  })

  it('acepta desde pausado con borrador → requiere publicar', () => {
    const r = evaluarTransicion('pausado', true, 'activar')
    expect(r.permitida).toBe(true)
    expect(r.requierePublicar).toBe(true)
  })
})

describe('evaluarTransicion — pausar', () => {
  it('rechaza desde borrador con no_se_puede_pausar_borrador (con o sin borrador)', () => {
    for (const tieneBorrador of BORRADORES) {
      const r = evaluarTransicion('borrador', tieneBorrador, 'pausar')
      expect(r.permitida).toBe(false)
      expect(r.error?.codigo).toBe('no_se_puede_pausar_borrador')
    }
  })

  it('rechaza desde pausado con ya_pausado', () => {
    for (const tieneBorrador of BORRADORES) {
      const r = evaluarTransicion('pausado', tieneBorrador, 'pausar')
      expect(r.permitida).toBe(false)
      expect(r.error?.codigo).toBe('ya_pausado')
    }
  })

  it('acepta desde activo (con o sin borrador)', () => {
    for (const tieneBorrador of BORRADORES) {
      const r = evaluarTransicion('activo', tieneBorrador, 'pausar')
      expect(r.permitida).toBe(true)
      expect(r.requierePublicar).toBeUndefined()
    }
  })
})

describe('evaluarTransicion — matriz completa', () => {
  it('cada combinación devuelve un ResultadoTransicion bien formado', () => {
    let total = 0
    for (const estado of ESTADOS) {
      for (const tieneBorrador of BORRADORES) {
        for (const transicion of TRANSICIONES) {
          const r = evaluarTransicion(estado, tieneBorrador, transicion)
          total += 1
          // Invariantes:
          expect(typeof r.permitida).toBe('boolean')
          if (r.permitida) {
            expect(r.error).toBeUndefined()
          } else {
            expect(r.error?.codigo).toBeTruthy()
            expect(r.error?.mensaje?.length).toBeGreaterThan(0)
          }
          // requierePublicar solo aparece en activar permitida.
          if (r.requierePublicar !== undefined) {
            expect(transicion).toBe('activar')
            expect(r.permitida).toBe(true)
          }
        }
      }
    }
    expect(total).toBe(24)
  })
})

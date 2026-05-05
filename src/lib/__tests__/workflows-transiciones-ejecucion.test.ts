/**
 * Tests unit de transiciones de ejecución (PR 18.3).
 *
 * Cubrimos los 6 estados × 2 transiciones = 12 combinaciones,
 * más invariantes (mensajes legibles, códigos correctos).
 */

import { describe, expect, it } from 'vitest'
import {
  puedeReejecutar,
  puedeCancelar,
} from '../workflows/transiciones-ejecucion'
import { ESTADOS_EJECUCION, type EstadoEjecucion } from '@/tipos/workflow'

describe('puedeReejecutar', () => {
  it('acepta completado, fallado, cancelado', () => {
    expect(puedeReejecutar('completado').ok).toBe(true)
    expect(puedeReejecutar('fallado').ok).toBe(true)
    expect(puedeReejecutar('cancelado').ok).toBe(true)
  })

  it('rechaza pendiente con estado_invalido', () => {
    const r = puedeReejecutar('pendiente')
    expect(r.ok).toBe(false)
    expect(r.codigo).toBe('estado_invalido')
    expect(r.mensaje).toMatch(/pendiente/)
  })

  it('rechaza corriendo y esperando con estado_invalido', () => {
    expect(puedeReejecutar('corriendo').codigo).toBe('estado_invalido')
    expect(puedeReejecutar('esperando').codigo).toBe('estado_invalido')
  })

  it('todos los rechazos incluyen un mensaje legible', () => {
    for (const estado of ESTADOS_EJECUCION as readonly EstadoEjecucion[]) {
      const r = puedeReejecutar(estado)
      if (!r.ok) {
        expect(r.mensaje).toBeTruthy()
        expect(r.mensaje!.length).toBeGreaterThan(20)
      }
    }
  })
})

describe('puedeCancelar', () => {
  it('acepta pendiente y esperando', () => {
    expect(puedeCancelar('pendiente').ok).toBe(true)
    expect(puedeCancelar('esperando').ok).toBe(true)
  })

  it('rechaza corriendo con código específico corriendo_no_cancelable', () => {
    const r = puedeCancelar('corriendo')
    expect(r.ok).toBe(false)
    expect(r.codigo).toBe('corriendo_no_cancelable')
    // Mensaje educativo: explica POR QUÉ se bloquea.
    expect(r.mensaje).toMatch(/medio enviar|notificar|terminar/i)
  })

  it('rechaza completado, fallado y cancelado con ya_terminada', () => {
    expect(puedeCancelar('completado').codigo).toBe('ya_terminada')
    expect(puedeCancelar('fallado').codigo).toBe('ya_terminada')
    expect(puedeCancelar('cancelado').codigo).toBe('ya_terminada')
  })
})

describe('matriz completa — invariantes', () => {
  it('cada estado del catálogo da una respuesta determinada en ambos helpers', () => {
    let total = 0
    for (const estado of ESTADOS_EJECUCION as readonly EstadoEjecucion[]) {
      const r1 = puedeReejecutar(estado)
      const r2 = puedeCancelar(estado)
      total += 1
      // Si ok, no hay código ni mensaje. Si !ok, ambos están presentes.
      if (r1.ok) {
        expect(r1.codigo).toBeUndefined()
      } else {
        expect(r1.codigo).toBeTruthy()
        expect(r1.mensaje).toBeTruthy()
      }
      if (r2.ok) {
        expect(r2.codigo).toBeUndefined()
      } else {
        expect(r2.codigo).toBeTruthy()
        expect(r2.mensaje).toBeTruthy()
      }
    }
    expect(total).toBe(6)
  })

  it('los estados que reejecutan NO se pueden cancelar (son terminales)', () => {
    for (const estado of ['completado', 'fallado', 'cancelado'] as EstadoEjecucion[]) {
      expect(puedeReejecutar(estado).ok).toBe(true)
      expect(puedeCancelar(estado).ok).toBe(false)
    }
  })

  it('los estados que cancelan NO se pueden reejecutar (en vuelo)', () => {
    for (const estado of ['pendiente', 'esperando'] as EstadoEjecucion[]) {
      expect(puedeCancelar(estado).ok).toBe(true)
      expect(puedeReejecutar(estado).ok).toBe(false)
    }
  })
})

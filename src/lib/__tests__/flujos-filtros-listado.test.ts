/**
 * Tests de los helpers puros de filtros del listado de flujos
 * (sub-PR 19.7). Cubren el patrón "CSV → array" y la traducción
 * a expresión PostgREST `.or()` para campos JSONB.
 *
 * El consumidor real (route handler de `/api/flujos`) decide entre
 * `.eq` para 1 valor y `.or(...)` para multi. Acá solo verificamos
 * que el helper devuelva la lista limpia y que la expresión generada
 * sea la que espera el caller (sin reconstruir el query builder).
 */

import { describe, expect, it } from 'vitest'
import { parsearCSV, expresionORJsonPath } from '@/lib/workflows/filtros-listado'

describe('parsearCSV', () => {
  it('devuelve array vacío para null, undefined o string vacía', () => {
    expect(parsearCSV(null)).toEqual([])
    expect(parsearCSV(undefined)).toEqual([])
    expect(parsearCSV('')).toEqual([])
  })

  it('devuelve un solo valor cuando no hay coma', () => {
    expect(parsearCSV('presupuesto')).toEqual(['presupuesto'])
  })

  it('parsea múltiples valores y limpia espacios', () => {
    expect(parsearCSV('presupuesto,cuota')).toEqual(['presupuesto', 'cuota'])
    expect(parsearCSV(' presupuesto , cuota ')).toEqual(['presupuesto', 'cuota'])
  })

  it('descarta entradas vacías por comas seguidas', () => {
    expect(parsearCSV('presupuesto,,cuota,')).toEqual(['presupuesto', 'cuota'])
  })

  it('mantiene el orden de entrada', () => {
    expect(parsearCSV('c,a,b')).toEqual(['c', 'a', 'b'])
  })
})

describe('expresionORJsonPath', () => {
  it('genera la expresión .or para un solo path con un valor', () => {
    const expr = expresionORJsonPath(['presupuesto'], 'disparador->configuracion->>entidad_tipo')
    expect(expr).toBe('disparador->configuracion->>entidad_tipo.eq.presupuesto')
  })

  it('genera la expresión .or para múltiples valores con coma como separador', () => {
    const expr = expresionORJsonPath(
      ['presupuesto', 'cuota'],
      'disparador->configuracion->>entidad_tipo',
    )
    expect(expr).toBe(
      'disparador->configuracion->>entidad_tipo.eq.presupuesto,disparador->configuracion->>entidad_tipo.eq.cuota',
    )
  })

  it('preserva el orden de entrada en la expresión', () => {
    const expr = expresionORJsonPath(['c', 'a', 'b'], 'disparador->>tipo')
    expect(expr).toBe(
      'disparador->>tipo.eq.c,disparador->>tipo.eq.a,disparador->>tipo.eq.b',
    )
  })

  it('funciona con cualquier path PostgREST, no solo entidad_tipo', () => {
    // Este helper no es específico de entidad_tipo. Si más adelante
    // alguien lo reusa con otro path JSON, debe seguir funcionando.
    const expr = expresionORJsonPath(
      ['inbox.mensaje_recibido', 'inbox.conversacion_sin_respuesta'],
      'disparador->>tipo',
    )
    expect(expr).toBe(
      'disparador->>tipo.eq.inbox.mensaje_recibido,disparador->>tipo.eq.inbox.conversacion_sin_respuesta',
    )
  })
})

describe('integración: parsearCSV + expresionORJsonPath', () => {
  // Patrón del route handler: leer searchParams, parsear, y si hay
  // multi armar la expresión OR. Acá lo simulamos a mano para fijar
  // el contrato de uso.

  it('flow típico de "?modulo=presupuesto,cuota" termina en expresión válida', () => {
    const valores = parsearCSV('presupuesto,cuota')
    expect(valores.length).toBe(2)
    const expr = expresionORJsonPath(valores, 'disparador->configuracion->>entidad_tipo')
    expect(expr).toContain('eq.presupuesto')
    expect(expr).toContain('eq.cuota')
    expect(expr.split(',').length).toBe(2)
  })

  it('flow típico de "?modulo=presupuesto" da un solo valor (caller usa .eq directo)', () => {
    const valores = parsearCSV('presupuesto')
    expect(valores).toEqual(['presupuesto'])
    // El caller bifurca a .eq cuando length === 1, pero el helper
    // acepta llamarse con 1 valor sin romper.
    const expr = expresionORJsonPath(valores, 'disparador->configuracion->>entidad_tipo')
    expect(expr).toBe('disparador->configuracion->>entidad_tipo.eq.presupuesto')
  })

  it('flow "?modulo=" (vacío) devuelve array vacío para que caller no aplique filtro', () => {
    const valores = parsearCSV('')
    expect(valores).toEqual([])
  })
})

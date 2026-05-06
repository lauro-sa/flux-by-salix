/**
 * Tests del builder de condiciones del Branch (sub-PR 19.3c).
 *
 * Cubre las dos piezas puras del builder:
 *   1. `OPERADORES_BUILDER` — catálogo de operadores expuestos por la UI.
 *      Validamos cobertura de los 10 operadores listados en plan §1.7.3
 *      y el mapping correcto a `OperadorComparacion` del motor.
 *   2. `definicionDeOperador` — lookup tolerante.
 *
 * El componente `PanelBranch` no se testea como unidad (UI compleja),
 * pero su lógica de "siempre envolver en CondicionCompuesta" se valida
 * indirectamente al testear los operadores que el builder usa.
 */

import { describe, expect, it } from 'vitest'
import {
  OPERADORES_BUILDER,
  definicionDeOperador,
} from '@/app/(flux)/flujos/[id]/_componentes/_panel/secciones/_branch/operadores'

describe('OPERADORES_BUILDER · catálogo de operadores expuestos', () => {
  it('expone exactamente 10 operadores (plan §1.7.3)', () => {
    expect(OPERADORES_BUILDER).toHaveLength(10)
  })

  it('cada operador tiene mapping al motor + clave i18n + flag requiereValor', () => {
    for (const op of OPERADORES_BUILDER) {
      expect(typeof op.motor).toBe('string')
      expect(op.simbolo.length).toBeGreaterThan(0)
      expect(op.claveI18nEtiqueta).toMatch(/^flujos\.editor\.panel\.branch\.op\./)
      expect(typeof op.requiereValor).toBe('boolean')
    }
  })

  it('los operadores unarios (existe / no_existe) NO requieren valor', () => {
    const existe = OPERADORES_BUILDER.find((o) => o.motor === 'existe')!
    const noExiste = OPERADORES_BUILDER.find((o) => o.motor === 'no_existe')!
    expect(existe.requiereValor).toBe(false)
    expect(noExiste.requiereValor).toBe(false)
  })

  it('los operadores binarios SÍ requieren valor', () => {
    const binarios = ['igual', 'distinto', 'mayor', 'menor', 'mayor_o_igual', 'menor_o_igual', 'contiene', 'no_contiene']
    for (const motor of binarios) {
      const def = OPERADORES_BUILDER.find((o) => o.motor === motor)
      expect(def, `falta operador ${motor}`).toBeDefined()
      expect(def!.requiereValor).toBe(true)
    }
  })

  it('los símbolos son distinguibles entre sí (no hay duplicados)', () => {
    const simbolos = OPERADORES_BUILDER.map((o) => o.simbolo)
    expect(new Set(simbolos).size).toBe(OPERADORES_BUILDER.length)
  })

  it('cubre exactamente las etiquetas del plan §1.7.3', () => {
    // El plan lista: =, ≠, >, <, ≥, ≤, contiene, empieza con, está vacío,
    // no está vacío. "empieza con" se difiere a 19.3d (no hay operador
    // motor directo). El builder cubre los otros 9 + "no contiene" como
    // bonus inverso.
    const motoresEsperados = [
      'igual',
      'distinto',
      'mayor',
      'menor',
      'mayor_o_igual',
      'menor_o_igual',
      'contiene',
      'no_contiene',
      'no_existe', // = "está vacío"
      'existe',    // = "no está vacío"
    ]
    expect(OPERADORES_BUILDER.map((o) => o.motor).sort()).toEqual(motoresEsperados.sort())
  })
})

describe('definicionDeOperador · lookup tolerante', () => {
  it('encuentra un operador conocido', () => {
    const def = definicionDeOperador('mayor')
    expect(def.simbolo).toBe('>')
    expect(def.requiereValor).toBe(true)
  })

  it('devuelve "igual" como fallback si el operador es desconocido', () => {
    // El cast es deliberado: simulamos un valor inválido del JSON.
    const def = definicionDeOperador('inexistente' as never)
    expect(def.motor).toBe('igual')
  })
})

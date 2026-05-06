/**
 * Tests de las mutaciones puras del árbol de pasos (sub-PR 19.3a).
 *
 * Verifican:
 *   • Inmutabilidad: las funciones no mutan el array de entrada.
 *   • Identidad de dnd-kit: el id del paso editado se preserva incluso
 *     si el parche intentara cambiarlo.
 *   • Cobertura de los tres lugares posibles del paso (raíz, rama si,
 *     rama no, anidado).
 *   • No-op cuando el id no existe (sin lanzar).
 */

import { describe, expect, it } from 'vitest'
import {
  actualizarPasoPorId,
  eliminarPasoPorId,
} from '@/lib/workflows/mutaciones-pasos'
import type { AccionConId } from '@/lib/workflows/ids-pasos'
import type { AccionWorkflow } from '@/tipos/workflow'

function paso(id: string, duracion = 60_000): AccionConId {
  return { id, tipo: 'esperar', duracion_ms: duracion } as AccionConId
}

function branch(id: string, si: AccionConId[], no: AccionConId[]): AccionConId {
  return {
    id,
    tipo: 'condicion_branch',
    condicion: { campo: 'x', operador: 'igual', valor: 'y' },
    acciones_si: si as unknown as AccionWorkflow[],
    acciones_no: no as unknown as AccionWorkflow[],
  } as AccionConId
}

describe('actualizarPasoPorId', () => {
  it('aplica el parche a un paso de la raíz sin tocar los hermanos', () => {
    const arbol = [paso('a', 1000), paso('b', 2000), paso('c', 3000)]
    const result = actualizarPasoPorId(arbol, 'b', { duracion_ms: 99_999 } as Partial<AccionWorkflow>)

    expect((result[0] as { duracion_ms: number }).duracion_ms).toBe(1000)
    expect((result[1] as { duracion_ms: number }).duracion_ms).toBe(99_999)
    expect((result[2] as { duracion_ms: number }).duracion_ms).toBe(3000)
  })

  it('preserva el id del paso aunque venga uno nuevo en el parche', () => {
    const arbol = [paso('a', 1000)]
    const result = actualizarPasoPorId(
      arbol,
      'a',
      { id: 'pirata' } as unknown as Partial<AccionWorkflow>,
    )
    expect(result[0].id).toBe('a')
  })

  it('no muta el array original ni los pasos', () => {
    const original = paso('a', 1000)
    const arbol = [original]
    const result = actualizarPasoPorId(arbol, 'a', { duracion_ms: 7777 } as Partial<AccionWorkflow>)
    expect(arbol[0]).toBe(original)
    expect((arbol[0] as { duracion_ms: number }).duracion_ms).toBe(1000)
    expect(result[0]).not.toBe(original)
  })

  it('actualiza un paso dentro de una rama "Si SÍ" sin tocar la otra rama', () => {
    const arbol = [
      branch('br', [paso('s1', 1000), paso('s2', 2000)], [paso('n1', 3000)]),
    ]
    const result = actualizarPasoPorId(
      arbol,
      's2',
      { duracion_ms: 50_000 } as Partial<AccionWorkflow>,
    )
    const branchActualizado = result[0] as AccionConId & {
      acciones_si: AccionConId[]
      acciones_no: AccionConId[]
    }
    expect(
      (branchActualizado.acciones_si[1] as { duracion_ms: number }).duracion_ms,
    ).toBe(50_000)
    expect(
      (branchActualizado.acciones_no[0] as { duracion_ms: number }).duracion_ms,
    ).toBe(3000)
  })

  it('actualiza un paso en branches anidados', () => {
    const arbol = [
      branch(
        'br-out',
        [paso('externo')],
        [branch('br-in', [paso('objetivo', 1000)], [])],
      ),
    ]
    const result = actualizarPasoPorId(
      arbol,
      'objetivo',
      { duracion_ms: 8888 } as Partial<AccionWorkflow>,
    )
    const out = result[0] as AccionConId & { acciones_no: AccionConId[] }
    const inn = out.acciones_no[0] as AccionConId & { acciones_si: AccionConId[] }
    expect((inn.acciones_si[0] as { duracion_ms: number }).duracion_ms).toBe(8888)
  })

  it('no-op cuando el id no existe (devuelve un árbol equivalente sin lanzar)', () => {
    const arbol = [paso('a', 1000)]
    const result = actualizarPasoPorId(arbol, 'inexistente', {
      duracion_ms: 9999,
    } as Partial<AccionWorkflow>)
    expect((result[0] as { duracion_ms: number }).duracion_ms).toBe(1000)
  })
})

describe('eliminarPasoPorId', () => {
  it('elimina un paso de la raíz', () => {
    const arbol = [paso('a'), paso('b'), paso('c')]
    const result = eliminarPasoPorId(arbol, 'b')
    expect(result.map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('elimina un paso de una rama "Si NO"', () => {
    const arbol = [branch('br', [paso('s')], [paso('n1'), paso('n2')])]
    const result = eliminarPasoPorId(arbol, 'n1')
    const br = result[0] as AccionConId & { acciones_no: AccionConId[] }
    expect(br.acciones_no.map((p) => p.id)).toEqual(['n2'])
  })

  it('al eliminar un branch lo borra entero junto con sus ramas', () => {
    const arbol = [paso('a'), branch('br', [paso('s')], [paso('n')]), paso('c')]
    const result = eliminarPasoPorId(arbol, 'br')
    expect(result.map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('no muta el array original', () => {
    const arbol = [paso('a'), paso('b')]
    const lenAntes = arbol.length
    eliminarPasoPorId(arbol, 'a')
    expect(arbol.length).toBe(lenAntes)
    expect(arbol.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('no-op cuando el id no existe (devuelve árbol equivalente)', () => {
    const arbol = [paso('a'), paso('b')]
    const result = eliminarPasoPorId(arbol, 'inexistente')
    expect(result.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

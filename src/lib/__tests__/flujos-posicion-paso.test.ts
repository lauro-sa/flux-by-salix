/**
 * Tests del helper `posicionPaso` (sub-PR 19.3a).
 *
 * Cubre los cuatro casos del árbol del editor:
 *   1. Paso en raíz, único.
 *   2. Paso en raíz, en el medio (índice y total correctos).
 *   3. Paso en rama "Si SÍ" de un branch.
 *   4. Paso en rama "Si NO" de un branch.
 *   5. Paso en branch anidado (un branch dentro de la rama de otro).
 *   6. Id no encontrado → null.
 */

import { describe, expect, it } from 'vitest'
import { posicionPaso } from '@/lib/workflows/posicion-paso'
import type { AccionConId } from '@/lib/workflows/ids-pasos'
import type { AccionWorkflow } from '@/tipos/workflow'

// Constructor mínimo para no escribir el shape completo en cada caso.
function paso(id: string, tipo: AccionWorkflow['tipo'] = 'esperar'): AccionConId {
  if (tipo === 'esperar') {
    return { id, tipo, duracion_ms: 60_000 } as AccionConId
  }
  if (tipo === 'terminar_flujo') {
    return { id, tipo } as AccionConId
  }
  return { id, tipo: 'esperar', duracion_ms: 60_000 } as AccionConId
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

describe('posicionPaso', () => {
  it('encuentra un paso único en raíz como "Paso 1 de 1"', () => {
    const arbol = [paso('a')]
    expect(posicionPaso(arbol, 'a')).toEqual({
      indice: 1,
      total: 1,
      contexto: 'raiz',
    })
  })

  it('encuentra un paso del medio en raíz con total y contexto correctos', () => {
    const arbol = [paso('a'), paso('b'), paso('c'), paso('d')]
    expect(posicionPaso(arbol, 'c')).toEqual({
      indice: 3,
      total: 4,
      contexto: 'raiz',
    })
  })

  it('encuentra un paso en la rama "Si SÍ" e incluye el id del branch padre', () => {
    const arbol = [
      paso('antes'),
      branch('br-1', [paso('s1'), paso('s2')], [paso('n1')]),
      paso('despues'),
    ]
    expect(posicionPaso(arbol, 's2')).toEqual({
      indice: 2,
      total: 2,
      contexto: 'rama_si',
      branchPadreId: 'br-1',
    })
  })

  it('encuentra un paso en la rama "Si NO" con su contexto', () => {
    const arbol = [branch('br-1', [paso('s1')], [paso('n1'), paso('n2'), paso('n3')])]
    expect(posicionPaso(arbol, 'n3')).toEqual({
      indice: 3,
      total: 3,
      contexto: 'rama_no',
      branchPadreId: 'br-1',
    })
  })

  it('encuentra pasos en branches anidados refiriéndose al contenedor inmediato', () => {
    // Un branch externo "br-out" cuya rama "Si NO" tiene otro branch
    // "br-in" cuya rama "Si SÍ" tiene el paso "objetivo". El contexto
    // debe ser 'rama_si' del contenedor inmediato (br-in), no de br-out.
    const arbol = [
      branch(
        'br-out',
        [paso('externo-si')],
        [branch('br-in', [paso('objetivo')], [paso('interno-no')])],
      ),
    ]
    expect(posicionPaso(arbol, 'objetivo')).toEqual({
      indice: 1,
      total: 1,
      contexto: 'rama_si',
      branchPadreId: 'br-in',
    })
  })

  it('devuelve null cuando el id no existe en el árbol', () => {
    const arbol = [paso('a'), branch('br', [paso('s')], [paso('n')])]
    expect(posicionPaso(arbol, 'inexistente')).toBeNull()
  })

  it('soporta árbol vacío sin lanzar', () => {
    expect(posicionPaso([], 'cualquiera')).toBeNull()
  })
})

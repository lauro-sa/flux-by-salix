/**
 * Mutaciones puras del árbol de pasos del editor visual de flujos
 * (sub-PR 19.3a).
 *
 * El árbol vive en el state del componente raíz `EditorFlujo` como un
 * array de `AccionConId` (raíz) donde cada `condicion_branch` tiene
 * sub-arrays `acciones_si` y `acciones_no`. Para que el panel lateral
 * derecho pueda actualizar / eliminar un paso por id desde cualquier
 * profundidad, sin tener que saber dónde está ubicado, exponemos dos
 * helpers recursivos:
 *
 *   actualizarPasoPorId(arbol, id, parche)
 *   eliminarPasoPorId(arbol, id)
 *
 * Ambas devuelven un nuevo árbol — preservan la inmutabilidad necesaria
 * para que el hook `useEditorFlujo` detecte el cambio y dispare el PUT
 * diff-only del autoguardado.
 *
 * Si el id no existe en el árbol, las funciones devuelven el árbol sin
 * cambios (no lanzan). El llamador es responsable de validar que el id
 * sea válido — en la práctica viene del estado `seleccion` del editor,
 * que solo se setea con ids que se acaban de pintar.
 */

import type { AccionConId } from './ids-pasos'
import type { AccionWorkflow } from '@/tipos/workflow'

/**
 * Aplica `parche` al paso con id `id`, donde sea que esté en el árbol.
 * Devuelve un árbol nuevo (no muta). El parche se mergea por shallow
 * copy: campos no incluidos quedan como estaban, campos incluidos se
 * sobrescriben.
 */
export function actualizarPasoPorId(
  pasos: AccionConId[],
  id: string,
  parche: Partial<AccionWorkflow>,
): AccionConId[] {
  return pasos.map((p) => {
    if (p.id === id) {
      // Mergeamos manteniendo el id (no debería venir en el parche, pero
      // si viene lo ignoramos para no romper la identidad de dnd-kit).
      const conParche = { ...p, ...parche, id: p.id } as AccionConId
      return conParche
    }
    if (p.tipo !== 'condicion_branch') return p

    const si = (p.acciones_si as AccionConId[] | undefined) ?? []
    const no = (p.acciones_no as AccionConId[] | undefined) ?? []
    return {
      ...p,
      acciones_si: actualizarPasoPorId(si, id, parche) as unknown as AccionWorkflow[],
      acciones_no: actualizarPasoPorId(no, id, parche) as unknown as AccionWorkflow[],
    } as AccionConId
  })
}

/**
 * Elimina el paso con id `id` del árbol, en cualquier profundidad.
 * Devuelve un árbol nuevo (no muta). Si el paso eliminado es un
 * `condicion_branch`, sus ramas y todo lo que tienen adentro se va con
 * él — no se "descongelan" los hijos al nivel de arriba.
 */
export function eliminarPasoPorId(
  pasos: AccionConId[],
  id: string,
): AccionConId[] {
  const filtrado = pasos.filter((p) => p.id !== id)
  return filtrado.map((p) => {
    if (p.tipo !== 'condicion_branch') return p
    const si = (p.acciones_si as AccionConId[] | undefined) ?? []
    const no = (p.acciones_no as AccionConId[] | undefined) ?? []
    return {
      ...p,
      acciones_si: eliminarPasoPorId(si, id) as unknown as AccionWorkflow[],
      acciones_no: eliminarPasoPorId(no, id) as unknown as AccionWorkflow[],
    } as AccionConId
  })
}

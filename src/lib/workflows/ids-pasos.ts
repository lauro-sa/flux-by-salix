/**
 * Helpers para mantener IDs estables en los pasos del editor visual
 * (sub-PR 19.2).
 *
 * El motor de ejecución no necesita IDs por paso (procesa el array por
 * índice). Pero `dnd-kit` y la UI sí: para reordenar y resaltar
 * selección sin pelear con el índice, cada paso necesita un ID estable.
 *
 * Estrategia:
 *   • Al cargar el flujo, asignamos un UUID a cada paso que no tenga uno.
 *   • Los IDs se persisten dentro del JSON `acciones` — se mandan en el
 *     PUT como claves extra. El handler los acepta como JSON opaco; el
 *     motor las ignora.
 *   • Para acciones recién creadas vía `crearAccionVacia` o pre-rellenadas
 *     desde una plantilla, generamos el ID al insertarlas.
 *
 * `crypto.randomUUID()` está disponible en navegadores modernos y en
 * Node 18+. Como este archivo solo se importa desde componentes
 * cliente, asumimos browser.
 */

import type { AccionWorkflow } from '@/tipos/workflow'

export type AccionConId = AccionWorkflow & { id: string }

/**
 * Type guard: la acción ya trae `id` válido.
 */
function tieneId(accion: unknown): accion is AccionWorkflow & { id: string } {
  return (
    typeof accion === 'object' &&
    accion !== null &&
    'id' in accion &&
    typeof (accion as { id: unknown }).id === 'string' &&
    (accion as { id: string }).id.length > 0
  )
}

function generarId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback raro (entornos sin Web Crypto). No usamos `Math.random`
  // para IDs porque pueden colisionar; pero no rompemos UI al menos.
  return `paso-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Asigna IDs a un array de acciones, recursivo para `condicion_branch`.
 * Si una acción ya tiene ID, la respeta. Devuelve un array nuevo (no
 * muta).
 */
export function asignarIdsAcciones(acciones: unknown): AccionConId[] {
  if (!Array.isArray(acciones)) return []
  return acciones.map((a) => asignarIdsAccion(a))
}

function asignarIdsAccion(accion: unknown): AccionConId {
  if (typeof accion !== 'object' || accion === null) {
    // Defensa: si el JSON viene roto, devolvemos un placeholder vacío
    // con `terminar_flujo` para que el editor no explote. Esto solo
    // pasa con datos rotos manualmente en BD.
    return { id: generarId(), tipo: 'terminar_flujo' }
  }
  const base = accion as AccionWorkflow & { id?: string }
  const id = tieneId(base) ? base.id : generarId()

  if (base.tipo === 'condicion_branch') {
    return {
      ...base,
      id,
      acciones_si: asignarIdsAcciones(base.acciones_si) as unknown as AccionWorkflow[],
      acciones_no: asignarIdsAcciones(base.acciones_no) as unknown as AccionWorkflow[],
    } as AccionConId
  }

  return { ...base, id } as AccionConId
}

/**
 * Crea un paso nuevo con ID asignado a partir de una acción "vacía"
 * (la que devuelve `crearAccionVacia`).
 */
export function darIdAAccion(accion: AccionWorkflow): AccionConId {
  if (accion.tipo === 'condicion_branch') {
    return {
      ...accion,
      id: generarId(),
      acciones_si: asignarIdsAcciones(accion.acciones_si) as unknown as AccionWorkflow[],
      acciones_no: asignarIdsAcciones(accion.acciones_no) as unknown as AccionWorkflow[],
    } as AccionConId
  }
  return { ...accion, id: generarId() } as AccionConId
}

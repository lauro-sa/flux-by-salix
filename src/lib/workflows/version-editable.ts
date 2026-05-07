/**
 * Helper que decide qué versión del flujo (publicada o borrador interno)
 * tiene que pintar y editar el editor visual del sub-PR 19.2.
 *
 * El motor de ejecución consume `flujos.disparador / condiciones /
 * acciones / nodos_json` (las columnas top-level). Cuando el usuario
 * edita un flujo activo o pausado, el PUT desvía los cambios a
 * `flujos.borrador_jsonb` para no afectar al motor hasta que el
 * usuario clickee Publicar (modelo "borrador interno", §5.3 del
 * docs/PLAN_UI_FLUJOS.md).
 *
 * Reglas:
 *   • estado === 'borrador'                → top-level (sin borrador interno).
 *   • estado === 'activo' | 'pausado'
 *      ◦ borrador_jsonb === null            → top-level.
 *      ◦ borrador_jsonb es objeto válido    → mergea encima de top-level
 *                                              y marca esBorradorInterno=true.
 *
 * El merge es shallow por campo (disparador, condiciones, acciones,
 * nodos_json) — si el borrador no incluye uno, cae al publicado. Eso
 * permite que un PUT parcial (ej: solo cambió `acciones`) no obligue
 * al cliente a re-mandar todo.
 *
 * Centralizado acá para que todas las superficies de la UI (canvas,
 * indicador del listado, banner contextual) lean exactamente lo mismo.
 * Cualquier cambio al modelo borrador interno toca solo este archivo.
 */

import type { Flujo } from '@/tipos/workflow'

/**
 * Forma del valor de `flujos.borrador_jsonb` cuando no es NULL.
 * Cualquiera de los 4 campos puede faltar — el merge los completa.
 */
interface BorradorParcial {
  disparador?: unknown
  condiciones?: unknown
  acciones?: unknown
  nodos_json?: unknown
}

export interface VersionEditable {
  disparador: unknown
  condiciones: unknown
  acciones: unknown
  nodos_json: unknown
  /**
   * `true` si los datos arriba salen del borrador interno (flujo Activo
   * o Pausado con cambios sin publicar). `false` si son la versión
   * publicada (flujo en Borrador, o Activo/Pausado sin borrador interno).
   *
   * El editor lo usa para:
   *   - Mostrar el banner amarillo "estás editando, publicá para activar".
   *   - Habilitar los botones [Publicar cambios] / [Descartar cambios]
   *     en el header.
   */
  esBorradorInterno: boolean
}

/**
 * Devuelve la versión que la UI debe pintar y editar.
 *
 * @param flujo Fila completa del backend (`GET /api/flujos/[id]`). Acepta
 *              tanto `Flujo` (estricto) como un superset porque el
 *              endpoint suma `permisos` que no son del shape del motor.
 */
export function obtenerVersionEditable(flujo: Pick<
  Flujo,
  'estado' | 'disparador' | 'condiciones' | 'acciones' | 'nodos_json' | 'borrador_jsonb'
>): VersionEditable {
  const versionPublicada: Omit<VersionEditable, 'esBorradorInterno'> = {
    disparador: flujo.disparador,
    condiciones: flujo.condiciones,
    acciones: flujo.acciones,
    nodos_json: flujo.nodos_json,
  }

  // Solo hay borrador interno cuando el flujo NO está en estado borrador
  // (un borrador edita in-place sobre top-level) y la columna jsonb tiene
  // un objeto plano con al menos un campo del modelo lógico.
  if (flujo.estado === 'borrador') {
    return { ...versionPublicada, esBorradorInterno: false }
  }

  if (
    flujo.borrador_jsonb === null ||
    flujo.borrador_jsonb === undefined ||
    typeof flujo.borrador_jsonb !== 'object' ||
    Array.isArray(flujo.borrador_jsonb)
  ) {
    return { ...versionPublicada, esBorradorInterno: false }
  }

  const borrador = flujo.borrador_jsonb as BorradorParcial

  // Merge shallow por campo: el borrador pisa lo publicado solo si
  // tiene la clave presente. Eso permite borradores parciales (sub-PR
  // 18.1 ya emite borradores parciales — el handler PUT escribe solo
  // los campos que el cliente mandó, mergeados sobre la versión
  // publicada como base inicial).
  return {
    disparador: 'disparador' in borrador ? borrador.disparador : versionPublicada.disparador,
    condiciones: 'condiciones' in borrador ? borrador.condiciones : versionPublicada.condiciones,
    acciones: 'acciones' in borrador ? borrador.acciones : versionPublicada.acciones,
    nodos_json: 'nodos_json' in borrador ? borrador.nodos_json : versionPublicada.nodos_json,
    esBorradorInterno: true,
  }
}

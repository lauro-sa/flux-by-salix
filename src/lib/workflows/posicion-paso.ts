/**
 * Cálculo de "posición" de un paso dentro del árbol del flujo, usado por
 * el sub-header del panel lateral del editor (sub-PR 19.3a).
 *
 * El árbol que ve la UI tiene dos niveles posibles:
 *   • raíz                                  (array `acciones`)
 *   • rama "Si SÍ" / "Si NO" de un branch   (acciones_si / acciones_no)
 *
 * Para mostrar al usuario "Paso 3 de 7" o "Paso 2 de 4 · Rama Sí",
 * necesitamos saber tres cosas: índice 1-based del paso, total de pasos
 * del array contenedor, y el contexto (raíz / rama_si / rama_no). Si el
 * paso no está al primer nivel de un contenedor (ej: branch anidado
 * dentro de otro branch), la búsqueda recursa hasta encontrarlo.
 *
 * Función pura: no depende de React ni de DOM, testeable aislada.
 */

import type { AccionConId } from './ids-pasos'

export interface PosicionPaso {
  /** Índice 1-based dentro del array contenedor (raíz o rama). */
  indice: number
  /** Total de pasos del array contenedor. */
  total: number
  /** Lugar dentro del árbol donde está el paso. */
  contexto: 'raiz' | 'rama_si' | 'rama_no'
  /**
   * Id del branch contenedor (solo presente si `contexto !== 'raiz'`).
   * Útil para que la UI del sub-header pueda referirse al branch padre,
   * por ejemplo mostrando "dentro de Rama Sí del Branch tal".
   */
  branchPadreId?: string
}

/**
 * Devuelve la posición del paso identificado por `id` dentro del árbol.
 *
 * Si el paso no se encuentra en raíz ni en ninguna rama, devuelve `null`.
 * Si hay branches anidados (un branch dentro de la rama de otro branch),
 * la búsqueda recursa: el `contexto` y `branchPadreId` reflejan al
 * contenedor inmediato del paso, no al ancestro más alto.
 */
export function posicionPaso(
  pasosRaiz: AccionConId[],
  id: string,
): PosicionPaso | null {
  // Nivel raíz primero — el caso más común.
  const idxRaiz = pasosRaiz.findIndex((p) => p.id === id)
  if (idxRaiz >= 0) {
    return { indice: idxRaiz + 1, total: pasosRaiz.length, contexto: 'raiz' }
  }

  for (const p of pasosRaiz) {
    if (p.tipo !== 'condicion_branch') continue

    const si = (p.acciones_si as AccionConId[] | undefined) ?? []
    const idxSi = si.findIndex((s) => s.id === id)
    if (idxSi >= 0) {
      return {
        indice: idxSi + 1,
        total: si.length,
        contexto: 'rama_si',
        branchPadreId: p.id,
      }
    }

    const no = (p.acciones_no as AccionConId[] | undefined) ?? []
    const idxNo = no.findIndex((s) => s.id === id)
    if (idxNo >= 0) {
      return {
        indice: idxNo + 1,
        total: no.length,
        contexto: 'rama_no',
        branchPadreId: p.id,
      }
    }

    // Branches anidados: si el paso vive más adentro, recursamos. El
    // contexto devuelto refleja al contenedor inmediato (no al branch
    // ancestro): así "Paso 2 de 3 · Rama Sí" sigue siendo intuitivo.
    const dentroSi = posicionPaso(si, id)
    if (dentroSi) return dentroSi
    const dentroNo = posicionPaso(no, id)
    if (dentroNo) return dentroNo
  }

  return null
}

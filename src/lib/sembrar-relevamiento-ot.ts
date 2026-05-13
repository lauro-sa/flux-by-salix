/**
 * STUB temporal — la implementación real está en construcción en otro chat.
 *
 * Al generar una OT desde un presupuesto con visita, copia el
 * relevamiento técnico de la visita al nuevo registro de OT.
 * Mientras no se commitee la versión real: devuelve `{ agregados: 0 }`.
 */

interface ArgsSembrarRelevamientoOT {
  empresaId: string
  visitaId: string
  ordenTrabajoId: string
}

interface ResultadoSembrarRelevamientoOT {
  agregados: number
}

export async function sembrarRelevamientoOT(
  _args: ArgsSembrarRelevamientoOT,
): Promise<ResultadoSembrarRelevamientoOT> {
  return { agregados: 0 }
}

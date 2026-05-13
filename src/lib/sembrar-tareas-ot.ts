/**
 * STUB temporal — la implementación real está en construcción en otro chat.
 *
 * Siembra las tareas iniciales de una OT a partir de un presupuesto.
 * Mientras no se commitee la versión real: devuelve `{ agregadas: 0 }`.
 * La OT se crea sin tareas — el usuario las puede agregar manualmente
 * desde la vista de orden.
 */

interface ArgsSembrarTareasOT {
  empresaId: string
  presupuestoId: string
  ordenTrabajoId: string
  creadoPor: string
  creadoPorNombre?: string | null
}

interface ResultadoSembrarTareasOT {
  agregadas: number
}

export async function sembrarTareasOT(
  _args: ArgsSembrarTareasOT,
): Promise<ResultadoSembrarTareasOT> {
  return { agregadas: 0 }
}

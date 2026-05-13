/**
 * STUB temporal — la implementación real está en construcción en otro chat.
 *
 * Al modificar condición de pago / total de un presupuesto, recalcula
 * y persiste las cuotas. Mientras no se commitee la versión real:
 * retorna `{ ok: true }` (no-op exitoso). Las cuotas quedan como están;
 * el usuario debe actualizarlas manualmente. NO bloquea el PATCH del
 * presupuesto.
 */

interface ArgsSincronizarCuotasPresupuesto {
  admin: unknown
  empresaId: string
  presupuestoId: string
  condicionPagoId?: string | null
  condicionPagoTipo?: string | null
  totalFinal: number
}

interface ResultadoSincronizarCuotasPresupuesto {
  ok: boolean
  codigo?: string
  mensaje?: string
}

export async function sincronizarCuotasPresupuesto(
  _args: ArgsSincronizarCuotasPresupuesto,
): Promise<ResultadoSincronizarCuotasPresupuesto> {
  return { ok: true }
}

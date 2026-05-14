/**
 * Ejecutor: eliminar_movimiento_nomina
 * Cancela un adelanto o descuento (soft-delete).
 *
 * Reglas inteligentes:
 *  - estado === 'pagado'    → bloqueado. Para revertirlo hay que hacer ajuste contable a mano.
 *  - estado === 'cancelado' → ya está cancelado, no hace nada.
 *  - 0 cuotas descontadas   → cancela el movimiento entero (marca eliminado=true).
 *  - cuotas descontadas > 0 → cancela SOLO las cuotas pendientes; el adelanto
 *    queda con estado='cancelado' pero las cuotas ya descontadas se mantienen
 *    en el histórico (no se pueden revertir desde acá).
 *
 * Requiere permiso 'nomina' + 'eliminar'.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { verificarPermiso } from '@/lib/permisos-servidor'
import type { Rol } from '@/tipos/miembro'

export async function ejecutarEliminarMovimientoNomina(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const tienePermiso = verificarPermiso(
    { rol: ctx.miembro.rol as Rol, permisos_custom: ctx.miembro.permisos_custom },
    'nomina',
    'eliminar'
  )
  if (!tienePermiso) {
    return { exito: false, error: 'No tenés permiso para eliminar movimientos de nómina.' }
  }

  const movimiento_id = (params.movimiento_id as string)?.trim()
  if (!movimiento_id) {
    return {
      exito: false,
      error: 'Se requiere movimiento_id. Buscalo primero con consultar_movimientos_nomina.',
    }
  }

  // ─── Cargar movimiento ───
  const { data: mov } = await ctx.admin
    .from('adelantos_nomina')
    .select('id, miembro_id, tipo, estado, monto_total, cuotas_descontadas, cuotas_totales')
    .eq('id', movimiento_id)
    .eq('empresa_id', ctx.empresa_id)
    .maybeSingle()

  if (!mov) {
    return { exito: false, error: 'Movimiento no encontrado.' }
  }

  // ─── Validar editabilidad ───
  if (mov.estado === 'pagado') {
    return {
      exito: false,
      error:
        'No se puede eliminar: el movimiento ya fue pagado y la nómina del periodo se cerró. ' +
        'Si necesitás revertirlo, andá manualmente a {{link:/asistencias/nomina|Nómina}} y registrá un ajuste contable.',
    }
  }
  if (mov.estado === 'cancelado') {
    return { exito: true, mensaje_usuario: 'Este movimiento ya estaba cancelado.' }
  }

  const cuotasDescontadas = mov.cuotas_descontadas as number
  const cuotasTotales = mov.cuotas_totales as number
  const cuotasPendientes = cuotasTotales - cuotasDescontadas

  // ─── Cancelar cuotas pendientes ───
  if (cuotasPendientes > 0) {
    const { error: errCuotas } = await ctx.admin
      .from('adelantos_cuotas')
      .update({ estado: 'cancelada', actualizado_en: new Date().toISOString() })
      .eq('adelanto_id', movimiento_id)
      .eq('estado', 'pendiente')

    if (errCuotas) {
      return { exito: false, error: `Error cancelando cuotas: ${errCuotas.message}` }
    }
  }

  // ─── Cancelar adelanto ───
  const { error: errMov } = await ctx.admin
    .from('adelantos_nomina')
    .update({
      estado: 'cancelado',
      saldo_pendiente: '0',
      eliminado: true,
      eliminado_en: new Date().toISOString(),
      eliminado_por: ctx.usuario_id,
    })
    .eq('id', movimiento_id)

  if (errMov) {
    return { exito: false, error: `Error cancelando movimiento: ${errMov.message}` }
  }

  // ─── Mensaje al usuario, diferencia si hubo cuotas ya descontadas ───
  const tipoTexto = mov.tipo === 'adelanto' ? 'Adelanto' : 'Descuento'

  if (cuotasDescontadas === 0) {
    return {
      exito: true,
      datos: { id: movimiento_id, cuotas_canceladas: cuotasPendientes },
      mensaje_usuario: `✅ ${tipoTexto} cancelado completo. Se anularon ${cuotasPendientes} cuota(s) pendiente(s).`,
    }
  }

  return {
    exito: true,
    datos: { id: movimiento_id, cuotas_canceladas: cuotasPendientes, cuotas_preservadas: cuotasDescontadas },
    mensaje_usuario:
      `⚠ ${tipoTexto} cancelado parcialmente.\n\n` +
      `• ${cuotasPendientes} cuota(s) pendiente(s) anulada(s)\n` +
      `• ${cuotasDescontadas} cuota(s) ya descontada(s) en nóminas anteriores se mantienen en el histórico\n\n` +
      `_Para revertir las cuotas ya descontadas necesitás un ajuste contable manual desde Nómina._`,
  }
}

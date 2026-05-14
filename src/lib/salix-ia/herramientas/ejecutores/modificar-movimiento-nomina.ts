/**
 * Ejecutor: modificar_movimiento_nomina
 * Modifica monto, cuotas o descripción de un adelanto/descuento.
 *
 * Reglas de inteligencia (espejo de /api/adelantos/[id] PATCH):
 *  - estado === 'pagado'    → bloqueado. La nómina cerró, derivar al admin.
 *  - estado === 'cancelado' → bloqueado.
 *  - cuotas_descontadas > 0 + se quiere reducir a menos cuotas → error explicativo.
 *  - cualquier modificación válida regenera SOLO las cuotas pendientes,
 *    preservando las ya descontadas.
 *
 * Requiere permiso 'nomina' + 'editar'.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { verificarPermiso } from '@/lib/permisos-servidor'
import type { Rol } from '@/tipos/miembro'

type Frecuencia = 'semanal' | 'quincenal' | 'mensual'

function calcularFechasCuotas(fechaInicio: string, cuotas: number, frecuencia: Frecuencia): string[] {
  const fechas: string[] = []
  const d = new Date(fechaInicio + 'T12:00:00')
  for (let i = 0; i < cuotas; i++) {
    fechas.push(d.toISOString().split('T')[0])
    if (frecuencia === 'semanal') d.setDate(d.getDate() + 7)
    else if (frecuencia === 'quincenal') d.setDate(d.getDate() + 15)
    else d.setMonth(d.getMonth() + 1)
  }
  return fechas
}

export async function ejecutarModificarMovimientoNomina(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const tienePermiso = verificarPermiso(
    { rol: ctx.miembro.rol as Rol, permisos_custom: ctx.miembro.permisos_custom },
    'nomina',
    'editar'
  )
  if (!tienePermiso) {
    return { exito: false, error: 'No tenés permiso para modificar adelantos ni descuentos.' }
  }

  const movimiento_id = (params.movimiento_id as string)?.trim()
  if (!movimiento_id) {
    return {
      exito: false,
      error: 'Se requiere movimiento_id. Buscalo primero con consultar_movimientos_nomina.',
    }
  }

  // ─── Cargar movimiento actual ───
  const { data: mov } = await ctx.admin
    .from('adelantos_nomina')
    .select(
      'id, miembro_id, tipo, estado, monto_total, cuotas_totales, cuotas_descontadas, saldo_pendiente, frecuencia_descuento, fecha_inicio_descuento, notas'
    )
    .eq('id', movimiento_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('eliminado', false)
    .maybeSingle()

  if (!mov) {
    return { exito: false, error: 'Movimiento no encontrado o ya eliminado.' }
  }

  // ─── Validar editabilidad ───
  if (mov.estado === 'pagado') {
    return {
      exito: false,
      error:
        'Este movimiento ya fue pagado: la nómina del periodo se cerró y no se puede modificar. ' +
        'Si necesitás ajustarlo, andá manualmente a {{link:/nominas|Nómina}} → ese empleado, y registrá un ajuste contable.',
    }
  }
  if (mov.estado === 'cancelado') {
    return { exito: false, error: 'Este movimiento ya está cancelado, no se puede modificar.' }
  }

  const cuotasDescontadas = mov.cuotas_descontadas as number
  const cuotasTotalesActual = mov.cuotas_totales as number
  const cuotasPendientes = cuotasTotalesActual - cuotasDescontadas

  if (cuotasPendientes === 0) {
    return {
      exito: false,
      error: 'Todas las cuotas de este movimiento ya fueron descontadas en nóminas anteriores. No queda nada por modificar.',
    }
  }

  // ─── Resolver cambios pedidos ───
  const nuevoMontoParam = params.monto_total !== undefined ? Number(params.monto_total) : undefined
  const nuevasCuotasParam = params.cuotas_totales !== undefined ? Math.floor(Number(params.cuotas_totales)) : undefined
  const nuevaDescripcion = params.descripcion as string | undefined

  if (
    nuevoMontoParam === undefined &&
    nuevasCuotasParam === undefined &&
    nuevaDescripcion === undefined
  ) {
    return {
      exito: false,
      error: 'No se indicaron cambios. Pasá al menos uno de: monto_total, cuotas_totales, descripcion.',
    }
  }

  if (nuevoMontoParam !== undefined && (!Number.isFinite(nuevoMontoParam) || nuevoMontoParam <= 0)) {
    return { exito: false, error: 'El nuevo monto debe ser un número mayor a 0.' }
  }

  // Descuentos siempre tienen 1 cuota; bloquear intento de cambiar cuotas
  if (mov.tipo === 'descuento' && nuevasCuotasParam !== undefined && nuevasCuotasParam !== 1) {
    return { exito: false, error: 'Los descuentos siempre son de 1 cuota y no se pueden dividir.' }
  }

  const nuevoMonto = nuevoMontoParam ?? parseFloat(mov.monto_total as unknown as string)
  const nuevasCuotas = nuevasCuotasParam ?? cuotasTotalesActual

  // No se puede reducir cuotas a menos de las ya descontadas
  if (cuotasDescontadas > 0 && nuevasCuotas < cuotasDescontadas) {
    return {
      exito: false,
      error:
        `Ya se descontaron ${cuotasDescontadas} cuota(s) en periodos anteriores. ` +
        `No podés reducir a menos. El mínimo permitido es ${cuotasDescontadas + 1} cuotas, ` +
        `o cancelá el movimiento con eliminar_movimiento_nomina para detener los descuentos pendientes.`,
    }
  }

  // ─── Calcular nuevo saldo respetando lo ya descontado ───
  const montoOriginal = parseFloat(mov.monto_total as unknown as string)
  const saldoOriginal = parseFloat(mov.saldo_pendiente as unknown as string)
  const montoYaDescontado = montoOriginal - saldoOriginal
  const nuevoSaldo = Math.max(0, Math.round((nuevoMonto - montoYaDescontado) * 100) / 100)

  // ─── Actualizar adelanto ───
  const update: Record<string, unknown> = {
    editado_por: ctx.usuario_id,
    editado_en: new Date().toISOString(),
  }
  if (nuevoMontoParam !== undefined) update.monto_total = String(nuevoMonto)
  if (nuevasCuotasParam !== undefined) update.cuotas_totales = nuevasCuotas
  if (nuevoMontoParam !== undefined || nuevasCuotasParam !== undefined) {
    update.saldo_pendiente = String(nuevoSaldo)
  }
  if (nuevaDescripcion !== undefined) update.notas = nuevaDescripcion || null

  const { error: errUpd } = await ctx.admin
    .from('adelantos_nomina')
    .update(update)
    .eq('id', movimiento_id)

  if (errUpd) {
    return { exito: false, error: `Error actualizando movimiento: ${errUpd.message}` }
  }

  // ─── Regenerar SOLO cuotas pendientes (preserva las descontadas) ───
  const debeRegenerar = nuevoMontoParam !== undefined || nuevasCuotasParam !== undefined

  if (debeRegenerar) {
    // Borrar pendientes
    await ctx.admin
      .from('adelantos_cuotas')
      .delete()
      .eq('adelanto_id', movimiento_id)
      .eq('estado', 'pendiente')

    const cuotasNuevasN = nuevasCuotas - cuotasDescontadas
    if (cuotasNuevasN > 0 && nuevoSaldo > 0) {
      const frecuencia = mov.frecuencia_descuento as Frecuencia
      const fechaBase = new Date((mov.fecha_inicio_descuento as string) + 'T12:00:00')

      // Avanzar fechaBase según cuotas ya descontadas
      for (let i = 0; i < cuotasDescontadas; i++) {
        if (frecuencia === 'semanal') fechaBase.setDate(fechaBase.getDate() + 7)
        else if (frecuencia === 'quincenal') fechaBase.setDate(fechaBase.getDate() + 15)
        else fechaBase.setMonth(fechaBase.getMonth() + 1)
      }

      const montoPorCuota = Math.round((nuevoSaldo / cuotasNuevasN) * 100) / 100
      const fechas = calcularFechasCuotas(fechaBase.toISOString().split('T')[0], cuotasNuevasN, frecuencia)

      const cuotasData = fechas.map((fecha, idx) => {
        const esUltima = idx === cuotasNuevasN - 1
        const montoEsta = esUltima
          ? Math.round((nuevoSaldo - montoPorCuota * (cuotasNuevasN - 1)) * 100) / 100
          : montoPorCuota
        return {
          adelanto_id: movimiento_id,
          empresa_id: ctx.empresa_id,
          miembro_id: mov.miembro_id as string,
          numero_cuota: cuotasDescontadas + idx + 1,
          monto_cuota: String(montoEsta),
          fecha_programada: fecha,
          estado: 'pendiente',
        }
      })

      const { error: errIns } = await ctx.admin.from('adelantos_cuotas').insert(cuotasData)
      if (errIns) {
        return { exito: false, error: `Error regenerando cuotas: ${errIns.message}` }
      }
    }
  }

  // ─── Mensaje al usuario ───
  const cambios: string[] = []
  if (nuevoMontoParam !== undefined) cambios.push(`monto: $${nuevoMonto.toLocaleString('es-AR')}`)
  if (nuevasCuotasParam !== undefined) cambios.push(`cuotas: ${nuevasCuotas}`)
  if (nuevaDescripcion !== undefined) cambios.push(`descripción actualizada`)

  const advertencia =
    cuotasDescontadas > 0 && debeRegenerar
      ? `\n\n_Nota: las ${cuotasDescontadas} cuota(s) ya descontadas se mantienen sin cambios. Solo se regeneraron las ${nuevasCuotas - cuotasDescontadas} pendientes con el nuevo monto._`
      : ''

  return {
    exito: true,
    datos: { id: movimiento_id, cambios },
    mensaje_usuario: `✅ Movimiento actualizado: ${cambios.join(' · ')}.${advertencia}`,
  }
}

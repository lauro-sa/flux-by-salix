/**
 * Sincroniza la tabla `presupuesto_cuotas` con la condición de pago y el
 * total_final actuales del presupuesto. Se invoca desde el PATCH del
 * presupuesto cada vez que cambia `condicion_pago_id`, `condicion_pago_tipo`
 * o `total_final` para mantener una única fuente de verdad: las cuotas
 * materializadas en BD son las que leen el portal del cliente, el PDF, los
 * dashboards y los reportes.
 *
 * Reglas:
 *   - Si no hay cuotas materializadas, no hace nada (las "sintéticas" del
 *     editor se generan al vuelo en el GET).
 *   - Si la nueva condición no es `hitos`, se borran las cuotas existentes.
 *   - Si la estructura (cantidad de hitos + porcentajes) no cambió, solo
 *     recalcula `monto`, `descripcion` y `dias_desde_emision` por si cambió
 *     `total_final` o se editó la config. Esto es seguro aunque haya pagos.
 *   - Si la estructura cambió y hay pagos vinculados a las cuotas, se
 *     bloquea con código `cuotas_con_pagos` (el PATCH devuelve 409).
 *   - Si la estructura cambió y no hay pagos vinculados, se hace
 *     DELETE + INSERT de las cuotas con la nueva config.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

interface HitoConfig {
  porcentaje: number
  descripcion?: string
  diasDesdeEmision?: number
}

interface CondicionPagoConfig {
  id: string
  tipo: string
  hitos?: HitoConfig[]
}

interface SincronizarCuotasParams {
  admin: SupabaseClient
  empresaId: string
  presupuestoId: string
  /** Condición de pago vigente del presupuesto tras el UPDATE. */
  condicionPagoId: string | null
  condicionPagoTipo: string | null
  /** Total final del presupuesto tras el UPDATE (en su moneda). */
  totalFinal: number
}

export type ResultadoSincronizacion =
  | { ok: true }
  | { ok: false; codigo: 'cuotas_con_pagos'; mensaje: string }
  | { ok: false; codigo: 'error_interno'; mensaje: string }

export async function sincronizarCuotasPresupuesto({
  admin,
  empresaId,
  presupuestoId,
  condicionPagoId,
  condicionPagoTipo,
  totalFinal,
}: SincronizarCuotasParams): Promise<ResultadoSincronizacion> {
  // Cuotas actualmente materializadas para este presupuesto.
  const { data: cuotasExistentes, error: errorCuotas } = await admin
    .from('presupuesto_cuotas')
    .select('id, numero, porcentaje')
    .eq('presupuesto_id', presupuestoId)
    .eq('empresa_id', empresaId)
    .order('numero', { ascending: true })

  if (errorCuotas) {
    return { ok: false, codigo: 'error_interno', mensaje: 'Error al leer cuotas' }
  }

  // Sin cuotas materializadas: no hay nada que sincronizar; el editor
  // generará sintéticas al vuelo a partir de la condición vigente.
  if (!cuotasExistentes || cuotasExistentes.length === 0) {
    return { ok: true }
  }

  // Si la nueva condición no es `hitos` (o quedó sin condición), las cuotas
  // viejas dejan de tener sentido. Solo se pueden borrar si no tienen pagos.
  if (condicionPagoTipo !== 'hitos' || !condicionPagoId) {
    return await borrarCuotasSiNoTienenPagos(admin, empresaId, presupuestoId)
  }

  // Resolver la condición de pago elegida desde la config de la empresa.
  const { data: config } = await admin
    .from('config_presupuestos')
    .select('condiciones_pago')
    .eq('empresa_id', empresaId)
    .single()

  const condiciones = (config?.condiciones_pago || []) as CondicionPagoConfig[]
  const condicion = condiciones.find((c) => c.id === condicionPagoId)

  if (!condicion || condicion.tipo !== 'hitos' || !condicion.hitos?.length) {
    // La condición referenciada ya no existe o no tiene hitos: limpiar.
    return await borrarCuotasSiNoTienenPagos(admin, empresaId, presupuestoId)
  }

  // ¿La estructura coincide con las cuotas en BD? Compara cantidad de hitos
  // y porcentajes uno a uno (orden por `numero` ascendente, asegurado en el
  // SELECT). Comparación numérica para tolerar diferencias de formato
  // (ej: "75" vs "75.00" en BD).
  const mismaCantidad = condicion.hitos.length === cuotasExistentes.length
  const mismosPorcentajes =
    mismaCantidad &&
    condicion.hitos.every(
      (h, i) => Number(cuotasExistentes[i].porcentaje) === Number(h.porcentaje),
    )

  if (mismosPorcentajes) {
    // Estructura intacta: solo recalcular montos por si cambió total_final,
    // y refrescar descripción / días por si se editó la config. Seguro de
    // ejecutar incluso con pagos cargados — los porcentajes no cambian.
    for (let i = 0; i < condicion.hitos.length; i++) {
      const h = condicion.hitos[i]
      const cuota = cuotasExistentes[i]
      const monto = (Number(totalFinal) || 0) * (Number(h.porcentaje) || 0) / 100
      await admin
        .from('presupuesto_cuotas')
        .update({
          monto: String(monto),
          descripcion: h.descripcion || `Cuota ${i + 1}`,
          dias_desde_emision: h.diasDesdeEmision || 0,
        })
        .eq('id', cuota.id)
        .eq('empresa_id', empresaId)
    }
    return { ok: true }
  }

  // Estructura cambió (otra cantidad de hitos o porcentajes distintos):
  // hay que regenerar. Bloquear si alguna cuota tiene pagos vinculados.
  const verifPagos = await borrarCuotasSiNoTienenPagos(admin, empresaId, presupuestoId)
  if (!verifPagos.ok) return verifPagos

  const filasNuevas = condicion.hitos.map((h, i) => ({
    presupuesto_id: presupuestoId,
    empresa_id: empresaId,
    numero: i + 1,
    descripcion: h.descripcion || `Cuota ${i + 1}`,
    porcentaje: String(h.porcentaje),
    monto: String((Number(totalFinal) || 0) * (Number(h.porcentaje) || 0) / 100),
    dias_desde_emision: h.diasDesdeEmision || 0,
    estado: 'pendiente',
  }))

  const { error: errorInsert } = await admin
    .from('presupuesto_cuotas')
    .insert(filasNuevas)

  if (errorInsert) {
    return { ok: false, codigo: 'error_interno', mensaje: 'Error al regenerar cuotas' }
  }

  return { ok: true }
}

/**
 * Borra las cuotas materializadas de un presupuesto solo si ninguna tiene
 * pagos vinculados (no eliminados). Si hay pagos, devuelve error sin tocar
 * nada — el caller debe propagarlo como 409 al cliente para que el usuario
 * elimine los pagos primero.
 */
async function borrarCuotasSiNoTienenPagos(
  admin: SupabaseClient,
  empresaId: string,
  presupuestoId: string,
): Promise<ResultadoSincronizacion> {
  const { data: pagosVinculados } = await admin
    .from('presupuesto_pagos')
    .select('id')
    .eq('presupuesto_id', presupuestoId)
    .eq('empresa_id', empresaId)
    .is('eliminado_en', null)
    .not('cuota_id', 'is', null)
    .limit(1)

  if (pagosVinculados && pagosVinculados.length > 0) {
    return {
      ok: false,
      codigo: 'cuotas_con_pagos',
      mensaje:
        'No se puede cambiar la condición de pago: hay pagos cargados a las cuotas. Eliminá los pagos primero.',
    }
  }

  const { error } = await admin
    .from('presupuesto_cuotas')
    .delete()
    .eq('presupuesto_id', presupuestoId)
    .eq('empresa_id', empresaId)

  if (error) {
    return { ok: false, codigo: 'error_interno', mensaje: 'Error al borrar cuotas' }
  }

  return { ok: true }
}

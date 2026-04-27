/**
 * Auto-transiciones del estado del presupuesto basadas en el estado de
 * cobro de sus cuotas. Se invocan después de cualquier cambio en
 * `presupuesto_pagos` (insertar / editar / eliminar) — el trigger SQL ya
 * recalculó los estados de cuota a `pendiente | parcial | cobrada`.
 *
 * Reglas:
 *   - confirmado_cliente + todas cobradas → orden_venta → cobrado (cadena)
 *   - orden_venta + todas cobradas        → cobrado
 *   - cobrado + alguna no cobrada         → orden_venta (reversión)
 *
 * Cada transición queda registrada en `presupuesto_historial` y `chatter`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { registrarChatter } from '@/lib/chatter'

interface SyncEstadoParams {
  admin: SupabaseClient
  presupuestoId: string
  empresaId: string
  usuarioId: string
  usuarioNombre: string
  /** Razón a registrar en el historial (ej: "pago completo registrado") */
  razon: string
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  confirmado_cliente: 'Confirmado por Cliente',
  orden_venta: 'Orden de Venta',
  completado: 'Completado',
}

export async function sincronizarEstadoPresupuesto({
  admin,
  presupuestoId,
  empresaId,
  usuarioId,
  usuarioNombre,
  razon,
}: SyncEstadoParams) {
  const { data: presupuesto } = await admin
    .from('presupuestos')
    .select('id, numero, estado, fecha_aceptacion, total_final')
    .eq('id', presupuestoId)
    .eq('empresa_id', empresaId)
    .single()

  if (!presupuesto) return

  const { data: cuotas } = await admin
    .from('presupuesto_cuotas')
    .select('estado')
    .eq('presupuesto_id', presupuestoId)

  const tieneCuotas = !!cuotas && cuotas.length > 0

  // Determinar si está totalmente cobrado:
  //  - Con cuotas materializadas: todas las cuotas en 'cobrada'.
  //  - Sin cuotas (presupuestos plazo_fijo / contado / sin condicion):
  //    sumar todos los pagos no-adicionales y comparar con total_final.
  let totalmenteCobrado = false
  if (tieneCuotas) {
    totalmenteCobrado = cuotas.every((c) => c.estado === 'cobrada')
  } else {
    const totalFinal = Number(presupuesto.total_final) || 0
    if (totalFinal > 0) {
      const { data: pagos } = await admin
        .from('presupuesto_pagos')
        .select('monto_en_moneda_presupuesto, es_adicional')
        .eq('presupuesto_id', presupuestoId)
        .eq('empresa_id', empresaId)
      const cobrado = (pagos || [])
        .filter((p) => !p.es_adicional)
        .reduce((s, p) => s + Number(p.monto_en_moneda_presupuesto || 0), 0)
      totalmenteCobrado = cobrado + 0.01 >= totalFinal
    }
  }

  // Determinar transiciones a aplicar
  const transiciones: Array<{ desde: string; hacia: string }> = []

  if (totalmenteCobrado) {
    if (presupuesto.estado === 'confirmado_cliente') {
      transiciones.push({ desde: 'confirmado_cliente', hacia: 'orden_venta' })
      transiciones.push({ desde: 'orden_venta', hacia: 'completado' })
    } else if (presupuesto.estado === 'orden_venta') {
      transiciones.push({ desde: 'orden_venta', hacia: 'completado' })
    }
  } else {
    // Reversión: si estaba en 'completado' y ya no, volver a orden_venta
    if (presupuesto.estado === 'completado') {
      transiciones.push({ desde: 'completado', hacia: 'orden_venta' })
    }
  }

  for (const t of transiciones) {
    // Idempotencia: el UPDATE filtra por `estado = t.desde`. Si dos llamadas
    // concurrentes (o consecutivas) intentan aplicar la misma transición,
    // sólo la primera afecta una fila. La segunda recibe `data = null` y
    // saltea historial + chatter para evitar duplicados.
    const { data: actualizado } = await admin
      .from('presupuestos')
      .update({
        estado: t.hacia,
        ...(t.hacia === 'orden_venta' && !presupuesto.fecha_aceptacion
          ? { fecha_aceptacion: new Date().toISOString() }
          : {}),
      })
      .eq('id', presupuestoId)
      .eq('estado', t.desde)
      .select('id')
      .maybeSingle()

    if (!actualizado) continue

    await admin.from('presupuesto_historial').insert({
      presupuesto_id: presupuestoId,
      empresa_id: empresaId,
      estado: t.hacia,
      usuario_id: usuarioId,
      usuario_nombre: `${usuarioNombre} (auto)`,
      notas: `Transición automática: ${razon}`,
    })

    await registrarChatter({
      empresaId,
      entidadTipo: 'presupuesto',
      entidadId: presupuestoId,
      contenido: `Presupuesto ${presupuesto.numero} pasó a ${ETIQUETAS_ESTADO[t.hacia] || t.hacia} automáticamente (${razon})`,
      autorId: 'sistema',
      autorNombre: 'Sistema',
      metadata: {
        accion: 'estado_cambiado',
        estado_anterior: t.desde,
        estado_nuevo: t.hacia,
      },
    })
  }
}

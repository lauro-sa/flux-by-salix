/**
 * Wrapper sobre `calcularReciboDesdeBD` que prioriza el snapshot
 * congelado en `liquidaciones_empleado_periodo.snapshot_calculo`
 * cuando existe.
 *
 * Regla:
 *   - Si la liquidación del empleado tiene estado != 'borrador' Y
 *     `snapshot_calculo` está poblado, devolver el snapshot tal cual.
 *     Esto garantiza que el recibo que vio el operador al liquidar es
 *     EXACTAMENTE el que persiste, sin importar si después cambió un
 *     concepto, una tasa o una asistencia.
 *   - En cualquier otro caso (estado='borrador' o snapshot=NULL),
 *     calcular en vivo con el motor estándar.
 *
 * El motor base (motor-calculo.ts) NO se modifica para preservar
 * compatibilidad con endpoints que asumen siempre cálculo vivo. Los
 * consumidores que quieran respetar snapshots usan este wrapper.
 *
 * Casos de uso esperados:
 *   - PDF de recibo en estado pagado → snapshot (no recalcular).
 *   - Tab "Liquidaciones" del empleado → snapshot si está pagado, vivo si borrador.
 *   - Vista global /nominas → snapshot por empleado cuando aplica.
 *
 * No cubierto (por ahora):
 *   - El endpoint /api/nominas (listado global) hace su propio cálculo
 *     inline que es más complejo que llamar al motor por empleado.
 *     Migrarlo a este wrapper es trabajo de un PR posterior.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularReciboDesdeBD, type ParamsCalcularRecibo } from './motor-calculo'
import type { DetalleReciboCalculado } from '@/tipos/nominas'

export interface ResultadoConSnapshot {
  /** Detalle del recibo (idéntico al motor: bruto/neto/conceptos/etc) */
  detalle: DetalleReciboCalculado
  /** 'snapshot' si vino del JSON congelado; 'vivo' si fue recalculado */
  fuente: 'snapshot' | 'vivo'
  /** Estado actual de la liquidación del empleado para este período */
  estadoLiquidacion: 'borrador' | 'liquidado' | 'enviado' | 'pagado'
  /** Timestamp en que se congeló el snapshot (NULL si vino vivo) */
  liquidadoEn: string | null
}

/**
 * Calcula el recibo respetando snapshot si está congelado.
 */
export async function calcularReciboConSnapshot(
  admin: SupabaseClient,
  params: ParamsCalcularRecibo,
): Promise<ResultadoConSnapshot> {
  const { miembroId, empresaId, periodoInicio, periodoFin } = params

  // 1. Buscar la fila de liquidación del empleado para este período.
  const { data: fila } = await admin
    .from('liquidaciones_empleado_periodo')
    .select('estado_clave, snapshot_calculo, liquidado_en')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', miembroId)
    .eq('periodo_inicio', periodoInicio)
    .eq('periodo_fin', periodoFin)
    .maybeSingle()

  const estado = (fila?.estado_clave as 'borrador' | 'liquidado' | 'enviado' | 'pagado' | undefined) ?? 'borrador'
  const snapshot = fila?.snapshot_calculo as Record<string, unknown> | null

  // 2. Si está congelada y tenemos snapshot, devolverlo.
  // El snapshot incluye el DetalleReciboCalculado completo dentro de
  // `detalle` (ver lib/nominas/transicion-liquidacion.ts y
  // api/nominas/pagos/route.ts donde se construye).
  if (estado !== 'borrador' && snapshot && snapshot.detalle) {
    return {
      detalle: snapshot.detalle as DetalleReciboCalculado,
      fuente: 'snapshot',
      estadoLiquidacion: estado,
      liquidadoEn: (fila?.liquidado_en as string | null) ?? null,
    }
  }

  // 3. Fallback: calcular en vivo.
  const detalle = await calcularReciboDesdeBD(admin, params)
  return {
    detalle,
    fuente: 'vivo',
    estadoLiquidacion: estado,
    liquidadoEn: null,
  }
}

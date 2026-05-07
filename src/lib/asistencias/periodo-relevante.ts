/**
 * Resolución de "periodo relevante" para preguntas del tipo "¿cuándo cobro?"
 * o "¿cómo me fue?". Cubre la heurística temporal: si un empleado mensual
 * pregunta el 2 de mayo, lo más probable es que esté hablando del último mes
 * (abril), no del actual (mayo) que apenas empezó.
 *
 * Reglas:
 *  - Si el último periodo cerrado del empleado NO tiene un pago registrado
 *    en `pagos_nomina` con `monto_abonado > 0`, ese es el periodo relevante
 *    (el que están por cobrar).
 *  - Si el último cerrado ya está pagado, el relevante es el actual (en curso).
 *
 * Devuelve también el "estado": permite a la tool de Salix verbalizar
 * distinto si el periodo está pendiente de pago o ya en curso.
 */

import {
  calcularPeriodo,
  tipoPeriodoPorFrecuencia,
  type RangoPeriodo,
  type TipoPeriodo,
} from './periodo-actual'
import type { SupabaseAdmin } from '@/tipos/salix-ia'

export type EstadoPeriodo = 'cerrado_pendiente_pago' | 'en_curso'

export interface ResultadoPeriodoRelevante {
  rango: RangoPeriodo
  estado: EstadoPeriodo
}

/**
 * Calcula el periodo inmediatamente anterior al dado (para mismo `tipo`).
 * - Para 'mes': el mes anterior completo.
 * - Para 'quincena': la quincena anterior (puede saltar de mes).
 * - Para 'semana': la semana lunes-domingo anterior.
 */
export function periodoAnterior(rango: RangoPeriodo, locale = 'es-AR'): RangoPeriodo {
  // Tomamos un día del periodo anterior con seguridad: el día previo al `desde`.
  const desdeActual = new Date(rango.desde + 'T12:00:00Z')
  desdeActual.setUTCDate(desdeActual.getUTCDate() - 1)
  return calcularPeriodo(desdeActual, rango.tipo, locale)
}

interface MiembroPeriodo {
  id: string
  compensacion_frecuencia: string | null
}

/**
 * Resuelve el periodo relevante para el miembro en la fecha de referencia (default hoy).
 *
 * Se considera "cerrado" un periodo cuando ya pasó su `hasta`. Si ese periodo cerrado
 * no tiene un registro de pago con `monto_abonado > 0`, devolvemos ese periodo. Si sí
 * fue pagado, devolvemos el periodo en curso (que contiene la fecha de referencia).
 */
export async function periodoRelevante(
  admin: SupabaseAdmin,
  miembro: MiembroPeriodo,
  fechaRef: Date = new Date(),
  locale = 'es-AR',
): Promise<ResultadoPeriodoRelevante> {
  const tipo: TipoPeriodo = tipoPeriodoPorFrecuencia(miembro.compensacion_frecuencia)
  const periodoEnCurso = calcularPeriodo(fechaRef, tipo, locale)

  // El último cerrado es el periodo previo al en curso.
  const ultimoCerrado = periodoAnterior(periodoEnCurso, locale)

  // ¿Está pagado el último cerrado? Buscamos un registro de pagos_nomina que coincida
  // exactamente con el rango y tenga monto_abonado > 0.
  const { data: pago } = await admin
    .from('pagos_nomina')
    .select('id, monto_abonado')
    .eq('miembro_id', miembro.id)
    .eq('fecha_inicio_periodo', ultimoCerrado.desde)
    .eq('fecha_fin_periodo', ultimoCerrado.hasta)
    .eq('eliminado', false)
    .maybeSingle()

  const yaPagado = pago && Number(pago.monto_abonado ?? 0) > 0
  if (!yaPagado) {
    return { rango: ultimoCerrado, estado: 'cerrado_pendiente_pago' }
  }
  return { rango: periodoEnCurso, estado: 'en_curso' }
}

/**
 * Utilidades de cálculo de saldos de cuotas y totales cobrados de un presupuesto.
 *
 * Este módulo unifica la lógica que antes estaba duplicada en SeccionPagos,
 * ModalRegistrarPago y otras partes del front. Mantiene una única tolerancia
 * de comparación (1 centavo) y un único criterio para excluir pagos
 * adicionales (que NO imputan a cuotas, ver presupuesto_pagos.es_adicional).
 *
 * Refleja exactamente la regla que aplica el trigger SQL recalcular_estado_cuota:
 * - Solo se cuentan pagos con es_adicional=false al sumar contra una cuota.
 * - Se usa monto_en_moneda_presupuesto (que ya incluye percepciones).
 */

import type { CuotaPago } from '@/tipos/presupuesto'
import type { PresupuestoPago } from '@/tipos/presupuesto-pago'
import { EstadosCuota, type EstadoCuota } from '@/tipos/cuota'

/** Tolerancia de comparación de saldos en moneda del presupuesto (1 centavo). */
export const TOLERANCIA_SALDO = 0.01

// Alias retrocompatible — usado por consumidores existentes.
// El tipo canónico es EstadoCuota en @/tipos/cuota.
export type EstadoCuotaDerivado = EstadoCuota

export interface ResumenCuota {
  cuota: CuotaPago
  totalCuota: number
  pagado: number
  saldo: number
  estadoDerivado: EstadoCuotaDerivado
}

/** Devuelve true si el pago debería contar contra el cobrado de cuotas. */
function esPagoImputable(p: PresupuestoPago): boolean {
  return p.es_adicional !== true && p.cuota_id != null
}

/** Devuelve true si el pago debería contar contra el cobrado total del presupuesto. */
function esPagoDelPresupuesto(p: PresupuestoPago): boolean {
  return p.es_adicional !== true
}

/** Convierte un monto string|number a número con default seguro. */
function aNumero(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Deriva el estado de una cuota a partir del total cobrado.
 * Usa la misma tolerancia que el resto del sistema para evitar discrepancias
 * por redondeos al céntimo.
 */
export function derivarEstadoCuota(
  totalCuota: number,
  totalPagado: number,
  tolerancia: number = TOLERANCIA_SALDO,
): EstadoCuotaDerivado {
  if (totalPagado <= tolerancia) return EstadosCuota.PENDIENTE
  if (totalPagado >= totalCuota - tolerancia) return EstadosCuota.COBRADA
  return EstadosCuota.PARCIAL
}

/**
 * Calcula el resumen (pagado / saldo / estado) de cada cuota a partir de la
 * lista completa de pagos del presupuesto. Excluye pagos `es_adicional=true`
 * y pagos sin cuota asignada (a cuenta).
 */
export function calcularResumenesCuotas(
  cuotas: CuotaPago[],
  pagos: PresupuestoPago[],
): ResumenCuota[] {
  const pagadoPorCuota = new Map<string, number>()
  for (const p of pagos) {
    if (!esPagoImputable(p) || !p.cuota_id) continue
    const acum = pagadoPorCuota.get(p.cuota_id) ?? 0
    pagadoPorCuota.set(p.cuota_id, acum + aNumero(p.monto_en_moneda_presupuesto))
  }
  return cuotas.map((c) => {
    const totalCuota = aNumero(c.monto)
    const pagado = pagadoPorCuota.get(c.id) ?? 0
    const saldo = Math.max(0, totalCuota - pagado)
    return {
      cuota: c,
      totalCuota,
      pagado,
      saldo,
      estadoDerivado: derivarEstadoCuota(totalCuota, pagado),
    }
  })
}

/**
 * Total cobrado del PRESUPUESTO (excluye adicionales). Incluye pagos a cuenta
 * porque también descuentan el total a pagar.
 */
export function calcularTotalCobradoPresupuesto(pagos: PresupuestoPago[]): number {
  let total = 0
  for (const p of pagos) {
    if (!esPagoDelPresupuesto(p)) continue
    total += aNumero(p.monto_en_moneda_presupuesto)
  }
  return total
}

/** Total de pagos adicionales (trabajo extra fuera del presupuesto). */
export function calcularTotalAdicionales(pagos: PresupuestoPago[]): number {
  let total = 0
  for (const p of pagos) {
    if (p.es_adicional !== true) continue
    total += aNumero(p.monto_en_moneda_presupuesto)
  }
  return total
}

/** Saldo del presupuesto (no negativo). */
export function calcularSaldoPresupuesto(
  totalPresupuesto: number,
  totalCobrado: number,
): number {
  return Math.max(0, totalPresupuesto - totalCobrado)
}

/**
 * Total de percepciones cobradas dentro de los pagos no adicionales,
 * en moneda original del pago. Útil para reportes contables.
 *
 * NOTA: las percepciones ya están incluidas en monto_en_moneda_presupuesto
 * (por la fórmula `(monto + monto_percepciones) * cotizacion_cambio`), pero
 * para Contaduría hace falta saber qué parte del cobrado fue retención.
 */
export function calcularTotalPercepciones(pagos: PresupuestoPago[]): number {
  let total = 0
  for (const p of pagos) {
    if (!esPagoDelPresupuesto(p)) continue
    total += aNumero(p.monto_percepciones) * aNumero(p.cotizacion_cambio || 1)
  }
  return total
}

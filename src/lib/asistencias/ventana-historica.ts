/**
 * Cálculo de los últimos N periodos para acotar consultas de Salix IA personal.
 *
 * Las tools personales no deben permitir consultas indefinidamente hacia atrás:
 * el empleado puede preguntar como mucho por los últimos 3 periodos. Más atrás,
 * la respuesta correcta es "consultá con tu administrador".
 *
 * Este helper devuelve la lista de rangos válidos según la frecuencia del empleado,
 * empezando por el actual y retrocediendo. La tool puede usarlo para:
 *  - Validar que un periodo solicitado entra en la ventana.
 *  - Listar opciones disponibles cuando el empleado no precisa cuál.
 */

import {
  calcularPeriodo,
  tipoPeriodoPorFrecuencia,
  type RangoPeriodo,
  type TipoPeriodo,
} from './periodo-actual'
import { periodoAnterior } from './periodo-relevante'

/**
 * Devuelve los últimos N periodos del empleado según su frecuencia, ordenados de
 * más reciente a más antiguo. El primer elemento es siempre el periodo en curso.
 *
 * Default n=3: el actual + los 2 anteriores. Suficiente para "este mes / mes pasado /
 * antepasado" o "esta quincena / la anterior / la anterior a esa".
 */
export function rangoVentanaHistorica(
  frecuencia: string | null | undefined,
  n: number = 3,
  fechaRef: Date = new Date(),
  locale = 'es-AR',
): RangoPeriodo[] {
  if (n <= 0) return []
  const tipo: TipoPeriodo = tipoPeriodoPorFrecuencia(frecuencia)
  const resultado: RangoPeriodo[] = [calcularPeriodo(fechaRef, tipo, locale)]

  while (resultado.length < n) {
    const previo = periodoAnterior(resultado[resultado.length - 1], locale)
    resultado.push(previo)
  }

  return resultado
}

/**
 * Verifica si un rango (desde/hasta YYYY-MM-DD) cae dentro de la ventana histórica
 * permitida. Útil para rechazar consultas a periodos demasiado antiguos.
 */
export function periodoEnVentana(
  desde: string,
  hasta: string,
  frecuencia: string | null | undefined,
  n: number = 3,
  fechaRef: Date = new Date(),
): boolean {
  const ventana = rangoVentanaHistorica(frecuencia, n, fechaRef)
  return ventana.some(r => r.desde === desde && r.hasta === hasta)
}

/**
 * Helpers puros para formatear ejecuciones de flujo (sub-PR 19.6).
 *
 * Centraliza decisiones de presentación que comparten el listado
 * (PestañaHistorial), el drawer (DrawerEjecucion) y la sección de
 * chatter (SeccionFlujosDisparados). Funciones puras → testeables sin
 * DOM ni i18n provider.
 */

import type { ColorInsignia } from '@/componentes/ui/Insignia'
import type { EstadoEjecucion } from '@/tipos/workflow'
import { parsearDisparadoPor, type OrigenDisparador } from '@/tipos/workflow'

export type TipoDisparadoPor = OrigenDisparador['tipo']

export const TIPOS_DISPARADO_POR: readonly TipoDisparadoPor[] = [
  'cambios_estado', 'cron', 'manual', 'webhook',
] as const

/**
 * Lista curada de raw_class de errores que solemos ver en producción
 * (extraídas del executor PR 16 + 17). Si aparece otra raw_class el
 * filtro la incluye al hacer un OR amplio en el endpoint — esta lista
 * solo limita las opciones que se muestran como pills clickeables.
 */
export const RAW_CLASS_COMUNES: readonly string[] = [
  'VariableFaltante',
  'HelperDesconocido',
  'HelperTipoInvalido',
  'AccionNoImplementada',
  'CredencialesIncompletas',
  'CanalNoEncontrado',
  'TipoNoEncontrado',
  'EstadoNoEncontrado',
  'SupabaseError',
] as const

/** Mapea estado de ejecución → color semántico de Insignia. */
export function colorEstadoEjecucion(estado: EstadoEjecucion): ColorInsignia {
  switch (estado) {
    case 'completado': return 'exito'
    case 'fallado': return 'peligro'
    case 'cancelado': return 'neutro'
    case 'corriendo': return 'info'
    case 'esperando': return 'advertencia'
    case 'pendiente': return 'neutro'
  }
}

/**
 * Calcula la duración en segundos entre inicio_en y fin_en.
 * Devuelve null si falta alguno (ej: ejecución todavía corriendo o
 * esperando, o fila legacy sin inicio_en registrado).
 */
export function duracionSegundos(
  inicio_en: string | null,
  fin_en: string | null,
): number | null {
  if (!inicio_en || !fin_en) return null
  const ms = new Date(fin_en).getTime() - new Date(inicio_en).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return ms / 1000
}

/**
 * Formato corto y legible para mostrar en la columna duración.
 * Evita hacer i18n del literal "ms/s/min" — es un valor técnico que
 * el usuario lee como métrica, no como texto narrativo.
 */
export function formatearDuracion(seg: number | null): string {
  if (seg === null) return '—'
  if (seg < 1) return `${Math.round(seg * 1000)}ms`
  if (seg < 60) return `${seg.toFixed(seg < 10 ? 2 : 1)}s`
  const min = Math.floor(seg / 60)
  const restoSeg = Math.round(seg % 60)
  return `${min}m ${restoSeg}s`
}

/**
 * Extrae el tipo de disparado_por sin perder el detalle. Útil para
 * filtros agregados (no necesitamos el id/expr/url para clasificar).
 * Retorna null si la cadena está vacía o tiene un prefijo desconocido.
 */
export function tipoDisparadoPor(disparado_por: string | null): TipoDisparadoPor | null {
  const o = parsearDisparadoPor(disparado_por)
  return o?.tipo ?? null
}

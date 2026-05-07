/**
 * Constantes tipadas de los estados de asistencia del sistema.
 *
 * Renombres del PR 11:
 *   almuerzo   → en_almuerzo
 *   particular → en_particular
 *
 * Tabla configurable: estados_asistencia
 * Migración fuente: sql/051_estados_asistencias.sql
 */

import type { GrupoEstado } from '@/tipos/estados'

export const EstadosAsistencia = {
  ACTIVO:        'activo',
  EN_ALMUERZO:   'en_almuerzo',
  EN_PARTICULAR: 'en_particular',
  CERRADO:       'cerrado',
  FERIADO:       'feriado',
  AUTO_CERRADO:  'auto_cerrado',
  AUSENTE:       'ausente',
} as const

export type EstadoAsistencia = typeof EstadosAsistencia[keyof typeof EstadosAsistencia]

export const ESTADOS_ASISTENCIA: readonly EstadoAsistencia[] = [
  EstadosAsistencia.ACTIVO,
  EstadosAsistencia.EN_ALMUERZO,
  EstadosAsistencia.EN_PARTICULAR,
  EstadosAsistencia.CERRADO,
  EstadosAsistencia.FERIADO,
  EstadosAsistencia.AUTO_CERRADO,
  EstadosAsistencia.AUSENTE,
] as const

export const ETIQUETAS_ESTADO_ASISTENCIA: Record<EstadoAsistencia, string> = {
  activo:        'Activo',
  en_almuerzo:   'En almuerzo',
  en_particular: 'Salida particular',
  cerrado:       'Cerrado',
  feriado:       'Feriado',
  auto_cerrado:  'Cerrado automático',
  ausente:       'Ausente',
}

export const GRUPO_ESTADO_ASISTENCIA: Record<EstadoAsistencia, GrupoEstado> = {
  activo:        'activo',
  en_almuerzo:   'espera',
  en_particular: 'espera',
  cerrado:       'completado',
  feriado:       'completado',
  auto_cerrado:  'error',
  ausente:       'cancelado',
}

export function esEstadoAsistencia(valor: unknown): valor is EstadoAsistencia {
  return typeof valor === 'string' && (ESTADOS_ASISTENCIA as readonly string[]).includes(valor)
}

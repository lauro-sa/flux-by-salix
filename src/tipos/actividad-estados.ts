/**
 * Constantes tipadas de los estados predefinidos de actividad.
 *
 * Las empresas pueden agregar estados propios además de estos. Las claves
 * acá son las que se siembran al crear una empresa nueva (es_predefinido=true)
 * y son las que el catálogo de transiciones del sistema (`transiciones_estado`)
 * conoce.
 *
 * Tabla configurable: estados_actividad
 * Migración fuente: sql/047_estados_actividades.sql + estados originales
 *   sembrados al crear empresa.
 */

import type { GrupoEstado } from '@/tipos/estados'

export const EstadosActividad = {
  PENDIENTE:  'pendiente',
  COMPLETADA: 'completada',
  CANCELADA:  'cancelada',
  VENCIDA:    'vencida',
} as const

/** Type-only union de las claves predefinidas. Las empresas pueden tener otras. */
export type EstadoActividadPredefinido = typeof EstadosActividad[keyof typeof EstadosActividad]

export const ESTADOS_ACTIVIDAD_PREDEFINIDOS: readonly EstadoActividadPredefinido[] = [
  EstadosActividad.PENDIENTE,
  EstadosActividad.COMPLETADA,
  EstadosActividad.CANCELADA,
  EstadosActividad.VENCIDA,
] as const

export const ETIQUETAS_ESTADO_ACTIVIDAD: Record<EstadoActividadPredefinido, string> = {
  pendiente:  'Pendiente',
  completada: 'Completada',
  cancelada:  'Cancelada',
  vencida:    'Vencida',
}

/**
 * Grupo de comportamiento por clave predefinida.
 * Coincide con la convención general de grupos del sistema.
 */
export const GRUPO_ESTADO_ACTIVIDAD: Record<EstadoActividadPredefinido, GrupoEstado> = {
  pendiente:  'activo',
  completada: 'completado',
  cancelada:  'cancelado',
  vencida:    'activo',  // sigue siendo activa, solo está vencida
}

export function esEstadoActividadPredefinido(
  valor: unknown,
): valor is EstadoActividadPredefinido {
  return typeof valor === 'string' &&
    (ESTADOS_ACTIVIDAD_PREDEFINIDOS as readonly string[]).includes(valor)
}

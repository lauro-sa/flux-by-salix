/**
 * Constantes tipadas de los estados de visita del sistema.
 *
 * Las empresas pueden agregar estados propios desde
 * /visitas/configuracion. Estas constantes son las que están sembradas
 * como estado del sistema (empresa_id IS NULL).
 *
 * Tabla configurable: estados_visita
 * Migración fuente: sql/048_estados_visitas.sql
 */

import type { GrupoEstado } from '@/tipos/estados'

export const EstadosVisita = {
  PROGRAMADA:   'programada',
  EN_CAMINO:    'en_camino',
  EN_SITIO:     'en_sitio',
  COMPLETADA:   'completada',
  CANCELADA:    'cancelada',
  REPROGRAMADA: 'reprogramada',
} as const

export type EstadoVisita = typeof EstadosVisita[keyof typeof EstadosVisita]

export const ESTADOS_VISITA: readonly EstadoVisita[] = [
  EstadosVisita.PROGRAMADA,
  EstadosVisita.EN_CAMINO,
  EstadosVisita.EN_SITIO,
  EstadosVisita.COMPLETADA,
  EstadosVisita.CANCELADA,
  EstadosVisita.REPROGRAMADA,
] as const

export const ETIQUETAS_ESTADO_VISITA: Record<EstadoVisita, string> = {
  programada:   'Programada',
  en_camino:    'En camino',
  en_sitio:     'En sitio',
  completada:   'Completada',
  cancelada:    'Cancelada',
  reprogramada: 'Reprogramada',
}

export const GRUPO_ESTADO_VISITA: Record<EstadoVisita, GrupoEstado> = {
  programada:   'inicial',
  en_camino:    'activo',
  en_sitio:     'activo',
  completada:   'completado',
  cancelada:    'cancelado',
  reprogramada: 'activo',
}

export function esEstadoVisita(valor: unknown): valor is EstadoVisita {
  return typeof valor === 'string' && (ESTADOS_VISITA as readonly string[]).includes(valor)
}

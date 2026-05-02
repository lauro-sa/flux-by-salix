/**
 * Tipos del sistema de conversaciones (inbox) de Flux.
 *
 * Las conversaciones tienen estados manuales que el usuario cambia
 * desde la UI (resolver, marcar en espera, marcar spam, reabrir).
 *
 * Migración fuente: sql/046_estados_conversaciones.sql
 * Tabla configurable: estados_conversacion
 *
 * NOTA sobre snooze: NO es un estado en sí mismo. Es un mecanismo
 * paralelo manejado por las columnas snooze_hasta / snooze_nota /
 * snooze_por. La conversación sigue en estado 'abierta' mientras
 * está pospuesta — solo se filtra a la pestaña de pospuestos en la UI.
 */

import type { GrupoEstado } from '@/tipos/estados'

// ─── Claves de los estados de conversación ─────────────────────

export const EstadosConversacion = {
  ABIERTA:   'abierta',
  EN_ESPERA: 'en_espera',
  RESUELTA:  'resuelta',
  SPAM:      'spam',
} as const

export type EstadoConversacion = typeof EstadosConversacion[keyof typeof EstadosConversacion]

export const ESTADOS_CONVERSACION: readonly EstadoConversacion[] = [
  EstadosConversacion.ABIERTA,
  EstadosConversacion.EN_ESPERA,
  EstadosConversacion.RESUELTA,
  EstadosConversacion.SPAM,
] as const

export const ETIQUETAS_ESTADO_CONVERSACION: Record<EstadoConversacion, string> = {
  abierta:   'Abierta',
  en_espera: 'En espera',
  resuelta:  'Resuelta',
  spam:      'Spam',
}

export const GRUPO_ESTADO_CONVERSACION: Record<EstadoConversacion, GrupoEstado> = {
  abierta:   'activo',
  en_espera: 'espera',
  resuelta:  'completado',
  spam:      'cancelado',
}

export const COLORES_ESTADO_CONVERSACION: Record<EstadoConversacion, { fondo: string; texto: string }> = {
  abierta:   { fondo: 'bg-insignia-info-fondo',         texto: 'text-insignia-info-texto' },
  en_espera: { fondo: 'bg-insignia-advertencia-fondo',  texto: 'text-insignia-advertencia-texto' },
  resuelta:  { fondo: 'bg-insignia-exito-fondo',        texto: 'text-insignia-exito-texto' },
  spam:      { fondo: 'bg-insignia-peligro-fondo',      texto: 'text-insignia-peligro-texto' },
}

// ─── Type guards ───────────────────────────────────────────────

export function esEstadoConversacion(valor: unknown): valor is EstadoConversacion {
  return typeof valor === 'string' && (ESTADOS_CONVERSACION as readonly string[]).includes(valor)
}

// ─── Fila de la tabla estados_conversacion (configurable) ──────

export interface EstadoConversacionConfig {
  id: string
  empresa_id: string | null  // NULL = estado del sistema
  clave: EstadoConversacion
  etiqueta: string
  grupo: GrupoEstado
  icono: string
  color: string
  orden: number
  activo: boolean
  es_sistema: boolean
  creado_en: string
  actualizado_en: string
}

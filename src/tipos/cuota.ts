/**
 * Tipos del módulo de cuotas (presupuesto_cuotas) de Flux.
 *
 * Las cuotas tienen estados DERIVADOS automáticamente desde los pagos
 * (vía trigger SQL recalcular_estado_cuota). No se pueden cambiar
 * manualmente: cualquier registro/edición/borrado de pago dispara
 * el recálculo.
 *
 * Migración fuente: sql/045_estados_cuotas.sql
 * Tabla configurable: estados_cuota
 */

import type { GrupoEstado } from '@/tipos/estados'

// ─── Claves de los estados de cuota ────────────────────────────
// Source of truth: corresponde 1:1 con la columna `clave` de
// estados_cuota.es_sistema=true. Las claves son estables y nunca
// cambian (los cambios estéticos van en `etiqueta` de la tabla).

export const EstadosCuota = {
  PENDIENTE: 'pendiente',
  PARCIAL:   'parcial',
  COBRADA:   'cobrada',
} as const

export type EstadoCuota = typeof EstadosCuota[keyof typeof EstadosCuota]

export const ESTADOS_CUOTA: readonly EstadoCuota[] = [
  EstadosCuota.PENDIENTE,
  EstadosCuota.PARCIAL,
  EstadosCuota.COBRADA,
] as const

// Etiquetas legibles por defecto. La empresa puede personalizar las
// suyas creando rows propias en estados_cuota — la UI debería leer de
// la tabla y caer a este map solo como fallback.
export const ETIQUETAS_ESTADO_CUOTA: Record<EstadoCuota, string> = {
  pendiente: 'Pendiente',
  parcial:   'Parcial',
  cobrada:   'Cobrada',
}

// Mapeo a grupo semántico (alineado con la columna `grupo` del seed).
export const GRUPO_ESTADO_CUOTA: Record<EstadoCuota, GrupoEstado> = {
  pendiente: 'inicial',
  parcial:   'activo',
  cobrada:   'completado',
}

// Estilos para badges (tokens semánticos del sistema de diseño).
export const COLORES_ESTADO_CUOTA: Record<EstadoCuota, { fondo: string; texto: string }> = {
  pendiente: { fondo: 'bg-white/[0.06]',           texto: 'text-texto-terciario' },
  parcial:   { fondo: 'bg-insignia-advertencia-fondo', texto: 'text-insignia-advertencia-texto' },
  cobrada:   { fondo: 'bg-insignia-exito-fondo',   texto: 'text-insignia-exito-texto' },
}

// ─── Type guards ───────────────────────────────────────────────

export function esEstadoCuota(valor: unknown): valor is EstadoCuota {
  return typeof valor === 'string' && (ESTADOS_CUOTA as readonly string[]).includes(valor)
}

// ─── Fila de la tabla estados_cuota (configurable) ─────────────

export interface EstadoCuotaConfig {
  id: string
  empresa_id: string | null  // NULL = estado del sistema
  clave: EstadoCuota
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

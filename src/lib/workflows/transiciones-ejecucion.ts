/**
 * Transiciones de estado de una ejecución (PR 18.3).
 *
 * Funciones puras que deciden si una transición operacional sobre
 * `ejecuciones_flujo` es legal. Devuelven códigos de error
 * estructurados que los endpoints sirven como 409 con mensaje
 * legible para la UI.
 *
 * Cubren:
 *   - puedeReejecutar: desde completado / fallado / cancelado.
 *                      Bloquea estados activos (pendiente, corriendo,
 *                      esperando) — no se reejecuta lo que todavía
 *                      está en vuelo.
 *
 *   - puedeCancelar:   desde pendiente o esperando.
 *                      Bloquea explícitamente 'corriendo' con código
 *                      específico (decisión F del plan: cancelar a
 *                      mitad puede dejar WhatsApps a medio enviar y
 *                      actividades creadas sin notificación). Los
 *                      estados terminales (completado / fallado /
 *                      cancelado) caen en otro código (`ya_terminada`).
 */

import type { EstadoEjecucion } from '@/tipos/workflow'

export type CodigoErrorReejecutar =
  | 'estado_invalido'  // no completado / fallado / cancelado

export type CodigoErrorCancelar =
  | 'corriendo_no_cancelable'  // bloqueado por seguridad
  | 'ya_terminada'             // completado / fallado / cancelado

export interface ResultadoReejecutar {
  ok: boolean
  codigo?: CodigoErrorReejecutar
  mensaje?: string
}

export interface ResultadoCancelar {
  ok: boolean
  codigo?: CodigoErrorCancelar
  mensaje?: string
}

const ESTADOS_REEJECUTABLES = new Set<EstadoEjecucion>([
  'completado',
  'fallado',
  'cancelado',
])

const ESTADOS_CANCELABLES = new Set<EstadoEjecucion>([
  'pendiente',
  'esperando',
])

const ESTADOS_TERMINALES = new Set<EstadoEjecucion>([
  'completado',
  'fallado',
  'cancelado',
])

export function puedeReejecutar(estado: EstadoEjecucion): ResultadoReejecutar {
  if (ESTADOS_REEJECUTABLES.has(estado)) return { ok: true }
  return {
    ok: false,
    codigo: 'estado_invalido',
    mensaje:
      'Solo se pueden reejecutar las ejecuciones que ya terminaron ' +
      '(completado, fallado o cancelado). Esta está en estado "' + estado + '".',
  }
}

export function puedeCancelar(estado: EstadoEjecucion): ResultadoCancelar {
  if (ESTADOS_CANCELABLES.has(estado)) return { ok: true }
  if (estado === 'corriendo') {
    return {
      ok: false,
      codigo: 'corriendo_no_cancelable',
      mensaje:
        'No se puede cancelar una ejecución en curso. Esperá a que ' +
        'termine — cortarla a mitad puede dejar WhatsApps a medio ' +
        'enviar o actividades sin notificar.',
    }
  }
  if (ESTADOS_TERMINALES.has(estado)) {
    return {
      ok: false,
      codigo: 'ya_terminada',
      mensaje:
        'Esta ejecución ya terminó (estado "' + estado + '"). No hay ' +
        'nada que cancelar.',
    }
  }
  // Caso defensivo (estado desconocido al motor actual).
  return {
    ok: false,
    codigo: 'ya_terminada',
    mensaje: 'Estado desconocido: ' + estado,
  }
}

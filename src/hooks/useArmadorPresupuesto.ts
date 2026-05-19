'use client'

import { useSyncExternalStore } from 'react'
import {
  obtenerEstadoArmador,
  obtenerEstadoArmadorSSR,
  suscribirArmador,
  solicitarAbrirArmador,
} from '@/lib/salix-ia/armador-presupuesto-bus'

/**
 * useArmadorPresupuesto — Hook para que el copilot global de Salix IA
 * sepa si hay un EditorPresupuesto montado al cual puede pedir abrir el
 * armador de líneas con IA.
 *
 * Devuelve:
 *  - disponible: true si hay editor escuchando
 *  - abrir: función para invocar la apertura. No-op si no hay editor.
 *
 * Si la ruta es `/presupuestos/nuevo` o `/presupuestos/[id]` pero todavía
 * no terminó de montar el editor, `disponible` será false hasta que monte.
 */
export function useArmadorPresupuesto() {
  const estado = useSyncExternalStore(
    suscribirArmador,
    obtenerEstadoArmador,
    obtenerEstadoArmadorSSR,
  )
  return {
    disponible: estado.disponible,
    abrir: solicitarAbrirArmador,
  }
}

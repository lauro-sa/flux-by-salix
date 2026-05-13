'use client'

/**
 * STUB temporal — la implementación real está en otro chat.
 *
 * Diseño esperado: un proveedor de contexto que expone el estado de
 * guardado global (idle / guardando / guardado / error) consumido por
 * el `IndicadorGuardadoHeader`, y un hook `useReportarGuardado` que
 * los editores llaman para emitir cambios de estado.
 *
 * Mientras no se commitee la versión real, el proveedor es un
 * pass-through inocuo y el hook devuelve una función no-op.
 */

import type { ReactNode } from 'react'

export type EstadoIndicadorGuardado = 'idle' | 'guardando' | 'guardado' | 'error' | null

export function ProveedorIndicadorGuardado({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useIndicadorGuardado(): {
  estado: EstadoIndicadorGuardado
  setEstado: (e: EstadoIndicadorGuardado) => void
} {
  return {
    estado: 'idle',
    setEstado: () => {},
  }
}

/**
 * Hook que devuelve una función `reportarGuardado(estado)` para que
 * los editores notifiquen al header del estado de su autoguardado.
 * Stub: la función no hace nada.
 */
export function useReportarGuardado(): (estado: EstadoIndicadorGuardado) => void {
  return () => {}
}

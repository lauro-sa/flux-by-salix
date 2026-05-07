'use client'

import { useQuery } from '@tanstack/react-query'
import type { EjecucionFlujo, AccionPendiente } from '@/tipos/workflow'

/**
 * useDetalleEjecucion — fetch del detalle de una ejecución (sub-PR 19.6).
 *
 * Consume GET /api/ejecuciones/[id] (PR 18.3). El endpoint devuelve la
 * fila completa + acciones_pendientes embebidas + flags de permisos
 * granulares (reejecutar, cancelar) ya evaluados server-side.
 *
 * Manejo del 404: se distingue del error genérico para que el drawer
 * pueda mostrar "Ejecución no encontrada" + botón cerrar (caveat D8 del
 * coordinador). El listado queda utilizable mientras tanto.
 */

export interface DetalleEjecucion extends EjecucionFlujo {
  flujo_nombre: string | null
  flujo_estado: string | null
  acciones_pendientes: AccionPendiente[]
  permisos: {
    reejecutar: boolean
    cancelar: boolean
  }
}

interface RespuestaDetalle {
  ejecucion: DetalleEjecucion
}

export interface ResultadoDetalle {
  ejecucion: DetalleEjecucion | null
  cargando: boolean
  /** True específicamente si el endpoint devolvió 404 — dispara el
   *  empty state "Ejecución no encontrada" del drawer (caveat D8). */
  noEncontrada: boolean
  /** True para errores que no son 404 (red caída, 500, etc.). */
  error: boolean
  /** Forzar re-fetch — útil tras reejecutar o cancelar. */
  recargar: () => void
}

export function useDetalleEjecucion(ejecucionId: string | null): ResultadoDetalle {
  const habilitado = !!ejecucionId

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ejecucion-detalle', ejecucionId],
    queryFn: async (): Promise<RespuestaDetalle | { _404: true }> => {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}`)
      if (res.status === 404) {
        return { _404: true }
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return (await res.json()) as RespuestaDetalle
    },
    enabled: habilitado,
    // Detalle es lectura — no es crítico tenerlo super fresco. Cache
    // 30s para que abrir/cerrar drawer rápido no dispare re-fetch.
    staleTime: 30_000,
  })

  const noEncontrada = !!data && '_404' in data && data._404 === true
  const ejecucion = !data || noEncontrada
    ? null
    : (data as RespuestaDetalle).ejecucion

  return {
    ejecucion,
    cargando: isLoading,
    noEncontrada,
    error: !!error && !noEncontrada,
    recargar: () => void refetch(),
  }
}

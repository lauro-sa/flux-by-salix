'use client'

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

/**
 * Hook reutilizable para listados paginados con React Query.
 * Reemplaza el patrón manual de useEffect + fetch + race conditions + fetchIdRef.
 *
 * Ventajas:
 * - Cache automático: al navegar de vuelta, los datos aparecen instantáneamente
 * - Deduplicación: si dos componentes piden los mismos datos, solo se hace 1 request
 * - keepPreviousData: al cambiar de página, se muestran los datos anteriores mientras carga
 * - Refetch inteligente: solo cuando los datos están stale
 * - Race conditions: manejadas automáticamente por React Query
 *
 * Se usa en: contactos, presupuestos, actividades, papelera.
 */

interface OpcionesListado<T> {
  /** Clave base para el cache (ej: 'contactos') */
  clave: string
  /** URL del endpoint API (ej: '/api/contactos') */
  url: string
  /** Parámetros de la query (búsqueda, filtros, paginación) */
  parametros: Record<string, string | number | boolean | undefined>
  /** Función para extraer los datos del response JSON */
  extraerDatos: (json: Record<string, unknown>) => T[]
  /** Función para extraer el total del response JSON */
  extraerTotal: (json: Record<string, unknown>) => number
  /** Habilitar/deshabilitar la query */
  habilitado?: boolean
}

interface ResultadoListado<T> {
  datos: T[]
  total: number
  cargando: boolean
  /** True solo en la primera carga (sin datos previos en cache) */
  cargandoInicial: boolean
  error: Error | null
  recargar: () => void
}

export function useListado<T>({
  clave,
  url,
  parametros,
  extraerDatos,
  extraerTotal,
  habilitado = true,
}: OpcionesListado<T>): ResultadoListado<T> {
  const queryClient = useQueryClient()

  // Construir params limpiando undefined/empty
  const paramsLimpios = Object.entries(parametros).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== '' && v !== false) {
      acc[k] = String(v)
    }
    return acc
  }, {} as Record<string, string>)

  const queryString = new URLSearchParams(paramsLimpios).toString()
  const queryKey = [clave, paramsLimpios]

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${url}?${queryString}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      return res.json()
    },
    enabled: habilitado,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  })

  const recargar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [clave] })
  }, [queryClient, clave])

  return {
    datos: data ? extraerDatos(data) : [],
    total: data ? extraerTotal(data) : 0,
    cargando: isFetching,
    cargandoInicial: isLoading,
    error: error as Error | null,
    recargar,
  }
}

/**
 * Hook para queries de configuración que se cargan una sola vez y rara vez cambian.
 * Usa staleTime largo (5 min) para minimizar re-fetches.
 */
export function useConfig<T>(clave: string, url: string, extraer: (json: Record<string, unknown>) => T) {
  const { data, isLoading } = useQuery({
    queryKey: [clave],
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60_000, // 5 minutos
    gcTime: 10 * 60_000,
  })

  return {
    datos: data ? extraer(data) : (undefined as unknown as T),
    cargando: isLoading,
  }
}

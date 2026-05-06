'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Hook compartido por los 5 selectores autocomplete del editor de
 * flujos (sub-PR 19.3c).
 *
 * Responsabilidades:
 *   • Fetchar opciones contra el endpoint dado.
 *   • Cachear el resultado en memoria con TTL configurable (default 5 min,
 *     consistente con el voto del coordinador).
 *   • Exponer `invalidarCache(url)` para forzar refetch desde fuera (ej:
 *     cuando el usuario crea un canal nuevo desde otra pantalla y vuelve).
 *
 * Convención: la `url` es la clave del cache. Endpoints que aceptan
 * query params variables (ej: `/api/estados?entidad_tipo=presupuesto`)
 * tienen una entrada por valor de query param — el cache es naive sobre
 * el string completo de la URL.
 *
 * Si la fetch falla, devolvemos `[]` en `opciones` y `error` con el
 * mensaje. La UI consumidora decide cómo mostrarlo (en general, mostramos
 * el dropdown vacío con un mensaje "No se pudieron cargar opciones").
 */

const TTL_MS = 5 * 60 * 1000 // 5 minutos

interface EntradaCache<T> {
  guardadoEn: number
  datos: T[]
}

const cache = new Map<string, EntradaCache<unknown>>()

/** Borra la entrada del cache para forzar refetch en el próximo uso. */
export function invalidarCache(url: string): void {
  cache.delete(url)
}

/** Borra TODAS las entradas del cache. Útil para tests o logout. */
export function invalidarCacheCompleto(): void {
  cache.clear()
}

interface UseAutocompleteRemotoArgs<T> {
  /** Endpoint del que se cargan las opciones. Si es `null`, no fetcheamos. */
  url: string | null
  /**
   * Función que toma la respuesta JSON cruda y devuelve el array de items.
   * Cada endpoint devuelve un shape distinto (ej: `{ canales: [...] }` vs
   * `{ data: [...] }`). El adapter dice cómo extraer la lista.
   */
  extraer: (raw: unknown) => T[]
}

export interface UseAutocompleteRemotoReturn<T> {
  opciones: T[]
  cargando: boolean
  error: string | null
  recargar: () => void
}

export function useAutocompleteRemoto<T>({
  url,
  extraer,
}: UseAutocompleteRemotoArgs<T>): UseAutocompleteRemotoReturn<T> {
  const [opciones, setOpciones] = useState<T[]>(() => {
    // Hidratar inmediatamente desde cache si está vigente.
    if (!url) return []
    const cached = cache.get(url)
    if (cached && Date.now() - cached.guardadoEn < TTL_MS) {
      return cached.datos as T[]
    }
    return []
  })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchear = useCallback(async () => {
    if (!url) return
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = (await res.json()) as unknown
      const datos = extraer(raw)
      cache.set(url, { guardadoEn: Date.now(), datos: datos as unknown[] })
      setOpciones(datos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de carga')
      setOpciones([])
    } finally {
      setCargando(false)
    }
  }, [url, extraer])

  useEffect(() => {
    if (!url) {
      setOpciones([])
      return
    }
    const cached = cache.get(url)
    if (cached && Date.now() - cached.guardadoEn < TTL_MS) {
      setOpciones(cached.datos as T[])
      return
    }
    void fetchear()
  }, [url, fetchear])

  const recargar = useCallback(() => {
    if (url) invalidarCache(url)
    void fetchear()
  }, [fetchear, url])

  return { opciones, cargando, error, recargar }
}

'use client'

/**
 * Helpers para optimistic updates sobre el cache de un listado paginado
 * gestionado por `useListado`.
 *
 * Cada listado se almacena bajo `queryKey = [clave, paramsLimpios]`, donde
 * `paramsLimpios` incluye todos los filtros activos. Cuando un usuario
 * elimina o edita un item, no sabemos cuál combinación de filtros el
 * cliente tiene en memoria — por eso aplicamos el cambio a TODAS las
 * entradas con la misma clave base y disparamos un refetch en background
 * que ajusta inconsistencias (item editado deja de matchear los filtros,
 * paginación cambia, etc.).
 *
 * El pattern es "soft optimistic": el usuario ve el efecto al instante,
 * y si el servidor difiere, el refetch lo corrige sin spinner (porque
 * `placeholderData: keepPreviousData` mantiene la vista).
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

interface ItemConId {
  id: string
}

interface DatosListadoCacheado<T extends ItemConId> {
  /** Array de items del listado. La forma exacta varía por endpoint
   *  (`contactos`, `presupuestos`, …); en todos siempre hay un array
   *  con la clave dominante. Usamos un walker genérico. */
  [k: string]: unknown
  total?: number
}

function reemplazarArray<T extends ItemConId>(
  obj: DatosListadoCacheado<T>,
  transform: (arr: T[]) => T[],
): DatosListadoCacheado<T> {
  const clon: DatosListadoCacheado<T> = { ...obj }
  for (const k of Object.keys(clon)) {
    const v = clon[k]
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] && 'id' in (v[0] as object)) {
      clon[k] = transform(v as T[])
    }
  }
  return clon
}

export function useCacheListado<T extends ItemConId>(clave: string) {
  const queryClient = useQueryClient()

  /**
   * Quita los ids del cache de TODAS las entradas con la clave base.
   * Útil para "eliminar"/"enviar a papelera" — el item desaparece al
   * instante. El total se decrementa por la cantidad de ids removidos
   * en cada entrada (no por todos, porque un filtro podría no estar
   * matcheando ese item).
   */
  const removerLocal = useCallback(
    (ids: Iterable<string>) => {
      const setIds = new Set(ids)
      if (setIds.size === 0) return
      queryClient.setQueriesData<DatosListadoCacheado<T>>(
        { queryKey: [clave], exact: false },
        (data) => {
          if (!data) return data
          let removidos = 0
          const conArrayActualizado = reemplazarArray<T>(data, (arr) => {
            const filtrado = arr.filter((item) => !setIds.has(item.id))
            removidos += arr.length - filtrado.length
            return filtrado
          })
          if (removidos === 0) return data
          const totalActual = typeof data.total === 'number' ? data.total : 0
          return { ...conArrayActualizado, total: Math.max(0, totalActual - removidos) }
        },
      )
    },
    [queryClient, clave],
  )

  /**
   * Parchea los items con ese id en TODAS las entradas con la clave base.
   * Útil para "editar" — el item refleja el cambio al instante sin tener
   * que esperar al refetch.
   */
  const actualizarLocal = useCallback(
    (id: string, parcial: Partial<T>) => {
      queryClient.setQueriesData<DatosListadoCacheado<T>>(
        { queryKey: [clave], exact: false },
        (data) => {
          if (!data) return data
          return reemplazarArray<T>(data, (arr) =>
            arr.map((item) => (item.id === id ? { ...item, ...parcial } : item)),
          )
        },
      )
    },
    [queryClient, clave],
  )

  /**
   * Aplica una transformación arbitraria a los items del cache. Se usa
   * cuando el cambio depende del item previo (ej. agregar una etiqueta
   * al array existente sin pisarlo).
   */
  const transformarLocal = useCallback(
    (transform: (item: T) => T) => {
      queryClient.setQueriesData<DatosListadoCacheado<T>>(
        { queryKey: [clave], exact: false },
        (data) => {
          if (!data) return data
          return reemplazarArray<T>(data, (arr) => arr.map(transform))
        },
      )
    },
    [queryClient, clave],
  )

  /**
   * Invalida el cache para forzar refetch en background. React Query lo
   * hace silencioso (sin spinner) porque `placeholderData: keepPreviousData`
   * mantiene la vista. Se usa después de aplicar un update optimista para
   * sincronizar con el servidor.
   */
  const revalidar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [clave] })
  }, [queryClient, clave])

  return { removerLocal, actualizarLocal, transformarLocal, revalidar }
}

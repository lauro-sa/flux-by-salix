'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, useId, useMemo,
  type ReactNode,
} from 'react'

/**
 * Sistema de reporte de carga global. Pensado para que módulos que NO usan
 * React Query (WhatsApp, Inbox, etc. con `fetch` directo) puedan marcar
 * cuándo están cargando, así la BarraProgresoGlobal de PlantillaApp queda
 * activa hasta que terminan de verdad.
 *
 * Uso desde un hook custom:
 *
 *   useReportarCarga(cargandoConversaciones || cargandoMensajes, 'whatsapp')
 *
 * El hook registra el identificador mientras `activo` sea true y lo libera
 * cuando pasa a false (también limpia al desmontar). La barra suma todas las
 * cargas activas y se queda visible mientras haya al menos una.
 */

interface ContextoCarga {
  /** IDs activos (cualquier valor > 0 mantiene la barra visible). */
  activos: number
  registrar: (id: string) => void
  liberar: (id: string) => void
}

const Contexto = createContext<ContextoCarga | null>(null)

export function ProveedorCargaGlobal({ children }: { children: ReactNode }) {
  // Usamos un Set referencial + contador de versión: el Set conserva
  // identidad entre renders (evita re-crear el callback) pero forzamos
  // re-render incrementando una versión para que los consumidores
  // (BarraProgresoGlobal) reaccionen.
  const [version, setVersion] = useState(0)
  const [activosSet] = useState(() => new Set<string>())

  const registrar = useCallback((id: string) => {
    if (activosSet.has(id)) return
    activosSet.add(id)
    setVersion(v => v + 1)
  }, [activosSet])

  const liberar = useCallback((id: string) => {
    if (!activosSet.has(id)) return
    activosSet.delete(id)
    setVersion(v => v + 1)
  }, [activosSet])

  const valor = useMemo<ContextoCarga>(
    () => ({ activos: activosSet.size, registrar, liberar }),
    // `version` es la dep real — fuerza nuevo objeto para que los
    // consumidores reaccionen al cambio del Set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, registrar, liberar],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useCargaGlobal(): ContextoCarga {
  const ctx = useContext(Contexto)
  if (!ctx) {
    // En lugar de lanzar, devolvemos un no-op para que el hook sea seguro de
    // usar antes de que el Provider exista (ej. tests, Storybook).
    return {
      activos: 0,
      registrar: () => {},
      liberar: () => {},
    }
  }
  return ctx
}

/**
 * Hook declarativo: mantiene una carga registrada en el contexto mientras
 * `activo` sea true. Al pasar a false o al desmontar, libera el slot.
 *
 * @param activo Indica si el módulo está actualmente cargando.
 * @param identificador Opcional. Si no se provee, se genera uno único por
 *   instancia con `useId()` (cada montaje del hook tiene su propio slot).
 */
export function useReportarCarga(activo: boolean, identificador?: string): void {
  const { registrar, liberar } = useCargaGlobal()
  const autoId = useId()
  const id = identificador ?? autoId

  useEffect(() => {
    if (!activo) return
    registrar(id)
    return () => liberar(id)
  }, [activo, id, registrar, liberar])
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TabConsola } from '../tipos'

/**
 * Estado de la consola del editor (sub-PR 19.5).
 *
 * Persiste el booleano abierto/cerrado en localStorage para que cuando el
 * usuario re-entre al editor (cualquier flujo), la consola arranque como
 * la dejó. NO persistimos `tab` ni `altura` (decisión D4 del scope).
 *
 * La clave es global a flujos, no por id de flujo: el patrón mental "tengo
 * la consola abierta para iterar" es del usuario, no de la entidad.
 */

const CLAVE_LOCAL_STORAGE = 'flujos.consola.abierta'

function leerEstadoInicial(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(CLAVE_LOCAL_STORAGE) === '1'
  } catch {
    return false
  }
}

function persistir(abierta: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (abierta) window.localStorage.setItem(CLAVE_LOCAL_STORAGE, '1')
    else window.localStorage.removeItem(CLAVE_LOCAL_STORAGE)
  } catch {
    // Privacy mode / quota exceeded — silenciamos.
  }
}

export interface UseConsolaSandbox {
  abierta: boolean
  tab: TabConsola
  abrir: () => void
  cerrar: () => void
  alternar: () => void
  cambiarTab: (t: TabConsola) => void
}

export function useConsolaSandbox(): UseConsolaSandbox {
  const [abierta, setAbierta] = useState<boolean>(leerEstadoInicial)
  const [tab, setTab] = useState<TabConsola>('preview')

  // Persistir en mount sólo si es distinto del valor leído (evita
  // flush innecesario durante SSR → cliente hydration).
  useEffect(() => {
    persistir(abierta)
  }, [abierta])

  const abrir = useCallback(() => setAbierta(true), [])
  const cerrar = useCallback(() => setAbierta(false), [])
  const alternar = useCallback(() => setAbierta((v) => !v), [])
  const cambiarTab = useCallback((t: TabConsola) => setTab(t), [])

  return { abierta, tab, abrir, cerrar, alternar, cambiarTab }
}

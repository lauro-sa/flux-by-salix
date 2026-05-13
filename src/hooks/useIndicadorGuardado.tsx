'use client'

/**
 * Estado de guardado global, expuesto al `IndicadorGuardadoHeader` que
 * vive al lado del breadcrumb. Cada editor (presupuesto, OT, contacto…)
 * llama `useReportarGuardado()` para empujar transiciones
 * `guardando → guardado → null`, y el header las muestra como un chip
 * compacto con ícono.
 *
 * El context vive en `ProveedorIndicadorGuardado`, montado una sola vez
 * en `(flux)/layout.tsx`. Si un componente fuera del proveedor llama al
 * hook, devuelve un stub no-op (estado='idle', setEstado no hace nada)
 * para que la prueba de un editor aislado no tire.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type EstadoIndicadorGuardado = 'idle' | 'guardando' | 'guardado' | 'error' | null

interface ContextoIndicador {
  estado: EstadoIndicadorGuardado
  setEstado: (e: EstadoIndicadorGuardado) => void
}

const Contexto = createContext<ContextoIndicador | null>(null)

export function ProveedorIndicadorGuardado({ children }: { children: ReactNode }) {
  const [estado, setEstadoInterno] = useState<EstadoIndicadorGuardado>(null)

  // Memoizamos el setter para que `useReportarGuardado()` devuelva una
  // referencia estable y los `useEffect` que dependen de ella no se
  // disparen en cada render del provider.
  const setEstado = useCallback((nuevo: EstadoIndicadorGuardado) => {
    setEstadoInterno(nuevo)
  }, [])

  const valor = useMemo(() => ({ estado, setEstado }), [estado, setEstado])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useIndicadorGuardado(): ContextoIndicador {
  const ctx = useContext(Contexto)
  if (!ctx) {
    // Fuera del proveedor (ej. test aislado de un editor): pass-through.
    return { estado: 'idle', setEstado: () => {} }
  }
  return ctx
}

/**
 * Hook que devuelve una función `reportarGuardado(estado)` para que los
 * editores notifiquen al header del estado de su autoguardado. La función
 * tiene referencia estable mientras el proveedor no se remonta.
 */
export function useReportarGuardado(): (estado: EstadoIndicadorGuardado) => void {
  return useIndicadorGuardado().setEstado
}

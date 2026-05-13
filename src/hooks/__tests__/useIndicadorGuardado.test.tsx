// @vitest-environment jsdom

/**
 * Tests del context global de indicador de guardado.
 *
 * Validamos:
 *   - El proveedor expone estado inicial null.
 *   - `useReportarGuardado` cambia el estado leído por `useIndicadorGuardado`.
 *   - Fuera del proveedor, el hook devuelve un stub no-op (estado 'idle',
 *     setEstado no rompe).
 *   - La función `setEstado` que devuelve el provider es referencialmente
 *     estable entre renders (crítico para que los `useEffect` de los
 *     editores no disparen guardado infinito).
 */

import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  ProveedorIndicadorGuardado,
  useIndicadorGuardado,
  useReportarGuardado,
  type EstadoIndicadorGuardado,
} from '../useIndicadorGuardado'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProveedorIndicadorGuardado>{children}</ProveedorIndicadorGuardado>
)

describe('useIndicadorGuardado', () => {
  it('estado inicial dentro del proveedor es null', () => {
    const { result } = renderHook(() => useIndicadorGuardado(), { wrapper })
    expect(result.current.estado).toBeNull()
  })

  it('useReportarGuardado actualiza el estado del proveedor', () => {
    const { result } = renderHook(
      () => ({
        lector: useIndicadorGuardado(),
        reportar: useReportarGuardado(),
      }),
      { wrapper },
    )

    act(() => result.current.reportar('guardando'))
    expect(result.current.lector.estado).toBe('guardando')

    act(() => result.current.reportar('guardado'))
    expect(result.current.lector.estado).toBe('guardado')

    act(() => result.current.reportar(null))
    expect(result.current.lector.estado).toBeNull()
  })

  it('fuera del proveedor: estado="idle" y setEstado no rompe', () => {
    const { result } = renderHook(() => useIndicadorGuardado())
    expect(result.current.estado).toBe('idle')
    expect(() => result.current.setEstado('guardando')).not.toThrow()
  })

  it('setEstado mantiene referencia estable entre renders', () => {
    const { result, rerender } = renderHook(() => useReportarGuardado(), { wrapper })
    const primerRef = result.current
    rerender()
    expect(result.current).toBe(primerRef)

    // Después de cambiar el estado, la función setEstado sigue siendo la misma
    act(() => result.current('guardando'))
    expect(result.current).toBe(primerRef)
  })

  it('admite todas las transiciones del tipo EstadoIndicadorGuardado', () => {
    const estados: EstadoIndicadorGuardado[] = ['idle', 'guardando', 'guardado', 'error', null]
    const { result } = renderHook(
      () => ({
        lector: useIndicadorGuardado(),
        reportar: useReportarGuardado(),
      }),
      { wrapper },
    )

    for (const e of estados) {
      act(() => result.current.reportar(e))
      expect(result.current.lector.estado).toBe(e)
    }
  })
})

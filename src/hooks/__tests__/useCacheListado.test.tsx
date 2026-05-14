// @vitest-environment jsdom

/**
 * Tests del helper `useCacheListado`. Verifica las operaciones de
 * optimistic update sobre el cache de React Query:
 *   - `removerLocal`: filtra ids del array y decrementa total.
 *   - `actualizarLocal`: parchea items por id en todas las entradas.
 *   - `transformarLocal`: aplica una transformación arbitraria.
 *   - `revalidar`: invalida queries con la clave base.
 *
 * El helper debe afectar TODAS las entradas con la misma clave base
 * (distintos filtros), porque no sabemos cuál combinación tiene el
 * usuario en pantalla.
 */

import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCacheListado } from '../useCacheListado'

interface Contacto {
  id: string
  nombre: string
  etiquetas?: string[]
}

function crearWrapper(qc: QueryClient) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  return Wrapper
}

function poblarCache(qc: QueryClient, items: Contacto[], filtros: Record<string, string> = {}) {
  qc.setQueryData(['contactos', filtros], {
    contactos: items,
    total: items.length,
    pagina: 1,
    por_pagina: 50,
  })
}

describe('useCacheListado', () => {
  it('removerLocal filtra ids del array y decrementa total', () => {
    const qc = new QueryClient()
    poblarCache(qc, [
      { id: 'c1', nombre: 'Ana' },
      { id: 'c2', nombre: 'Bea' },
      { id: 'c3', nombre: 'Carla' },
    ])

    const { result } = renderHook(() => useCacheListado<Contacto>('contactos'), {
      wrapper: crearWrapper(qc),
    })

    act(() => result.current.removerLocal(['c1', 'c3']))

    const data = qc.getQueryData<{ contactos: Contacto[]; total: number }>(['contactos', {}])
    expect(data?.contactos).toEqual([{ id: 'c2', nombre: 'Bea' }])
    expect(data?.total).toBe(1)
  })

  it('removerLocal afecta a TODAS las entradas con la misma clave base', () => {
    const qc = new QueryClient()
    poblarCache(qc, [{ id: 'c1', nombre: 'Ana' }, { id: 'c2', nombre: 'Bea' }], { tipo: 'cliente' })
    poblarCache(qc, [{ id: 'c1', nombre: 'Ana' }], { busqueda: 'Ana' })

    const { result } = renderHook(() => useCacheListado<Contacto>('contactos'), {
      wrapper: crearWrapper(qc),
    })

    act(() => result.current.removerLocal(['c1']))

    const cacheTipo = qc.getQueryData<{ contactos: Contacto[]; total: number }>([
      'contactos',
      { tipo: 'cliente' },
    ])
    const cacheBusqueda = qc.getQueryData<{ contactos: Contacto[]; total: number }>([
      'contactos',
      { busqueda: 'Ana' },
    ])

    expect(cacheTipo?.contactos.map((c) => c.id)).toEqual(['c2'])
    expect(cacheTipo?.total).toBe(1)
    expect(cacheBusqueda?.contactos).toEqual([])
    expect(cacheBusqueda?.total).toBe(0)
  })

  it('removerLocal con ids inexistentes no toca el cache', () => {
    const qc = new QueryClient()
    poblarCache(qc, [{ id: 'c1', nombre: 'Ana' }])

    const { result } = renderHook(() => useCacheListado<Contacto>('contactos'), {
      wrapper: crearWrapper(qc),
    })

    act(() => result.current.removerLocal(['inexistente']))

    const data = qc.getQueryData<{ contactos: Contacto[]; total: number }>(['contactos', {}])
    expect(data?.contactos).toHaveLength(1)
    expect(data?.total).toBe(1)
  })

  it('actualizarLocal parchea el item por id sin tocar los otros', () => {
    const qc = new QueryClient()
    poblarCache(qc, [
      { id: 'c1', nombre: 'Ana' },
      { id: 'c2', nombre: 'Bea' },
    ])

    const { result } = renderHook(() => useCacheListado<Contacto>('contactos'), {
      wrapper: crearWrapper(qc),
    })

    act(() => result.current.actualizarLocal('c1', { nombre: 'Ana María' }))

    const data = qc.getQueryData<{ contactos: Contacto[] }>(['contactos', {}])
    expect(data?.contactos).toEqual([
      { id: 'c1', nombre: 'Ana María' },
      { id: 'c2', nombre: 'Bea' },
    ])
  })

  it('transformarLocal aplica una transformación a cada item', () => {
    const qc = new QueryClient()
    poblarCache(qc, [
      { id: 'c1', nombre: 'Ana', etiquetas: ['vip'] },
      { id: 'c2', nombre: 'Bea', etiquetas: [] },
    ])

    const { result } = renderHook(() => useCacheListado<Contacto>('contactos'), {
      wrapper: crearWrapper(qc),
    })

    // Agregar etiqueta "lote" a todos sin pisar las existentes.
    act(() =>
      result.current.transformarLocal((c) => ({
        ...c,
        etiquetas: [...(c.etiquetas ?? []), 'lote'],
      })),
    )

    const data = qc.getQueryData<{ contactos: Contacto[] }>(['contactos', {}])
    expect(data?.contactos[0].etiquetas).toEqual(['vip', 'lote'])
    expect(data?.contactos[1].etiquetas).toEqual(['lote'])
  })

  it('revalidar marca todas las queries con la clave base como stale', () => {
    const qc = new QueryClient()
    poblarCache(qc, [{ id: 'c1', nombre: 'Ana' }])

    const { result } = renderHook(() => useCacheListado<Contacto>('contactos'), {
      wrapper: crearWrapper(qc),
    })

    // Hacer la query no-stale primero ajustando el state internamente.
    const queryStateAntes = qc.getQueryState(['contactos', {}])
    expect(queryStateAntes).toBeDefined()

    act(() => result.current.revalidar())

    const queryStateDespues = qc.getQueryState(['contactos', {}])
    expect(queryStateDespues?.isInvalidated).toBe(true)
  })
})

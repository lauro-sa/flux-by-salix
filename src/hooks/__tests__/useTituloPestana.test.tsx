// @vitest-environment jsdom

/**
 * Tests del hook `useTituloPestana`. Verifica:
 *   - Setea `document.title` con el sufijo " · Flux" cuando hay título.
 *   - Restaura el título previo al desmontar.
 *   - Si el título es null/empty/undefined, NO toca el título actual.
 *   - Trunca títulos kilométricos a 80 caracteres con "…".
 *   - Actualiza el título cuando el argumento cambia (rerender).
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTituloPestana } from '../useTituloPestana'

describe('useTituloPestana', () => {
  beforeEach(() => {
    document.title = 'Flux'
  })

  it('aplica el título con sufijo " · Flux"', () => {
    renderHook(() => useTituloPestana('OT-0042'))
    expect(document.title).toBe('OT-0042 · Flux')
  })

  it('restaura el título previo al desmontar', () => {
    document.title = 'Inicio · Flux'
    const { unmount } = renderHook(() => useTituloPestana('Detalle'))
    expect(document.title).toBe('Detalle · Flux')
    unmount()
    expect(document.title).toBe('Inicio · Flux')
  })

  it('no toca document.title si el argumento es null', () => {
    document.title = 'Listado · Flux'
    renderHook(() => useTituloPestana(null))
    expect(document.title).toBe('Listado · Flux')
  })

  it('no toca document.title si el argumento es string vacío o solo espacios', () => {
    document.title = 'Listado · Flux'
    renderHook(() => useTituloPestana('   '))
    expect(document.title).toBe('Listado · Flux')
  })

  it('trunca títulos de más de 80 caracteres', () => {
    const largo = 'a'.repeat(120)
    renderHook(() => useTituloPestana(largo))
    const titulo = document.title
    expect(titulo.length).toBeLessThanOrEqual(80 + ' · Flux'.length)
    expect(titulo.endsWith('… · Flux')).toBe(true)
  })

  it('actualiza el título cuando el argumento cambia en un rerender', () => {
    const { rerender } = renderHook(({ t }: { t: string | null }) => useTituloPestana(t), {
      initialProps: { t: 'Primero' as string | null },
    })
    expect(document.title).toBe('Primero · Flux')

    rerender({ t: 'Segundo' })
    expect(document.title).toBe('Segundo · Flux')
  })
})

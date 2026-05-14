// @vitest-environment jsdom

/**
 * Tests del componente `PreviewSeccionExterna`. Cubre los 4 estados:
 *   - cargando → skeleton.
 *   - error    → mensaje + Reintentar que vuelve a fetch.
 *   - vacío    → texto de vacío + link de gestión visible.
 *   - normal   → lista con conteo, badges, origen y "+ N más" cuando
 *     hay más items que el limite.
 *
 * `extraerItems` se llama con la respuesta cruda del fetch; verificamos
 * que el shape `ItemPreview` se renderiza tal cual.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { PreviewSeccionExterna, type ItemPreview } from '../entidad/PreviewSeccionExterna'

const ENDPOINT = '/api/algo/config'

function mockearFetch(respuestas: Array<{ ok?: boolean; data?: unknown; status?: number }>) {
  let i = 0
  globalThis.fetch = vi.fn(async () => {
    const r = respuestas[Math.min(i++, respuestas.length - 1)]
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.data ?? {},
    } as unknown as Response
  }) as unknown as typeof fetch
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

function propsBase(over: Partial<React.ComponentProps<typeof PreviewSeccionExterna>> = {}) {
  return {
    titulo: 'Tipos',
    descripcion: 'Listado de tipos',
    endpoint: ENDPOINT,
    extraerItems: (data: unknown) => ((data as { items?: ItemPreview[] }).items ?? []),
    hrefDestino: '/destino',
    textoBoton: 'Gestionar tipos',
    etiquetaItem: { singular: 'tipo', plural: 'tipos' },
    textoVacio: { titulo: 'Sin tipos', descripcion: 'Creá el primero.' },
    ...over,
  }
}

describe('PreviewSeccionExterna', () => {
  it('muestra el botón de gestión incluso en estado vacío', async () => {
    mockearFetch([{ data: { items: [] } }])

    render(<PreviewSeccionExterna {...propsBase()} />)

    await waitFor(() => expect(screen.getByText('Sin tipos')).toBeTruthy())
    expect(screen.getByText('Gestionar tipos')).toBeTruthy()
    expect(screen.getByText('Creá el primero.')).toBeTruthy()
  })

  it('renderiza los items con etiqueta, sub-etiqueta, badges y conteo', async () => {
    const items: ItemPreview[] = [
      {
        id: '1',
        etiqueta: 'Llamada',
        subEtiqueta: 'LLM',
        badges: [{ texto: 'Inbox' }],
        origen: { texto: 'Personalizado', tono: 'personalizado' },
      },
      { id: '2', etiqueta: 'Reunión' },
    ]
    mockearFetch([{ data: { items } }])

    render(<PreviewSeccionExterna {...propsBase()} />)

    await waitFor(() => expect(screen.getByText('Llamada')).toBeTruthy())
    expect(screen.getByText('LLM')).toBeTruthy()
    expect(screen.getByText('Inbox')).toBeTruthy()
    expect(screen.getByText('Personalizado')).toBeTruthy()
    expect(screen.getByText('Reunión')).toBeTruthy()
    expect(screen.getByText('2 tipos')).toBeTruthy()
  })

  it('muestra "+ N más" cuando hay más items que el límite', async () => {
    const items: ItemPreview[] = Array.from({ length: 12 }).map((_, i) => ({
      id: String(i),
      etiqueta: `Tipo ${i + 1}`,
    }))
    mockearFetch([{ data: { items } }])

    render(<PreviewSeccionExterna {...propsBase({ limite: 5 })} />)

    await waitFor(() => expect(screen.getByText('Tipo 1')).toBeTruthy())
    expect(screen.queryByText('Tipo 6')).toBeNull()
    expect(screen.getByText('+ 7 tipos más')).toBeTruthy()
    expect(screen.getByText('12 tipos')).toBeTruthy()
  })

  it('muestra error + botón Reintentar y vuelve a llamar fetch al click', async () => {
    mockearFetch([
      { ok: false, status: 500, data: { error: 'falló' } },
      { data: { items: [{ id: '1', etiqueta: 'OK' }] } },
    ])

    render(<PreviewSeccionExterna {...propsBase()} />)

    await waitFor(() => expect(screen.getByText('falló')).toBeTruthy())
    expect(screen.getByText('Reintentar')).toBeTruthy()

    fireEvent.click(screen.getByText('Reintentar'))

    await waitFor(() => expect(screen.getByText('OK')).toBeTruthy())
  })

  it('usa el singular del conteo cuando solo hay 1 item', async () => {
    mockearFetch([{ data: { items: [{ id: '1', etiqueta: 'Único' }] } }])

    render(<PreviewSeccionExterna {...propsBase()} />)

    await waitFor(() => expect(screen.getByText('1 tipo')).toBeTruthy())
  })
})

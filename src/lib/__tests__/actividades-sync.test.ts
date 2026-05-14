/**
 * Tests de `recalcularFechaVencimientoDesdeBloques` — el helper que
 * mantiene `actividades.fecha_vencimiento` igual al `fecha_inicio` del
 * bloque de calendario más temprano vinculado a la actividad.
 *
 * Validamos:
 *   - Si hay bloques activos → actualiza con el inicio del más temprano.
 *   - Si NO hay bloques activos → NO toca la actividad (regla de producto).
 *   - Filtra por `en_papelera=false`, `estado != 'cancelado'`, `actividad_id`,
 *     `empresa_id` (multi-tenant).
 *   - Args vacíos → no hace nada (defensa).
 *   - Errores de Supabase loguean pero no tiran.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  crearClienteAdmin: vi.fn(),
}))

import {
  recalcularFechaVencimientoDesdeBloques,
  moverPrimerBloqueAFecha,
} from '../actividades-sync'
import { crearClienteAdmin } from '@/lib/supabase/admin'

const crearClienteAdminMock = vi.mocked(crearClienteAdmin)

const ACTIVIDAD_ID = 'actividad-uuid-1'
const EMPRESA_ID = 'empresa-uuid-1'

interface EstadoMock {
  /** Datos que devuelve el SELECT. null = sin bloques. */
  bloque: { fecha_inicio: string } | null
  errorSelect?: { message: string } | null
  errorUpdate?: { message: string } | null
  /** Captura del payload del UPDATE. */
  updatePayload: Record<string, unknown> | null
  /** Filtros aplicados a actividades.update — para verificar multi-tenant. */
  updateFiltros: Record<string, unknown>
  /** Filtros aplicados al SELECT de eventos. */
  selectFiltros: Record<string, unknown>
}

function crearAdminMock(estado: EstadoMock) {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla === 'eventos_calendario') {
        return crearBuilderEventos(estado)
      }
      if (tabla === 'actividades') {
        return crearBuilderActividades(estado)
      }
      throw new Error(`Tabla mock no soportada: ${tabla}`)
    }),
  }
}

function crearBuilderEventos(estado: EstadoMock) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
      estado.selectFiltros[col] = val
      return builder
    }),
    neq: vi.fn((col: string, val: unknown) => {
      estado.selectFiltros[`!=${col}`] = val
      return builder
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() =>
      Promise.resolve({
        data: estado.errorSelect ? null : estado.bloque,
        error: estado.errorSelect ?? null,
      }),
    ),
  }
  return builder
}

function crearBuilderActividades(estado: EstadoMock) {
  const builder = {
    update: vi.fn((payload: Record<string, unknown>) => {
      estado.updatePayload = payload
      return builder
    }),
    eq: vi.fn((col: string, val: unknown) => {
      estado.updateFiltros[col] = val
      // Cuando ya se aplicaron los dos eq (id + empresa_id), terminamos.
      if (Object.keys(estado.updateFiltros).length >= 2) {
        // Devolvemos algo "thenable" para que `await ...eq(...)` resuelva.
        return Promise.resolve({ data: null, error: estado.errorUpdate ?? null }) as never
      }
      return builder
    }),
  }
  return builder
}

function estadoBase(overrides: Partial<EstadoMock> = {}): EstadoMock {
  return {
    bloque: null,
    updatePayload: null,
    updateFiltros: {},
    selectFiltros: {},
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recalcularFechaVencimientoDesdeBloques', () => {
  it('actualiza fecha_vencimiento al fecha_inicio del bloque más temprano', async () => {
    const estado = estadoBase({ bloque: { fecha_inicio: '2026-06-01T10:00:00Z' } })
    crearClienteAdminMock.mockReturnValue(crearAdminMock(estado) as never)

    await recalcularFechaVencimientoDesdeBloques(ACTIVIDAD_ID, EMPRESA_ID)

    expect(estado.updatePayload).toEqual({ fecha_vencimiento: '2026-06-01T10:00:00Z' })
    expect(estado.updateFiltros).toEqual({ id: ACTIVIDAD_ID, empresa_id: EMPRESA_ID })
  })

  it('filtra SELECT por actividad_id, empresa_id, en_papelera=false, estado != cancelado', async () => {
    const estado = estadoBase({ bloque: { fecha_inicio: '2026-06-01T10:00:00Z' } })
    crearClienteAdminMock.mockReturnValue(crearAdminMock(estado) as never)

    await recalcularFechaVencimientoDesdeBloques(ACTIVIDAD_ID, EMPRESA_ID)

    expect(estado.selectFiltros.actividad_id).toBe(ACTIVIDAD_ID)
    expect(estado.selectFiltros.empresa_id).toBe(EMPRESA_ID)
    expect(estado.selectFiltros.en_papelera).toBe(false)
    expect(estado.selectFiltros['!=estado']).toBe('cancelado')
  })

  it('si no hay bloques activos → NO toca la actividad', async () => {
    const estado = estadoBase({ bloque: null })
    crearClienteAdminMock.mockReturnValue(crearAdminMock(estado) as never)

    await recalcularFechaVencimientoDesdeBloques(ACTIVIDAD_ID, EMPRESA_ID)

    expect(estado.updatePayload).toBeNull()
    expect(estado.updateFiltros).toEqual({})
  })

  it('args vacíos → no hace nada y no llama a Supabase', async () => {
    const estado = estadoBase()
    crearClienteAdminMock.mockReturnValue(crearAdminMock(estado) as never)

    await recalcularFechaVencimientoDesdeBloques('', EMPRESA_ID)
    await recalcularFechaVencimientoDesdeBloques(ACTIVIDAD_ID, '')

    expect(crearClienteAdminMock).not.toHaveBeenCalled()
  })

  it('error en SELECT → loguea pero no tira excepción', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const estado = estadoBase({ bloque: null, errorSelect: { message: 'db down' } })
    crearClienteAdminMock.mockReturnValue(crearAdminMock(estado) as never)

    await expect(
      recalcularFechaVencimientoDesdeBloques(ACTIVIDAD_ID, EMPRESA_ID),
    ).resolves.toBeUndefined()

    expect(errSpy).toHaveBeenCalled()
    expect(estado.updatePayload).toBeNull()
    errSpy.mockRestore()
  })

  it('error en UPDATE → loguea pero no tira excepción', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const estado = estadoBase({
      bloque: { fecha_inicio: '2026-06-01T10:00:00Z' },
      errorUpdate: { message: 'rls denied' },
    })
    crearClienteAdminMock.mockReturnValue(crearAdminMock(estado) as never)

    await expect(
      recalcularFechaVencimientoDesdeBloques(ACTIVIDAD_ID, EMPRESA_ID),
    ).resolves.toBeUndefined()

    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})

// ─── Tests de moverPrimerBloqueAFecha ─────────────────────────────────────

interface BloqueMover {
  id: string
  fecha_inicio: string
  fecha_fin: string | null
}

interface EstadoMover {
  bloque: BloqueMover | null
  errorSelect?: { message: string } | null
  errorUpdate?: { message: string } | null
  updatePayload: Record<string, unknown> | null
  updateFiltros: Record<string, unknown>
}

function crearAdminMoverMock(estado: EstadoMover) {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla !== 'eventos_calendario') {
        throw new Error(`Tabla mock no soportada: ${tabla}`)
      }
      const builder: Record<string, unknown> = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: unknown) => {
          // En la fase de update, capturamos los filtros.
          if ((builder as { _modo?: string })._modo === 'update') {
            estado.updateFiltros[col] = val
            if (Object.keys(estado.updateFiltros).length >= 2) {
              return Promise.resolve({ data: null, error: estado.errorUpdate ?? null }) as never
            }
          }
          return builder
        }),
        neq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data: estado.errorSelect ? null : estado.bloque,
            error: estado.errorSelect ?? null,
          }),
        ),
        update: vi.fn((payload: Record<string, unknown>) => {
          ;(builder as { _modo?: string })._modo = 'update'
          estado.updatePayload = payload
          return builder
        }),
      }
      return builder
    }),
  }
}

function estadoMoverBase(over: Partial<EstadoMover> = {}): EstadoMover {
  return {
    bloque: null,
    updatePayload: null,
    updateFiltros: {},
    ...over,
  }
}

describe('moverPrimerBloqueAFecha', () => {
  it('mueve fecha_inicio + recalcula fecha_fin preservando duración', async () => {
    const estado = estadoMoverBase({
      bloque: {
        id: 'b1',
        fecha_inicio: '2026-06-01T10:00:00.000Z',
        fecha_fin: '2026-06-01T11:00:00.000Z', // duración: 1 hora
      },
    })
    crearClienteAdminMock.mockReturnValue(crearAdminMoverMock(estado) as never)

    const movido = await moverPrimerBloqueAFecha(
      ACTIVIDAD_ID,
      EMPRESA_ID,
      '2026-06-10T15:00:00.000Z',
    )

    expect(movido).toBe(true)
    expect(estado.updatePayload).toEqual({
      fecha_inicio: '2026-06-10T15:00:00.000Z',
      fecha_fin: '2026-06-10T16:00:00.000Z', // +1 hora preservada
    })
    expect(estado.updateFiltros).toEqual({ id: 'b1', empresa_id: EMPRESA_ID })
  })

  it('bloque sin fecha_fin → solo mueve fecha_inicio', async () => {
    const estado = estadoMoverBase({
      bloque: { id: 'b1', fecha_inicio: '2026-06-01T10:00:00Z', fecha_fin: null },
    })
    crearClienteAdminMock.mockReturnValue(crearAdminMoverMock(estado) as never)

    const movido = await moverPrimerBloqueAFecha(ACTIVIDAD_ID, EMPRESA_ID, '2026-06-10T15:00:00Z')

    expect(movido).toBe(true)
    expect(estado.updatePayload).toEqual({ fecha_inicio: '2026-06-10T15:00:00Z' })
  })

  it('sin bloque activo → devuelve false sin hacer update', async () => {
    const estado = estadoMoverBase({ bloque: null })
    crearClienteAdminMock.mockReturnValue(crearAdminMoverMock(estado) as never)

    const movido = await moverPrimerBloqueAFecha(ACTIVIDAD_ID, EMPRESA_ID, '2026-06-10T15:00:00Z')

    expect(movido).toBe(false)
    expect(estado.updatePayload).toBeNull()
  })

  it('args vacíos → devuelve false sin tocar Supabase', async () => {
    const estado = estadoMoverBase()
    crearClienteAdminMock.mockReturnValue(crearAdminMoverMock(estado) as never)

    expect(await moverPrimerBloqueAFecha('', EMPRESA_ID, '2026-06-10T15:00:00Z')).toBe(false)
    expect(await moverPrimerBloqueAFecha(ACTIVIDAD_ID, '', '2026-06-10T15:00:00Z')).toBe(false)
    expect(await moverPrimerBloqueAFecha(ACTIVIDAD_ID, EMPRESA_ID, '')).toBe(false)
    expect(crearClienteAdminMock).not.toHaveBeenCalled()
  })

  it('error en UPDATE → devuelve false y loguea', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const estado = estadoMoverBase({
      bloque: { id: 'b1', fecha_inicio: '2026-06-01T10:00:00Z', fecha_fin: null },
      errorUpdate: { message: 'rls denied' },
    })
    crearClienteAdminMock.mockReturnValue(crearAdminMoverMock(estado) as never)

    const movido = await moverPrimerBloqueAFecha(ACTIVIDAD_ID, EMPRESA_ID, '2026-06-10T15:00:00Z')

    expect(movido).toBe(false)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { aplicarTransicionEstado } from '../estados/aplicar-transicion'

/**
 * Tests del helper de transiciones. Mockean SupabaseClient con builders
 * encadenables. Se cubren los caminos críticos:
 *   - Entidad no soportada (no migrada todavía)
 *   - Entidad no encontrada
 *   - No-op (estado actual = destino)
 *   - Transición inválida según catálogo
 *   - Transición válida exitosa
 *   - requiere_motivo + motivo faltante → error
 *   - requiere_motivo + motivo presente → ok + motivo persistido
 */

interface MockState {
  estadoActualLeido: string | null
  esTransicionValida: boolean
  requiereMotivo: boolean
  errorEnUpdate: string | null
  // Captura para verificar el último UPDATE
  cambiosCapturados: Record<string, unknown> | null
  motivoCapturado: string | null
}

function crearAdminMock(estado: MockState) {
  estado.cambiosCapturados = null
  estado.motivoCapturado = null

  return {
    from: vi.fn((tabla: string) => {
      if (tabla === 'cambios_estado') {
        return crearBuilderCambiosEstado(estado)
      }
      if (tabla === 'transiciones_estado') {
        return crearBuilderTransiciones(estado)
      }
      // Tabla de entidad principal (presupuesto_cuotas, conversaciones, etc.)
      return crearBuilderEntidad(estado)
    }),
    rpc: vi.fn((funcion: string, _args: Record<string, unknown>) => {
      if (funcion === 'validar_transicion_estado') {
        return Promise.resolve({ data: estado.esTransicionValida, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }),
  }
}

function crearBuilderEntidad(estado: MockState) {
  // Encadenable: .select().eq().eq().maybeSingle() | .update().eq().eq()
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    update: vi.fn((cambios: Record<string, unknown>) => {
      estado.cambiosCapturados = cambios
      return builder
    }),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => {
      if (estado.estadoActualLeido === '__no_existe__') {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({
        data: { estado_clave: estado.estadoActualLeido },
        error: null,
      })
    }),
    // Para el UPDATE, el await final debe resolver con error o null
    then: (resolve: (val: unknown) => void) => {
      resolve({
        data: null,
        error: estado.errorEnUpdate ? { message: estado.errorEnUpdate } : null,
      })
    },
  }
  return builder
}

function crearBuilderTransiciones(estado: MockState) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(() =>
      Promise.resolve({
        data: { requiere_motivo: estado.requiereMotivo },
        error: null,
      }),
    ),
  }
  return builder
}

function crearBuilderCambiosEstado(estado: MockState) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    update: vi.fn((cambios: { motivo?: string }) => {
      if (cambios.motivo) estado.motivoCapturado = cambios.motivo
      return builder
    }),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() =>
      Promise.resolve({
        data: { id: 'cambio-id-mock' },
        error: null,
      }),
    ),
    then: (resolve: (val: unknown) => void) => {
      resolve({ data: null, error: null })
    },
  }
  return builder
}

let estado: MockState

beforeEach(() => {
  estado = {
    estadoActualLeido: 'abierta',
    esTransicionValida: true,
    requiereMotivo: false,
    errorEnUpdate: null,
    cambiosCapturados: null,
    motivoCapturado: null,
  }
})

describe('aplicarTransicionEstado', () => {
  it('rechaza entidades no soportadas', async () => {
    const admin = crearAdminMock(estado)
    const r = await aplicarTransicionEstado({
      // @ts-expect-error — pasamos a propósito una entidad no soportada
      entidadTipo: 'algo_que_no_existe',
      empresaId: 'emp-1',
      entidadId: 'ent-1',
      hastaClave: 'cobrada',
      admin: admin as never,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/no está soportada/i)
    }
  })

  it('rechaza entidad no encontrada', async () => {
    estado.estadoActualLeido = '__no_existe__'
    const admin = crearAdminMock(estado)
    const r = await aplicarTransicionEstado({
      entidadTipo: 'conversacion',
      empresaId: 'emp-1',
      entidadId: 'ent-no-existe',
      hastaClave: 'resuelta',
      admin: admin as never,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/no encontrada/i)
  })

  it('devuelve noOp si el estado actual ya es el destino', async () => {
    estado.estadoActualLeido = 'resuelta'
    const admin = crearAdminMock(estado)
    const r = await aplicarTransicionEstado({
      entidadTipo: 'conversacion',
      empresaId: 'emp-1',
      entidadId: 'ent-1',
      hastaClave: 'resuelta',
      admin: admin as never,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.noOp).toBe(true)
      expect(r.estadoAnterior).toBe('resuelta')
    }
    expect(estado.cambiosCapturados).toBeNull()
  })

  it('rechaza transiciones inválidas según el catálogo', async () => {
    estado.estadoActualLeido = 'spam'
    estado.esTransicionValida = false
    const admin = crearAdminMock(estado)
    const r = await aplicarTransicionEstado({
      entidadTipo: 'conversacion',
      empresaId: 'emp-1',
      entidadId: 'ent-1',
      hastaClave: 'resuelta',
      admin: admin as never,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.transicionInvalida).toBe(true)
      expect(r.error).toMatch(/no permitida/i)
    }
  })

  it('aplica una transición válida sin motivo requerido', async () => {
    estado.estadoActualLeido = 'abierta'
    estado.esTransicionValida = true
    estado.requiereMotivo = false
    const admin = crearAdminMock(estado)
    const r = await aplicarTransicionEstado({
      entidadTipo: 'conversacion',
      empresaId: 'emp-1',
      entidadId: 'ent-1',
      hastaClave: 'resuelta',
      admin: admin as never,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.estadoAnterior).toBe('abierta')
      expect(r.estadoNuevo).toBe('resuelta')
      expect(r.noOp).toBeFalsy()
    }
    expect(estado.cambiosCapturados).toEqual({ estado_clave: 'resuelta' })
  })

  it('falla cuando la transición requiere motivo y no se proporciona', async () => {
    estado.estadoActualLeido = 'abierta'
    estado.esTransicionValida = true
    estado.requiereMotivo = true
    const admin = crearAdminMock(estado)
    const r = await aplicarTransicionEstado({
      entidadTipo: 'conversacion',
      empresaId: 'emp-1',
      entidadId: 'ent-1',
      hastaClave: 'spam',
      admin: admin as never,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivoRequerido).toBe(true)
      expect(r.error).toMatch(/motivo/i)
    }
    // No debió aplicar el UPDATE
    expect(estado.cambiosCapturados).toBeNull()
  })

  it('aplica transición + persiste motivo cuando está presente', async () => {
    estado.estadoActualLeido = 'abierta'
    estado.esTransicionValida = true
    estado.requiereMotivo = true
    const admin = crearAdminMock(estado)
    const r = await aplicarTransicionEstado({
      entidadTipo: 'conversacion',
      empresaId: 'emp-1',
      entidadId: 'ent-1',
      hastaClave: 'spam',
      motivo: 'Mensaje no solicitado de promoción',
      admin: admin as never,
    })
    expect(r.ok).toBe(true)
    expect(estado.cambiosCapturados).toEqual({ estado_clave: 'spam' })
    expect(estado.motivoCapturado).toBe('Mensaje no solicitado de promoción')
  })

  it('incluye cambiosAdicionales en el UPDATE', async () => {
    estado.estadoActualLeido = 'abierta'
    estado.esTransicionValida = true
    const admin = crearAdminMock(estado)
    await aplicarTransicionEstado({
      entidadTipo: 'conversacion',
      empresaId: 'emp-1',
      entidadId: 'ent-1',
      hastaClave: 'resuelta',
      cambiosAdicionales: {
        cerrado_en: '2026-05-01T10:00:00Z',
        cerrado_por: 'user-1',
      },
      admin: admin as never,
    })
    expect(estado.cambiosCapturados).toEqual({
      estado_clave: 'resuelta',
      cerrado_en: '2026-05-01T10:00:00Z',
      cerrado_por: 'user-1',
    })
  })
})

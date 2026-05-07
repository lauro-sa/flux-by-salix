/**
 * Tests unit del POST /api/flujos en sus dos modos: creación normal
 * (PR 18.1, regresión) y duplicación (PR 18.4).
 *
 * El motor backend ya tiene cobertura propia (PR 13-17). Acá solo
 * verificamos el ruteo del endpoint:
 *   - shape del payload insertado (incluye lo que debe y excluye lo
 *     que no, p.ej. borrador_jsonb del origen).
 *   - estado siempre 'borrador' en el nuevo.
 *   - auditoría con campo correcto (creacion vs duplicar) y valor
 *     correcto (nombre vs origen.id).
 *   - 404 indistinguible cross-tenant y cross-usuario (defensa
 *     multi-tenant manual + ver_propio).
 *   - 400 ante bodies mal formados.
 *
 * Mockeamos `@/lib/permisos-servidor` para no acoplar al test toda
 * la lógica de roles (esa cobertura vive en flujos-permisos.test.ts).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks ANTES de importar la route.
vi.mock('@/lib/supabase/admin', () => ({
  crearClienteAdmin: vi.fn(),
}))
vi.mock('@/lib/permisos-servidor', () => ({
  requerirPermisoAPI: vi.fn(),
  verificarVisibilidad: vi.fn(),
  obtenerYVerificarPermiso: vi.fn(),
}))

import { POST } from '@/app/api/flujos/route'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  requerirPermisoAPI,
  verificarVisibilidad,
  obtenerYVerificarPermiso,
} from '@/lib/permisos-servidor'

const crearClienteAdminMock = vi.mocked(crearClienteAdmin)
const requerirPermisoAPIMock = vi.mocked(requerirPermisoAPI)
const verificarVisibilidadMock = vi.mocked(verificarVisibilidad)
const obtenerYVerificarPermisoMock = vi.mocked(obtenerYVerificarPermiso)

// ─── Helpers ─────────────────────────────────────────────────

const USER_ID = 'user-uuid-1'
const EMPRESA_ID = 'empresa-uuid-1'
const ORIGEN_ID = 'flujo-origen-uuid'
const NUEVO_ID = 'flujo-nuevo-uuid'

interface OrigenSimulado {
  id: string
  descripcion: string | null
  disparador: unknown
  condiciones: unknown
  acciones: unknown
  nodos_json: unknown
  icono: string | null
  color: string | null
  creado_por: string
}

interface MockState {
  /** Si está set, el SELECT de flujos por id devuelve este origen. */
  origen: OrigenSimulado | null
  /** Captura el último insert sobre flujos. */
  insertFlujo: Record<string, unknown> | null
  /** Captura el último insert sobre auditoria_flujos. */
  insertAuditoria: Record<string, unknown> | null
}

function crearAdminMock(state: MockState) {
  return {
    from: vi.fn((tabla: string) => {
      switch (tabla) {
        case 'flujos':
          return crearBuilderFlujos(state)
        case 'perfiles':
          return crearBuilderPerfiles()
        case 'auditoria_flujos':
          return crearBuilderAuditoria(state)
        default:
          throw new Error(`Tabla mock no soportada: ${tabla}`)
      }
    }),
  }
}

/**
 * Builder de `flujos` que diferencia dos flujos del endpoint:
 *   - SELECT origen: .select('...').eq('id',_).eq('empresa_id',_).maybeSingle()
 *   - INSERT nuevo:  .insert({...}).select().single()
 */
function crearBuilderFlujos(state: MockState) {
  let modo: 'select' | 'insert' = 'select'
  let payloadInsertado: Record<string, unknown> | null = null

  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: Record<string, unknown>) => {
      modo = 'insert'
      payloadInsertado = payload
      state.insertFlujo = payload
      return builder
    }),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => {
      // Solo aplica al SELECT de origen.
      if (modo !== 'select') {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: state.origen, error: null })
    }),
    single: vi.fn(() => {
      if (modo !== 'insert' || !payloadInsertado) {
        return Promise.resolve({ data: null, error: { message: 'mock_sin_insert' } })
      }
      // Simulamos el row resultante (todos los campos del payload + id +
      // los defaults SQL para los que no pasamos).
      return Promise.resolve({
        data: {
          id: NUEVO_ID,
          ...payloadInsertado,
          // Defaults SQL para creación normal (sin payload de duplicar).
          disparador: payloadInsertado.disparador ?? {},
          condiciones: payloadInsertado.condiciones ?? [],
          acciones: payloadInsertado.acciones ?? [],
          nodos_json: payloadInsertado.nodos_json ?? {},
          borrador_jsonb: null,
          activo: false,
        },
        error: null,
      })
    }),
  }
  return builder
}

function crearBuilderPerfiles() {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: { nombre: 'Sal', apellido: 'Salix' }, error: null }),
    ),
  }
  return builder
}

function crearBuilderAuditoria(state: MockState) {
  return {
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.insertAuditoria = payload
      return Promise.resolve({ data: null, error: null })
    }),
  }
}

function origenPorDefault(overrides: Partial<OrigenSimulado> = {}): OrigenSimulado {
  return {
    id: ORIGEN_ID,
    descripcion: 'Recordatorio cuota a 3 días',
    disparador: { tipo: 'tiempo.relativo_a_campo', configuracion: { entidad_tipo: 'cuotas' } },
    condiciones: [{ campo: 'estado', operador: 'eq', valor: 'pendiente' }],
    acciones: [{ tipo: 'enviar_whatsapp_plantilla', parametros: { plantilla: 'recordatorio_cuota_3dias' } }],
    nodos_json: { nodes: [{ id: 'n1' }], edges: [] },
    icono: 'reloj',
    color: 'azul',
    creado_por: USER_ID,
    ...overrides,
  }
}

function setupMocksOk(state: MockState) {
  crearClienteAdminMock.mockReturnValue(crearAdminMock(state) as never)
  requerirPermisoAPIMock.mockResolvedValue({
    user: { id: USER_ID, app_metadata: { empresa_activa_id: EMPRESA_ID } },
    empresaId: EMPRESA_ID,
  } as never)
  verificarVisibilidadMock.mockResolvedValue({
    verTodos: true,
    soloPropio: false,
    miembro: {} as never,
  })
  obtenerYVerificarPermisoMock.mockResolvedValue({ permitido: true } as never)
}

function crearRequest(body: unknown): NextRequest {
  return new NextRequest('https://flux.salixweb.com/api/flujos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Modo creación normal (regresión PR 18.1) ───────────────────

describe('POST /api/flujos — modo creación normal', () => {
  it('crea flujo con defaults y auditoría campo=creacion', async () => {
    const state: MockState = { origen: null, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)

    const res = await POST(crearRequest({ nombre: 'Mi flujo' }))
    expect(res.status).toBe(200)

    expect(state.insertFlujo).toMatchObject({
      empresa_id: EMPRESA_ID,
      nombre: 'Mi flujo',
      descripcion: null,
      estado: 'borrador',
      creado_por: USER_ID,
    })
    // No debe traer disparador / etc en el payload — caen al default SQL.
    expect(state.insertFlujo).not.toHaveProperty('disparador')
    expect(state.insertFlujo).not.toHaveProperty('icono')
    expect(state.insertFlujo).not.toHaveProperty('color')
    expect(state.insertFlujo).not.toHaveProperty('borrador_jsonb')

    expect(state.insertAuditoria).toMatchObject({
      campo_modificado: 'creacion',
      valor_anterior: null,
      valor_nuevo: 'Mi flujo',
      flujo_id: NUEVO_ID,
    })
  })

  it('400 si el body no tiene nombre', async () => {
    const state: MockState = { origen: null, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)

    const res = await POST(crearRequest({ descripcion: 'sin nombre' }))
    expect(res.status).toBe(400)
  })
})

// ─── Modo duplicación (PR 18.4) ─────────────────────────────────

describe('POST /api/flujos — duplicación (basado_en_flujo_id)', () => {
  it('happy path: copia disparador/condiciones/acciones/nodos_json/icono/color y audita lineage', async () => {
    const origen = origenPorDefault()
    const state: MockState = { origen, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)

    const res = await POST(crearRequest({
      nombre: 'Mi flujo (copia)',
      basado_en_flujo_id: ORIGEN_ID,
    }))
    expect(res.status).toBe(200)

    // Campos copiados del origen.
    expect(state.insertFlujo).toMatchObject({
      empresa_id: EMPRESA_ID,
      nombre: 'Mi flujo (copia)',
      descripcion: origen.descripcion, // heredada (no vino en body).
      estado: 'borrador',
      disparador: origen.disparador,
      condiciones: origen.condiciones,
      acciones: origen.acciones,
      nodos_json: origen.nodos_json,
      icono: origen.icono,
      color: origen.color,
      creado_por: USER_ID,
    })
    // Regla invariante: borrador_jsonb del origen NO se copia.
    expect(state.insertFlujo).not.toHaveProperty('borrador_jsonb')

    // Auditoría con lineage: valor_nuevo apunta al origen.
    expect(state.insertAuditoria).toMatchObject({
      campo_modificado: 'duplicar',
      valor_anterior: null,
      valor_nuevo: ORIGEN_ID,
      flujo_id: NUEVO_ID,
    })
  })

  it('descripción del body sobrescribe la del origen si viene', async () => {
    const origen = origenPorDefault({ descripcion: 'Descripción del origen' })
    const state: MockState = { origen, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)

    await POST(crearRequest({
      nombre: 'Copia',
      descripcion: 'Nueva descripción',
      basado_en_flujo_id: ORIGEN_ID,
    }))

    expect(state.insertFlujo?.descripcion).toBe('Nueva descripción')
  })

  it('hereda íconos/colores cuando vienen seteados en el origen', async () => {
    const origen = origenPorDefault({ icono: 'rayo', color: 'naranja' })
    const state: MockState = { origen, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)

    await POST(crearRequest({ nombre: 'Copia', basado_en_flujo_id: ORIGEN_ID }))

    expect(state.insertFlujo?.icono).toBe('rayo')
    expect(state.insertFlujo?.color).toBe('naranja')
  })

  it('flujo Activo origen → nuevo arranca en Borrador', async () => {
    // El estado del origen es transparente para la duplicación: el
    // endpoint copia campos publicados sin importar en qué estado
    // estaba. Verificamos que el nuevo siempre nace en 'borrador'.
    const origen = origenPorDefault()
    const state: MockState = { origen, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)

    await POST(crearRequest({ nombre: 'Copia activo', basado_en_flujo_id: ORIGEN_ID }))

    expect(state.insertFlujo?.estado).toBe('borrador')
  })

  it('404 cuando el origen no existe (cross-tenant indistinguible)', async () => {
    const state: MockState = { origen: null, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)

    const res = await POST(crearRequest({
      nombre: 'Copia',
      basado_en_flujo_id: 'no-existe',
    }))
    expect(res.status).toBe(404)
    expect(state.insertFlujo).toBeNull()
    expect(state.insertAuditoria).toBeNull()
  })

  it('404 cuando el user solo tiene ver_propio y el origen es de otro user de la misma empresa', async () => {
    const origen = origenPorDefault({ creado_por: 'otro-user-id' })
    const state: MockState = { origen, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)
    // Override: el user solo ve los propios.
    verificarVisibilidadMock.mockResolvedValue({
      verTodos: false,
      soloPropio: true,
      miembro: {} as never,
    })

    const res = await POST(crearRequest({
      nombre: 'Copia',
      basado_en_flujo_id: ORIGEN_ID,
    }))
    expect(res.status).toBe(404)
    expect(state.insertFlujo).toBeNull()
  })

  it('404 cuando el user no tiene visibilidad de flujos en absoluto', async () => {
    const origen = origenPorDefault()
    const state: MockState = { origen, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)
    verificarVisibilidadMock.mockResolvedValue(null)

    const res = await POST(crearRequest({
      nombre: 'Copia',
      basado_en_flujo_id: ORIGEN_ID,
    }))
    expect(res.status).toBe(404)
  })

  it('400 si basado_en_flujo_id es string vacío', async () => {
    const state: MockState = { origen: null, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)

    const res = await POST(crearRequest({
      nombre: 'Copia',
      basado_en_flujo_id: '',
    }))
    expect(res.status).toBe(400)
  })

  it('400 si basado_en_flujo_id no es string', async () => {
    const state: MockState = { origen: null, insertFlujo: null, insertAuditoria: null }
    setupMocksOk(state)

    const res = await POST(crearRequest({
      nombre: 'Copia',
      basado_en_flujo_id: 123,
    }))
    expect(res.status).toBe(400)
  })
})

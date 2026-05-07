/**
 * Tests del endpoint POST /api/flujos/[id]/probar (sub-PR 19.5).
 *
 * Verifican el ruteo: auth, validación de body, 404 cross-tenant,
 * 422 cuando el flujo no es publicable, y 200 con shape de response
 * en el happy path.
 *
 * El motor del dry-run tiene cobertura propia en
 * `workflows-correr-ejecucion-dryrun.test.ts` y
 * `workflows-executor-dryrun.test.ts` — acá no re-testeamos eso.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ANTES de importar la route ─────────────────────────
vi.mock('@/lib/supabase/admin', () => ({
  crearClienteAdmin: vi.fn(),
}))
vi.mock('@/lib/permisos-servidor', () => ({
  requerirPermisoAPI: vi.fn(),
}))
// Stubeamos enriquecimiento + dry-run para aislar la lógica del endpoint.
vi.mock('@/lib/workflows/preview-contexto', () => ({
  armarContextoPreview: vi.fn(),
}))
vi.mock('@/lib/workflows/correr-ejecucion-dryrun', () => ({
  correrEjecucionDryRun: vi.fn(),
}))

import { POST } from '@/app/api/flujos/[id]/probar/route'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { armarContextoPreview } from '@/lib/workflows/preview-contexto'
import { correrEjecucionDryRun } from '@/lib/workflows/correr-ejecucion-dryrun'

const crearClienteAdminMock = vi.mocked(crearClienteAdmin)
const requerirPermisoAPIMock = vi.mocked(requerirPermisoAPI)
const armarContextoPreviewMock = vi.mocked(armarContextoPreview)
const correrEjecucionDryRunMock = vi.mocked(correrEjecucionDryRun)

const USER_ID = 'user-1'
const EMPRESA_ID = 'emp-1'
const FLUJO_ID = 'flujo-1'

// Flujo válido por default — disparador soportado + 1 acción soportada.
function flujoValido(overrides: Record<string, unknown> = {}) {
  return {
    id: FLUJO_ID,
    empresa_id: EMPRESA_ID,
    estado: 'borrador',
    disparador: {
      tipo: 'entidad.estado_cambio',
      configuracion: { entidad_tipo: 'presupuesto', hasta_clave: 'aceptado' },
    },
    condiciones: [],
    acciones: [
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'Listo' },
    ],
    nodos_json: null,
    borrador_jsonb: null,
    ...overrides,
  }
}

function crearAdminMock(flujoData: unknown | null) {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla === 'flujos') {
        const builder: Record<string, unknown> = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          maybeSingle: vi.fn(() => Promise.resolve({ data: flujoData, error: null })),
        }
        return builder
      }
      throw new Error(`Tabla mock no soportada: ${tabla}`)
    }),
    rpc: vi.fn(),
  }
}

function pasaPermiso() {
  requerirPermisoAPIMock.mockResolvedValue({
    user: { id: USER_ID, app_metadata: { empresa_activa_id: EMPRESA_ID } },
    empresaId: EMPRESA_ID,
    miembro: {} as never,
  } as never)
}

function crearRequest(body: unknown): NextRequest {
  return new NextRequest(`https://flux.salixweb.com/api/flujos/${FLUJO_ID}/probar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: FLUJO_ID })

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================
// Auth + body validation
// =============================================================

describe('POST /api/flujos/[id]/probar — auth + body', () => {
  it('401/403 si requerirPermisoAPI rechaza', async () => {
    requerirPermisoAPIMock.mockResolvedValue({
      respuesta: new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 }) as never,
    })
    const res = await POST(crearRequest({ dry_run: true }), { params })
    expect(res.status).toBe(403)
  })

  it('400 si dry_run !== true (en 19.5 no se permite ejecución real)', async () => {
    pasaPermiso()
    crearClienteAdminMock.mockReturnValue(crearAdminMock(flujoValido()) as never)

    const resFalse = await POST(crearRequest({ dry_run: false }), { params })
    expect(resFalse.status).toBe(400)

    const resAusente = await POST(crearRequest({}), { params })
    expect(resAusente.status).toBe(400)
  })

  it('400 si JSON inválido', async () => {
    pasaPermiso()
    const res = await POST(crearRequest('no es json válido {{{'), { params })
    expect(res.status).toBe(400)
  })
})

// =============================================================
// Cross-tenant
// =============================================================

describe('POST /api/flujos/[id]/probar — visibilidad', () => {
  it('404 si el flujo no existe (mismo criterio que GET /api/flujos/[id])', async () => {
    pasaPermiso()
    crearClienteAdminMock.mockReturnValue(crearAdminMock(null) as never)

    const res = await POST(crearRequest({ dry_run: true }), { params })
    expect(res.status).toBe(404)
  })
})

// =============================================================
// Validación previa
// =============================================================

describe('POST /api/flujos/[id]/probar — validación previa', () => {
  it('422 si el flujo no es publicable (sin acciones)', async () => {
    pasaPermiso()
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock(flujoValido({ acciones: [] })) as never,
    )

    const res = await POST(crearRequest({ dry_run: true }), { params })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { errores: string[] }
    expect(Array.isArray(body.errores)).toBe(true)
    expect(body.errores.length).toBeGreaterThan(0)
  })

  it('422 si el disparador no está configurado', async () => {
    pasaPermiso()
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock(flujoValido({ disparador: null })) as never,
    )
    const res = await POST(crearRequest({ dry_run: true }), { params })
    expect(res.status).toBe(422)
  })
})

// =============================================================
// Happy path: 200 con shape de response
// =============================================================

describe('POST /api/flujos/[id]/probar — happy path', () => {
  it('200 con log + contexto_usado + flujo_evaluado + resumen', async () => {
    pasaPermiso()
    crearClienteAdminMock.mockReturnValue(crearAdminMock(flujoValido()) as never)
    armarContextoPreviewMock.mockResolvedValue({
      empresa: { id: EMPRESA_ID, nombre: 'ACME' },
      ahora: '2026-05-06T14:00:00Z',
      entidad: { tipo: 'presupuesto', id: 'pres-1', titulo: 'Presupuesto Acme' },
      contacto: { nombre: 'Lauro' },
      actor: null,
    } as never)
    correrEjecucionDryRunMock.mockResolvedValue({
      log: [
        {
          paso: 1,
          tipo: 'notificar_usuario',
          estado: 'ok',
          inicio_en: '2026-05-06T14:00:00Z',
          fin_en: '2026-05-06T14:00:00Z',
          duracion_ms: 12,
          respuesta: { simulado: true, accion_simulada: 'notificar_usuario' },
        },
      ],
      estado_final: 'completado',
      duracion_total_ms: 50,
      resumen: {
        completados: 1,
        fallados: 0,
        simulados: 1,
        no_implementados: 0,
        terminado_temprano: false,
      },
    } as never)

    const res = await POST(crearRequest({ dry_run: true }), { params })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      log: unknown[]
      contexto_usado: Record<string, unknown>
      flujo_evaluado: { disparador: unknown; acciones: unknown[]; es_borrador_interno: boolean }
      evento_simulado: { tipo_entidad: string; id: string; resumen: string } | null
      resumen: Record<string, number | boolean>
      duracion_total_ms: number
    }

    expect(body.log).toHaveLength(1)
    expect(body.contexto_usado).toBeDefined()
    expect(body.flujo_evaluado.acciones).toHaveLength(1)
    expect(body.flujo_evaluado.es_borrador_interno).toBe(false)
    expect(body.evento_simulado).toEqual({
      tipo_entidad: 'presupuesto',
      id: 'pres-1',
      resumen: 'Presupuesto Acme',
    })
    expect(body.resumen.completados).toBe(1)
    expect(typeof body.duracion_total_ms).toBe('number')
  })

  it('evento_simulado=null cuando no hay entidad cargada (caveat D6: cron)', async () => {
    pasaPermiso()
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock(
        flujoValido({
          disparador: { tipo: 'tiempo.cron', configuracion: { expresion: '0 9 * * *' } },
        }),
      ) as never,
    )
    armarContextoPreviewMock.mockResolvedValue({
      empresa: { id: EMPRESA_ID, nombre: 'ACME' },
      ahora: '2026-05-06T14:00:00Z',
      entidad: null,
      contacto: null,
      actor: null,
    } as never)
    correrEjecucionDryRunMock.mockResolvedValue({
      log: [],
      estado_final: 'completado',
      duracion_total_ms: 50,
      resumen: { completados: 0, fallados: 0, simulados: 0, no_implementados: 0, terminado_temprano: false },
    } as never)

    const res = await POST(crearRequest({ dry_run: true }), { params })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { evento_simulado: unknown }
    expect(body.evento_simulado).toBeNull()
  })

  it('cuando hay borrador_jsonb, simula la versión EDITABLE (no la publicada)', async () => {
    pasaPermiso()
    const flujoConBorrador = flujoValido({
      estado: 'activo',
      acciones: [{ tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'Publicada' }],
      borrador_jsonb: {
        acciones: [
          { tipo: 'notificar_usuario', usuario_id: 'u-2', titulo: 'Borrador' },
          { tipo: 'notificar_usuario', usuario_id: 'u-3', titulo: 'Segundo paso del borrador' },
        ],
      },
    })
    crearClienteAdminMock.mockReturnValue(crearAdminMock(flujoConBorrador) as never)
    armarContextoPreviewMock.mockResolvedValue({
      empresa: { id: EMPRESA_ID, nombre: 'ACME' },
      ahora: '2026-05-06T14:00:00Z',
      entidad: { tipo: 'presupuesto', id: 'pres-1' },
    } as never)
    correrEjecucionDryRunMock.mockResolvedValue({
      log: [],
      estado_final: 'completado',
      duracion_total_ms: 50,
      resumen: { completados: 0, fallados: 0, simulados: 0, no_implementados: 0, terminado_temprano: false },
    } as never)

    await POST(crearRequest({ dry_run: true }), { params })

    // El orquestador recibió las acciones del borrador, no las publicadas.
    const args = correrEjecucionDryRunMock.mock.calls[0][0] as {
      acciones: Array<{ titulo: string }>
    }
    expect(args.acciones).toHaveLength(2)
    expect(args.acciones[0].titulo).toBe('Borrador')
    expect(args.acciones[1].titulo).toBe('Segundo paso del borrador')
  })
})

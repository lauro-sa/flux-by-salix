/**
 * Tests unit del endpoint cron `/api/cron/barrer-workflows-pendientes`
 * (sub-PR 15.2).
 *
 * Cubre:
 *   - 401 sin auth o con auth incorrecto.
 *   - 401 si CRON_SECRET no está configurado.
 *   - 500 si WEBHOOK_SECRET falta (no puede invocar al worker).
 *   - Cero pendientes vencidos: barrido=0, no hace fetch.
 *   - Lock optimista: si UPDATE retorna 0 filas (otro cron tomó),
 *     suma a lock_perdido y no dispara fetch.
 *   - Deduplicación por ejecucion_id en una corrida.
 *   - Invocación correcta del worker con Bearer WEBHOOK_SECRET y
 *     payload { ejecucion_id }.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock del cliente admin antes de importar la route.
vi.mock('@/lib/supabase/admin', () => ({
  crearClienteAdmin: vi.fn(),
}))

import { GET } from '@/app/api/cron/barrer-workflows-pendientes/route'
import { crearClienteAdmin } from '@/lib/supabase/admin'

const crearClienteAdminMock = vi.mocked(crearClienteAdmin)

// ─── Helpers ─────────────────────────────────────────────────

interface MockState {
  pendientes: Array<{ id: string; ejecucion_id: string; empresa_id: string }>
  /** IDs cuyo UPDATE retornará 0 filas (lock perdido). */
  lockPerdidoIds: Set<string>
}

function crearAdminMock(state: MockState) {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla !== 'acciones_pendientes') {
        throw new Error(`Tabla mock no soportada: ${tabla}`)
      }
      return crearBuilder(state)
    }),
  }
}

/**
 * Builder encadenable que distingue:
 *   - .select(...).eq.lte.order.limit  → devuelve pendientes
 *   - .update(...).eq.eq.select.maybeSingle → simula lock optimista
 *   - .update(...).eq                  → mark ok (resuelve sin retorno)
 */
function crearBuilder(state: MockState) {
  let modo: 'select' | 'update_lock' | 'update_ok' = 'select'
  let lockId: string | null = null
  let eqEstadoEsPendiente = false

  const builder: Record<string, unknown> = {
    select: vi.fn(() => {
      // Cuando viene después de update, es el "RETURNING".
      // Si no, es el SELECT inicial.
      return builder
    }),
    update: vi.fn((cambios: Record<string, unknown>) => {
      modo = cambios.estado === 'ejecutando' ? 'update_lock' : 'update_ok'
      return builder
    }),
    eq: vi.fn((col: string, val: unknown) => {
      if (modo === 'update_lock' && col === 'id') lockId = String(val)
      if (modo === 'update_lock' && col === 'estado' && val === 'pendiente') {
        eqEstadoEsPendiente = true
      }
      return builder
    }),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve({ data: state.pendientes, error: null })),
    maybeSingle: vi.fn(() => {
      if (modo === 'update_lock' && lockId) {
        const id = lockId
        lockId = null
        eqEstadoEsPendiente = false
        return Promise.resolve({
          data: state.lockPerdidoIds.has(id) ? null : { id },
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    }),
    // Para `update().eq()` sin maybeSingle (mark ok).
    then: (resolve: (val: unknown) => void) => {
      if (modo === 'update_ok') {
        resolve({ data: null, error: null })
      } else {
        resolve({ data: null, error: null })
      }
    },
  }
  void eqEstadoEsPendiente // referenciar para no warn
  return builder
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  process.env.CRON_SECRET = 'test-cron-secret'
  process.env.WEBHOOK_SECRET = 'test-webhook-secret'
  fetchSpy = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
  globalThis.fetch = fetchSpy as unknown as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.CRON_SECRET
  delete process.env.WEBHOOK_SECRET
})

function crearRequest(authHeader?: string): NextRequest {
  const headers = new Headers()
  if (authHeader) headers.set('authorization', authHeader)
  return new NextRequest(
    'https://flux.salixweb.com/api/cron/barrer-workflows-pendientes',
    { method: 'GET', headers },
  )
}

// ─── Casos ───────────────────────────────────────────────────

describe('GET /api/cron/barrer-workflows-pendientes', () => {
  it('401 sin auth header', async () => {
    crearClienteAdminMock.mockReturnValue(crearAdminMock({ pendientes: [], lockPerdidoIds: new Set() }) as never)
    const res = await GET(crearRequest())
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('unauthorized')
  })

  it('401 con auth incorrecta', async () => {
    crearClienteAdminMock.mockReturnValue(crearAdminMock({ pendientes: [], lockPerdidoIds: new Set() }) as never)
    const res = await GET(crearRequest('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('401 si CRON_SECRET no está configurado', async () => {
    delete process.env.CRON_SECRET
    crearClienteAdminMock.mockReturnValue(crearAdminMock({ pendientes: [], lockPerdidoIds: new Set() }) as never)
    const res = await GET(crearRequest('Bearer cualquiera'))
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('cron_secret_not_configured')
  })

  it('500 si WEBHOOK_SECRET no está configurado', async () => {
    delete process.env.WEBHOOK_SECRET
    crearClienteAdminMock.mockReturnValue(crearAdminMock({ pendientes: [], lockPerdidoIds: new Set() }) as never)
    const res = await GET(crearRequest('Bearer test-cron-secret'))
    expect(res.status).toBe(500)
  })

  it('cero pendientes vencidos → barrido=0, no fetch', async () => {
    crearClienteAdminMock.mockReturnValue(crearAdminMock({ pendientes: [], lockPerdidoIds: new Set() }) as never)
    const res = await GET(crearRequest('Bearer test-cron-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { barrido: number; disparados: number }
    expect(body.barrido).toBe(0)
    expect(body.disparados).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('1 pendiente vencido → 1 fetch al worker con Bearer WEBHOOK_SECRET', async () => {
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock({
        pendientes: [{ id: 'ap-1', ejecucion_id: 'ej-1', empresa_id: 'emp-1' }],
        lockPerdidoIds: new Set(),
      }) as never,
    )
    const res = await GET(crearRequest('Bearer test-cron-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { barrido: number; disparados: number }
    expect(body.barrido).toBe(1)
    expect(body.disparados).toBe(1)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://flux.salixweb.com/api/workflows/correr-ejecucion')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer test-webhook-secret')
    expect(JSON.parse(init.body as string)).toEqual({ ejecucion_id: 'ej-1' })
  })

  it('lock perdido (otro cron tomó la fila): suma a lock_perdido y no fetch', async () => {
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock({
        pendientes: [
          { id: 'ap-1', ejecucion_id: 'ej-1', empresa_id: 'emp-1' },
          { id: 'ap-2', ejecucion_id: 'ej-2', empresa_id: 'emp-1' },
        ],
        lockPerdidoIds: new Set(['ap-1']), // ap-1 perdió el lock
      }) as never,
    )
    const res = await GET(crearRequest('Bearer test-cron-secret'))
    const body = (await res.json()) as { barrido: number; disparados: number; lock_perdido: number }
    expect(body.barrido).toBe(2)
    expect(body.disparados).toBe(1)
    expect(body.lock_perdido).toBe(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1) // solo ap-2
  })

  it('deduplica ejecucion_id: 2 acciones_pendientes de la misma ejecución → 1 fetch', async () => {
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock({
        pendientes: [
          { id: 'ap-1', ejecucion_id: 'ej-DUP', empresa_id: 'emp-1' },
          { id: 'ap-2', ejecucion_id: 'ej-DUP', empresa_id: 'emp-1' },
        ],
        lockPerdidoIds: new Set(),
      }) as never,
    )
    const res = await GET(crearRequest('Bearer test-cron-secret'))
    const body = (await res.json()) as { barrido: number; disparados: number }
    expect(body.barrido).toBe(2)
    expect(body.disparados).toBe(1) // dedup
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

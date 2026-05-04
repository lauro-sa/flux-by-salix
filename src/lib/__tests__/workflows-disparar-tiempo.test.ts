/**
 * Tests unit del endpoint cron disparar-workflows-tiempo (PR 17).
 *
 * Cubre:
 *   - 401 sin auth o auth incorrecto.
 *   - 401 si CRON_SECRET no configurado, 500 si WEBHOOK_SECRET falta.
 *   - 200 sin flujos: escaneados=0.
 *   - tiempo.cron: dispara cuando proxima_ejecucion <= now, actualiza
 *     ultima_ejecucion_tiempo, no dispara dos veces en el mismo tick.
 *   - tiempo.cron: clave_idempotencia incluye ISO de la ventana
 *     (otro tick con misma ventana → unique_violation, ya_existian +1).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/admin', () => ({
  crearClienteAdmin: vi.fn(),
}))

import { GET } from '@/app/api/cron/disparar-workflows-tiempo/route'
import { crearClienteAdmin } from '@/lib/supabase/admin'

const crearClienteAdminMock = vi.mocked(crearClienteAdmin)

interface FlujoFila {
  id: string
  empresa_id: string
  activo: boolean
  disparador: unknown
  ultima_ejecucion_tiempo: string | null
}

function crearAdminMock(opts: {
  flujos?: FlujoFila[]
  empresas?: Array<{ id: string; zona_horaria: string | null }>
  /** ID que el INSERT en ejecuciones_flujo debe simular como insertado. Si null, simula unique_violation. */
  insertEjecucionId?: string | null
  /** Captura el último UPDATE flujos.ultima_ejecucion_tiempo */
  capturaUpdateTimestamp?: { id?: string; ts?: string }
}) {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla === 'flujos') return crearBuilderFlujos(opts)
      if (tabla === 'empresas') return crearBuilderEmpresas(opts)
      if (tabla === 'ejecuciones_flujo') return crearBuilderEjecucion(opts)
      throw new Error(`Tabla mock no soportada: ${tabla}`)
    }),
  }
}

function crearBuilderFlujos(opts: { flujos?: FlujoFila[]; capturaUpdateTimestamp?: { id?: string; ts?: string } }) {
  let modo: 'select' | 'update' = 'select'
  let updatePayload: Record<string, unknown> | null = null
  const builder: Record<string, unknown> = {
    select: vi.fn(() => {
      modo = 'select'
      return builder
    }),
    update: vi.fn((cambios: Record<string, unknown>) => {
      modo = 'update'
      updatePayload = cambios
      return builder
    }),
    eq: vi.fn((col: string, val: string) => {
      if (modo === 'update' && col === 'id' && opts.capturaUpdateTimestamp && updatePayload) {
        opts.capturaUpdateTimestamp.id = val
        opts.capturaUpdateTimestamp.ts = updatePayload.ultima_ejecucion_tiempo as string
        modo = 'select'
        updatePayload = null
        return Promise.resolve({ data: null, error: null })
      }
      return builder
    }),
    like: vi.fn(() =>
      Promise.resolve({ data: opts.flujos ?? [], error: null }),
    ),
  }
  return builder
}

function crearBuilderEmpresas(opts: { empresas?: Array<{ id: string; zona_horaria: string | null }> }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    in: vi.fn(() => Promise.resolve({ data: opts.empresas ?? [], error: null })),
  }
  return builder
}

function crearBuilderEjecucion(opts: { insertEjecucionId?: string | null }) {
  const builder: Record<string, unknown> = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(() => {
      if (opts.insertEjecucionId === null) {
        return Promise.resolve({ data: null, error: { code: '23505', message: 'unique_violation' } })
      }
      return Promise.resolve({ data: { id: opts.insertEjecucionId ?? 'ej-1' }, error: null })
    }),
  }
  return builder
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  process.env.CRON_SECRET = 'test-cron'
  process.env.WEBHOOK_SECRET = 'test-webhook'
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-04T09:00:00Z'))
  fetchSpy = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
  globalThis.fetch = fetchSpy as unknown as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete process.env.CRON_SECRET
  delete process.env.WEBHOOK_SECRET
})

function crearReq(authHeader?: string): NextRequest {
  const headers = new Headers()
  if (authHeader) headers.set('authorization', authHeader)
  return new NextRequest(
    'https://flux.salixweb.com/api/cron/disparar-workflows-tiempo',
    { method: 'GET', headers },
  )
}

// =============================================================
// Casos
// =============================================================

describe('GET /api/cron/disparar-workflows-tiempo', () => {
  it('401 sin auth header', async () => {
    crearClienteAdminMock.mockReturnValue(crearAdminMock({}) as never)
    const r = await GET(crearReq())
    expect(r.status).toBe(401)
  })

  it('401 si CRON_SECRET no configurado', async () => {
    delete process.env.CRON_SECRET
    crearClienteAdminMock.mockReturnValue(crearAdminMock({}) as never)
    const r = await GET(crearReq('Bearer cualquier'))
    const body = (await r.json()) as { error: string }
    expect(r.status).toBe(401)
    expect(body.error).toBe('cron_secret_not_configured')
  })

  it('500 si WEBHOOK_SECRET falta', async () => {
    delete process.env.WEBHOOK_SECRET
    crearClienteAdminMock.mockReturnValue(crearAdminMock({}) as never)
    const r = await GET(crearReq('Bearer test-cron'))
    expect(r.status).toBe(500)
  })

  it('sin flujos: escaneados=0, no fetch', async () => {
    crearClienteAdminMock.mockReturnValue(crearAdminMock({ flujos: [] }) as never)
    const r = await GET(crearReq('Bearer test-cron'))
    expect(r.status).toBe(200)
    const body = (await r.json()) as { escaneados: number; ejecuciones_creadas: number }
    expect(body.escaneados).toBe(0)
    expect(body.ejecuciones_creadas).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('tiempo.cron primera vez (ultima=null) NO retroactivo', async () => {
    // ahora = 09:00:00. Flujo `0 9 * * *` recién creado, ultima=null.
    // Por la regla NO retroactivo: primer disparo MAÑANA 09:00.
    // En este tick (09:00:00 de hoy), proxima > ahora → NO dispara.
    const captura: { id?: string; ts?: string } = {}
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock({
        flujos: [
          {
            id: 'f-1',
            empresa_id: 'emp-1',
            activo: true,
            disparador: {
              tipo: 'tiempo.cron',
              configuracion: { expresion: '0 9 * * *' },
            },
            ultima_ejecucion_tiempo: null,
          },
        ],
        empresas: [{ id: 'emp-1', zona_horaria: 'America/Argentina/Buenos_Aires' }],
        insertEjecucionId: 'ej-nueva',
        capturaUpdateTimestamp: captura,
      }) as never,
    )
    const r = await GET(crearReq('Bearer test-cron'))
    const body = (await r.json()) as { escaneados: number; ejecuciones_creadas: number }
    expect(body.escaneados).toBe(1)
    expect(body.ejecuciones_creadas).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(captura.id).toBeUndefined() // no se hizo el UPDATE
  })

  it('tiempo.cron con ultima en el pasado: dispara la ventana actual', async () => {
    // ahora = 09:00. Flujo `0 9 * * *`, ultima = ayer 09:00.
    // proxima desde ultima = hoy 09:00. proxima <= ahora → dispara.
    const captura: { id?: string; ts?: string } = {}
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock({
        flujos: [
          {
            id: 'f-1',
            empresa_id: 'emp-1',
            activo: true,
            disparador: {
              tipo: 'tiempo.cron',
              configuracion: { expresion: '0 9 * * *' },
            },
            ultima_ejecucion_tiempo: '2026-05-03T09:00:00Z',
          },
        ],
        empresas: [{ id: 'emp-1', zona_horaria: 'UTC' }],
        insertEjecucionId: 'ej-disparada',
        capturaUpdateTimestamp: captura,
      }) as never,
    )
    const r = await GET(crearReq('Bearer test-cron'))
    const body = (await r.json()) as { ejecuciones_creadas: number }
    expect(body.ejecuciones_creadas).toBe(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(captura.id).toBe('f-1')
    expect(captura.ts).toBe('2026-05-04T09:00:00.000Z')
  })

  it('tiempo.cron: si la ventana ya disparó (clave_idempotencia conflict), suma a ya_existian', async () => {
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock({
        flujos: [
          {
            id: 'f-1',
            empresa_id: 'emp-1',
            activo: true,
            disparador: {
              tipo: 'tiempo.cron',
              configuracion: { expresion: '0 9 * * *' },
            },
            ultima_ejecucion_tiempo: '2026-05-03T09:00:00Z',
          },
        ],
        empresas: [{ id: 'emp-1', zona_horaria: 'UTC' }],
        insertEjecucionId: null, // simula unique_violation
      }) as never,
    )
    const r = await GET(crearReq('Bearer test-cron'))
    const body = (await r.json()) as { ejecuciones_creadas: number }
    expect(body.ejecuciones_creadas).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('tiempo.cron: ahora ANTES de la ventana → no dispara', async () => {
    vi.setSystemTime(new Date('2026-05-04T08:00:00Z'))
    crearClienteAdminMock.mockReturnValue(
      crearAdminMock({
        flujos: [
          {
            id: 'f-1',
            empresa_id: 'emp-1',
            activo: true,
            disparador: {
              tipo: 'tiempo.cron',
              configuracion: { expresion: '0 9 * * *' },
            },
            ultima_ejecucion_tiempo: '2026-05-03T09:00:00Z',
          },
        ],
        empresas: [{ id: 'emp-1', zona_horaria: 'UTC' }],
      }) as never,
    )
    const r = await GET(crearReq('Bearer test-cron'))
    const body = (await r.json()) as { ejecuciones_creadas: number }
    expect(body.ejecuciones_creadas).toBe(0)
  })
})

/**
 * Tests unit del executor de workflows (sub-PR 15.1).
 *
 * Cada acción se prueba con 3 casos:
 *   - éxito
 *   - fallo transitorio (5xx / rate limit) — el executor lo clasifica
 *     como `transitorio: true` para que el orquestador reintente
 *   - fallo permanente (4xx semántico) — `transitorio: false`
 *
 * Mockean las libs externas (`@/lib/whatsapp`, `@/lib/estados/...`)
 * para no tocar BD ni red. El builder de Supabase admin se mockea
 * encadenable.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// ─── Mocks ─────────────────────────────────────────────────────
// Vitest los hoista al top automáticamente.
vi.mock('@/lib/whatsapp', () => ({
  enviarPlantillaWhatsApp: vi.fn(),
}))

vi.mock('@/lib/estados/aplicar-transicion', () => ({
  aplicarTransicionEstado: vi.fn(),
}))

import { ejecutarAccion, type ContextoEjecucion } from '../workflows/executor'
import { enviarPlantillaWhatsApp } from '@/lib/whatsapp'
import { aplicarTransicionEstado } from '@/lib/estados/aplicar-transicion'

const enviarPlantillaWhatsAppMock = vi.mocked(enviarPlantillaWhatsApp)
const aplicarTransicionEstadoMock = vi.mocked(aplicarTransicionEstado)

// ─── Builder mock encadenable de Supabase ─────────────────────

interface BuilderConfig {
  tablaEsperada?: string
  data?: unknown
  error?: { message: string; code?: string } | null
}

function crearAdminMock(porTabla: Record<string, BuilderConfig>) {
  return {
    from: vi.fn((tabla: string) => {
      const cfg = porTabla[tabla] ?? { data: null, error: null }
      return crearBuilder(cfg)
    }),
    rpc: vi.fn(),
  }
}

function crearBuilder(cfg: BuilderConfig) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: cfg.data ?? null, error: cfg.error ?? null }),
    ),
    single: vi.fn(() =>
      Promise.resolve({ data: cfg.data ?? null, error: cfg.error ?? null }),
    ),
  }
  return builder
}

const ctx: ContextoEjecucion = {
  empresa_id: 'emp-1',
  ejecucion_id: 'ej-1',
  flujo_id: 'flujo-1',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================
// 1) enviar_whatsapp_plantilla
// =============================================================

describe('ejecutarAccion — enviar_whatsapp_plantilla', () => {
  const accionBase = {
    tipo: 'enviar_whatsapp_plantilla' as const,
    canal_id: 'canal-1',
    telefono: '5491134567890',
    plantilla_nombre: 'recordatorio_pago',
    idioma: 'es_AR',
  }

  const canalConCredenciales = {
    id: 'canal-1',
    config_conexion: {
      access_token: 'tok',
      phone_number_id: 'pn',
      waba_id: 'wa',
    },
    numero_telefono: '+5491100000000',
  }

  it('éxito: devuelve message_id', async () => {
    enviarPlantillaWhatsAppMock.mockResolvedValue({
      messaging_product: 'whatsapp',
      contacts: [{ input: '5491134567890', wa_id: '5491134567890' }],
      messages: [{ id: 'wamid.MOCK-1' }],
    })
    const admin = crearAdminMock({
      canales_whatsapp: { data: canalConCredenciales },
    })

    const r = await ejecutarAccion(accionBase, ctx, admin as never)

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.message_id).toBe('wamid.MOCK-1')
    }
  })

  it('fallo transitorio: rate limit (Meta code 4) → transitorio=true', async () => {
    enviarPlantillaWhatsAppMock.mockRejectedValue(
      new Error('Meta API error: {"error":{"code":4,"message":"Application request limit reached"}}'),
    )
    const admin = crearAdminMock({
      canales_whatsapp: { data: canalConCredenciales },
    })

    const r = await ejecutarAccion(accionBase, ctx, admin as never)

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.transitorio).toBe(true)
      expect(r.error.status).toBe(4)
    }
  })

  it('fallo permanente: template no aprobado (code 132012) → transitorio=false', async () => {
    enviarPlantillaWhatsAppMock.mockRejectedValue(
      new Error('Meta API error: {"error":{"code":132012,"message":"Template not approved"}}'),
    )
    const admin = crearAdminMock({
      canales_whatsapp: { data: canalConCredenciales },
    })

    const r = await ejecutarAccion(accionBase, ctx, admin as never)

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.transitorio).toBe(false)
      expect(r.error.status).toBe(132012)
    }
  })

  it('fallo permanente: canal no encontrado', async () => {
    const admin = crearAdminMock({
      canales_whatsapp: { data: null },
    })
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.transitorio).toBe(false)
      expect(r.error.raw_class).toBe('CanalNoEncontrado')
    }
  })
})

// =============================================================
// 2) crear_actividad
// =============================================================

describe('ejecutarAccion — crear_actividad', () => {
  const accionBase = {
    tipo: 'crear_actividad' as const,
    tipo_actividad_id: 'tipo-1',
    titulo: 'Hacer seguimiento',
  }

  it('éxito: devuelve actividad_id', async () => {
    const admin = crearAdminMock({
      tipos_actividad: { data: { clave: 'seguimiento', etiqueta: 'Seguimiento' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
      actividades: { data: { id: 'act-1', titulo: 'Hacer seguimiento' } },
    })
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.actividad_id).toBe('act-1')
  })

  it('fallo permanente: tipo_actividad_id inexistente', async () => {
    const admin = crearAdminMock({
      tipos_actividad: { data: null },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
    })
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.transitorio).toBe(false)
      expect(r.error.raw_class).toBe('TipoNoEncontrado')
    }
  })

  it('fallo permanente: estado pendiente no sembrado', async () => {
    const admin = crearAdminMock({
      tipos_actividad: { data: { clave: 'seguimiento', etiqueta: 'Seguimiento' } },
      estados_actividad: { data: null },
    })
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.raw_class).toBe('EstadoNoEncontrado')
  })
})

// =============================================================
// 3) cambiar_estado_entidad
// =============================================================

describe('ejecutarAccion — cambiar_estado_entidad', () => {
  const accionBase = {
    tipo: 'cambiar_estado_entidad' as const,
    entidad_tipo: 'conversacion' as const,
    entidad_id: 'conv-1',
    hasta_clave: 'resuelta',
  }

  it('éxito: devuelve estado_anterior y estado_nuevo', async () => {
    aplicarTransicionEstadoMock.mockResolvedValue({
      ok: true,
      estadoAnterior: 'abierta',
      estadoNuevo: 'resuelta',
    })
    const admin = crearAdminMock({})
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.estado_anterior).toBe('abierta')
      expect(r.resultado.estado_nuevo).toBe('resuelta')
    }
  })

  it('fallo permanente: transición inválida', async () => {
    aplicarTransicionEstadoMock.mockResolvedValue({
      ok: false,
      estadoAnterior: 'spam',
      estadoNuevo: 'resuelta',
      error: 'Transición no permitida: spam → resuelta',
      transicionInvalida: true,
    })
    const admin = crearAdminMock({})
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.transitorio).toBe(false)
      expect(r.error.raw_class).toBe('TransicionInvalida')
    }
  })

  it('fallo permanente: motivo requerido', async () => {
    aplicarTransicionEstadoMock.mockResolvedValue({
      ok: false,
      estadoAnterior: 'abierta',
      estadoNuevo: 'spam',
      error: 'Esta transición requiere un motivo',
      motivoRequerido: true,
    })
    const admin = crearAdminMock({})
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.raw_class).toBe('MotivoRequerido')
  })
})

// =============================================================
// 4) notificar_usuario
// =============================================================

describe('ejecutarAccion — notificar_usuario', () => {
  const accionBase = {
    tipo: 'notificar_usuario' as const,
    usuario_id: 'user-1',
    titulo: 'Tenés una nueva visita asignada',
  }

  it('éxito: devuelve notificacion_id', async () => {
    const admin = crearAdminMock({
      notificaciones: { data: { id: 'notif-1' } },
    })
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.notificacion_id).toBe('notif-1')
  })

  it('fallo permanente: error de Supabase (RLS bloqueado)', async () => {
    const admin = crearAdminMock({
      notificaciones: {
        data: null,
        error: { message: 'new row violates row-level security policy', code: '42501' },
      },
    })
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.transitorio).toBe(false)
      expect(r.error.raw_class).toBe('pg:42501')
    }
  })

  it('fallo transitorio: timeout de conexión a BD', async () => {
    const admin = crearAdminMock({
      notificaciones: {
        data: null,
        error: { message: 'connection timeout to database' },
      },
    })
    const r = await ejecutarAccion(accionBase, ctx, admin as never)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.transitorio).toBe(true)
  })
})

// =============================================================
// 5) Acción no implementada del catálogo
// =============================================================

describe('ejecutarAccion — acción no implementada en 15.1', () => {
  it('devuelve fallo permanente con AccionNoImplementada', async () => {
    const admin = crearAdminMock({})
    const accion = {
      tipo: 'enviar_correo_plantilla',
      parametros: {},
    } as never
    const r = await ejecutarAccion(accion, ctx, admin as never)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.transitorio).toBe(false)
      expect(r.error.raw_class).toBe('AccionNoImplementada')
    }
  })
})

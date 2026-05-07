/**
 * Tests unit del enriquecimiento del contexto (PR 16).
 *
 * Cubre:
 *   - Carga de entidad completa por tipo (presupuesto/conversación/etc.).
 *   - Carga de contacto si la entidad tiene contacto_id directo.
 *   - Sin contacto si la entidad no lo tiene (ej: asistencia).
 *   - Carga de actor desde disparado_por (manual:<uuid>, cambios_estado:<uuid>).
 *   - Sin actor si disparado_por es cron/webhook.
 *   - Carga de empresa.
 *   - Field `ahora` agregado.
 *   - Errores de carga no rompen: dejan el campo en null.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { enriquecerContexto } from '../workflows/contexto'

interface DataPorTabla {
  presupuestos?: { data: unknown; error?: { message: string } | null }
  conversaciones?: { data: unknown; error?: { message: string } | null }
  asistencias?: { data: unknown; error?: { message: string } | null }
  contactos?: { data: unknown; error?: { message: string } | null }
  empresas?: { data: unknown; error?: { message: string } | null }
  perfiles?: { data: unknown; error?: { message: string } | null }
  cambios_estado?: { data: unknown; error?: { message: string } | null }
}

function crearAdminMock(porTabla: DataPorTabla) {
  return {
    from: vi.fn((tabla: string) => {
      const cfg = (porTabla as Record<string, { data: unknown; error?: unknown } | undefined>)[tabla]
      const data = cfg?.data ?? null
      const error = cfg?.error ?? null
      const builder: Record<string, unknown> = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve({ data, error })),
      }
      return builder
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('enriquecerContexto', () => {
  it('carga entidad presupuesto + contacto + empresa + actor desde cambios_estado', async () => {
    const admin = crearAdminMock({
      presupuestos: {
        data: { id: 'pres-1', numero: 'PR-001', monto: 150000, contacto_id: 'cont-1' },
      },
      contactos: { data: { id: 'cont-1', nombre: 'Juan Pérez', email: 'juan@ejemplo.com' } },
      empresas: { data: { id: 'emp-1', nombre: 'Herreelec', zona_horaria: 'America/Argentina/Buenos_Aires' } },
      cambios_estado: { data: { usuario_id: 'user-1', usuario_nombre: 'Lauro', origen: 'manual' } },
      perfiles: { data: { id: 'user-1', nombre: 'Lauro', apellido: 'Sa', email: 'lauro@ejemplo.com' } },
    })
    const ctx = await enriquecerContexto(
      {
        empresa_id: 'emp-1',
        contexto_inicial: {
          trigger: { tipo: 'entidad.estado_cambio' },
          entidad: { tipo: 'presupuesto', id: 'pres-1' },
        },
        disparado_por: 'cambios_estado:cambio-1',
      },
      admin as never,
    )

    const entidad = ctx.entidad as Record<string, unknown>
    expect(entidad.numero).toBe('PR-001')
    expect(entidad.monto).toBe(150000)
    expect(entidad.tipo).toBe('presupuesto')

    const contacto = ctx.contacto as Record<string, unknown>
    expect(contacto.nombre).toBe('Juan Pérez')

    const empresa = ctx.empresa as Record<string, unknown>
    expect(empresa.nombre).toBe('Herreelec')

    const actor = ctx.actor as Record<string, unknown>
    expect(actor.nombre_completo).toBe('Lauro Sa')
    expect(actor.origen).toBe('manual')

    expect(typeof ctx.ahora).toBe('string')
  })

  it('asistencia: sin contacto (no tiene contacto_id directo)', async () => {
    const admin = crearAdminMock({
      asistencias: { data: { id: 'asis-1', empleado_id: 'emp-1' } },
      empresas: { data: { id: 'emp-1', nombre: 'X' } },
    })
    const ctx = await enriquecerContexto(
      {
        empresa_id: 'emp-1',
        contexto_inicial: { entidad: { tipo: 'asistencia', id: 'asis-1' } },
        disparado_por: null,
      },
      admin as never,
    )
    expect(ctx.contacto).toBeNull()
    expect(ctx.actor).toBeNull()
  })

  it('disparado_por manual:<uuid> carga perfil directamente', async () => {
    const admin = crearAdminMock({
      perfiles: { data: { id: 'user-2', nombre: 'María', apellido: 'González' } },
      empresas: { data: { id: 'emp-1', nombre: 'X' } },
    })
    const ctx = await enriquecerContexto(
      {
        empresa_id: 'emp-1',
        contexto_inicial: {},
        disparado_por: 'manual:user-2',
      },
      admin as never,
    )
    const actor = ctx.actor as Record<string, unknown>
    expect(actor.nombre_completo).toBe('María González')
  })

  it('disparado_por cron:* sin actor', async () => {
    const admin = crearAdminMock({
      empresas: { data: { id: 'emp-1', nombre: 'X' } },
    })
    const ctx = await enriquecerContexto(
      {
        empresa_id: 'emp-1',
        contexto_inicial: {},
        disparado_por: 'cron:0 9 * * *',
      },
      admin as never,
    )
    expect(ctx.actor).toBeNull()
  })

  it('error al cargar entidad → entidad queda en null', async () => {
    const admin = crearAdminMock({
      presupuestos: { data: null, error: { message: 'RLS bloqueo' } },
      empresas: { data: { id: 'emp-1', nombre: 'X' } },
    })
    const ctx = await enriquecerContexto(
      {
        empresa_id: 'emp-1',
        contexto_inicial: { entidad: { tipo: 'presupuesto', id: 'pres-x' } },
        disparado_por: null,
      },
      admin as never,
    )
    // entidad.tipo se preserva del base, pero los campos completos no se cargaron.
    const entidad = ctx.entidad as Record<string, unknown>
    expect(entidad.tipo).toBe('presupuesto')
    expect(entidad.numero).toBeUndefined()
  })

  it('preserva trigger y cambio del contexto base', async () => {
    const admin = crearAdminMock({
      empresas: { data: { id: 'emp-1', nombre: 'X' } },
    })
    const ctx = await enriquecerContexto(
      {
        empresa_id: 'emp-1',
        contexto_inicial: {
          trigger: { tipo: 'entidad.estado_cambio', cambios_estado_id: 'ce-1' },
          cambio: { estado_anterior: 'borrador', estado_nuevo: 'aceptado' },
        },
        disparado_por: null,
      },
      admin as never,
    )
    expect(ctx.trigger).toEqual({ tipo: 'entidad.estado_cambio', cambios_estado_id: 'ce-1' })
    expect(ctx.cambio).toEqual({ estado_anterior: 'borrador', estado_nuevo: 'aceptado' })
  })
})

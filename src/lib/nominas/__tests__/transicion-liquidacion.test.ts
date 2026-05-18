/**
 * Tests del helper transicionar-liquidacion-empleado.
 *
 * Cubre las reglas de la FSM (sql/103) usando un cliente Supabase
 * mockeado. NO toca BD real. Los tests E2E con la BD están en
 * sql/tests/ (formato pgTAP) y los corre el CI por separado.
 *
 * Reglas validadas:
 *   - Transición legal: borrador → liquidado pasa.
 *   - Transición ilegal: borrador → enviado rechazado.
 *   - Motivo requerido: liquidado → borrador sin motivo rechazado.
 *   - Envío obligatorio: liquidado → pagado bloqueado si la empresa
 *     lo exige y no se pasó por 'enviado'.
 *   - Período cerrado: cualquier transición rechazada con periodo_cerrado.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transicionarLiquidacionEmpleado } from '../transicion-liquidacion'

// ─── Mock factory de cliente Supabase ───────────────────────
// Cada test arma una "BD mockeada" con los registros que necesita.
interface BDMock {
  periodo?: { id: string; estado_clave: 'abierto' | 'cerrado' } | null
  filaActual?: {
    id: string
    estado_clave: 'borrador' | 'liquidado' | 'enviado' | 'pagado'
    snapshot_calculo?: unknown
    pago_nomina_id?: string
  } | null
  transicionLegal?: { requiere_motivo: boolean } | null
  empresa?: { nominas_envio_obligatorio: boolean }
  insertarFila?: { id: string; estado_clave: string }
  actualizarFila?: { id: string; estado_clave: string }
  fallarPeriodo?: boolean
}

function mockAdmin(bd: BDMock) {
  const builder = (data: unknown, error: unknown = null) => ({
    select: () => builder(data, error),
    insert: () => builder(data, error),
    update: () => builder(data, error),
    eq: () => builder(data, error),
    or: () => builder(data, error),
    order: () => builder(data, error),
    limit: () => builder(data, error),
    maybeSingle: () => Promise.resolve({ data, error }),
    single: () => Promise.resolve({ data, error }),
  })

  const admin = {
    from: vi.fn((tabla: string) => {
      if (tabla === 'liquidaciones_periodo') {
        if (bd.fallarPeriodo) return builder(null, new Error('boom'))
        return {
          select: () => builder(bd.periodo ?? null),
          insert: () => builder({ id: 'lp-nuevo' }),
        }
      }
      if (tabla === 'liquidaciones_empleado_periodo') {
        return {
          select: () => builder(bd.filaActual ?? null),
          insert: () => builder(bd.insertarFila ?? { id: 'lep-nuevo', estado_clave: 'liquidado' }),
          update: () => builder(bd.actualizarFila ?? { id: bd.filaActual?.id, estado_clave: 'liquidado' }),
        }
      }
      if (tabla === 'transiciones_estado') {
        return { select: () => builder(bd.transicionLegal ?? null) }
      }
      if (tabla === 'empresas') {
        return { select: () => builder(bd.empresa ?? { nominas_envio_obligatorio: false }) }
      }
      return builder(null)
    }),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }
  return admin as unknown as Parameters<typeof transicionarLiquidacionEmpleado>[0]
}

const baseInput = {
  empresaId: 'emp-1',
  miembroId: 'm-1',
  periodoInicio: '2026-05-01',
  periodoFin: '2026-05-15',
  usuario: { id: 'u-1', nombre: 'Operador' },
}

describe('transicionarLiquidacionEmpleado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('borrador → liquidado: pasa cuando la transición es legal', async () => {
    const admin = mockAdmin({
      periodo: { id: 'lp-1', estado_clave: 'abierto' },
      filaActual: null,
      transicionLegal: { requiere_motivo: false },
      insertarFila: { id: 'lep-1', estado_clave: 'liquidado' },
    })
    const r = await transicionarLiquidacionEmpleado(admin, {
      ...baseInput,
      hastaClave: 'liquidado',
      snapshotCalculo: { neto: 100 },
    })
    expect(r.ok).toBe(true)
  })

  it('rechaza transición ilegal con code=transicion_ilegal', async () => {
    const admin = mockAdmin({
      periodo: { id: 'lp-1', estado_clave: 'abierto' },
      filaActual: null,
      transicionLegal: null, // no hay transición seeded para borrador → enviado
    })
    const r = await transicionarLiquidacionEmpleado(admin, {
      ...baseInput,
      hastaClave: 'enviado',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('transicion_ilegal')
  })

  it('rechaza con motivo_requerido si la transición lo exige y no viene', async () => {
    const admin = mockAdmin({
      periodo: { id: 'lp-1', estado_clave: 'abierto' },
      filaActual: { id: 'lep-1', estado_clave: 'liquidado' },
      transicionLegal: { requiere_motivo: true },
    })
    const r = await transicionarLiquidacionEmpleado(admin, {
      ...baseInput,
      hastaClave: 'borrador',
      motivo: '',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('motivo_requerido')
  })

  it('bloquea pagado desde liquidado si la empresa exige envío obligatorio', async () => {
    const admin = mockAdmin({
      periodo: { id: 'lp-1', estado_clave: 'abierto' },
      filaActual: { id: 'lep-1', estado_clave: 'liquidado' },
      transicionLegal: { requiere_motivo: false },
      empresa: { nominas_envio_obligatorio: true },
    })
    const r = await transicionarLiquidacionEmpleado(admin, {
      ...baseInput,
      hastaClave: 'pagado',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('envio_obligatorio')
  })

  it('permite pagado desde enviado aunque la empresa exija envío obligatorio', async () => {
    const admin = mockAdmin({
      periodo: { id: 'lp-1', estado_clave: 'abierto' },
      filaActual: { id: 'lep-1', estado_clave: 'enviado' },
      transicionLegal: { requiere_motivo: false },
      empresa: { nominas_envio_obligatorio: true },
      actualizarFila: { id: 'lep-1', estado_clave: 'pagado' },
    })
    const r = await transicionarLiquidacionEmpleado(admin, {
      ...baseInput,
      hastaClave: 'pagado',
      pagoNominaId: 'pago-123',
    })
    expect(r.ok).toBe(true)
  })

  it('rechaza cualquier transición si el período está cerrado', async () => {
    const admin = mockAdmin({
      periodo: { id: 'lp-1', estado_clave: 'cerrado' },
    })
    const r = await transicionarLiquidacionEmpleado(admin, {
      ...baseInput,
      hastaClave: 'liquidado',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('periodo_cerrado')
  })
})

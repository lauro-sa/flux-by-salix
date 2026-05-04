/**
 * Tests unit del orquestador de ejecuciones (sub-PR 15.1).
 *
 * 4 casos críticos pedidos por la review del sub-PR:
 *   1. Ejecución normal: 3 acciones OK → completado, log con 3 entries.
 *   2. Acción 2 falla sin continuar_si_falla → fallado, log con error.
 *   3. Acción 2 falla con continuar_si_falla: true → completado, paso 3 ejecuta.
 *   4. Reintento transitorio: acción 1 falla 1ra vez, OK en 2da → log con
 *      ambos intentos visibles.
 *
 * Mockeamos:
 *   - `executor.ejecutarAccion` (cada caso controla qué devuelve).
 *   - Cliente admin de Supabase con builders encadenables que mantienen
 *     un store interno de la ejecución y el flujo, para que `correrEjecucion`
 *     pueda hacer SELECT y UPDATE realísticamente.
 *   - `sleep`: inyectado como no-op para no esperar 21s entre reintentos.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../workflows/executor', () => ({
  ejecutarAccion: vi.fn(),
  MARCADOR_ESPERANDO: '__workflow_esperando__',
  MARCADOR_TERMINAR: '__workflow_terminar__',
}))

import {
  correrEjecucion,
  type PasoLog,
} from '../workflows/correr-ejecucion'
import { ejecutarAccion } from '../workflows/executor'

const ejecutarAccionMock = vi.mocked(ejecutarAccion)

// ─── Builder mock del cliente admin ─────────────────────────
// Mantiene un store interno por tabla con un único registro por ID.
// Soporta select.eq.maybeSingle (lectura) y update.eq (escritura).

interface StoreEjecucion {
  id: string
  empresa_id: string
  flujo_id: string
  estado: string
  log: PasoLog[]
  inicio_en: string | null
  fin_en: string | null
  proximo_paso_en: string | null
  contexto_inicial: Record<string, unknown> | null
}

interface StoreFlujo {
  id: string
  acciones: unknown[]
}

interface Store {
  ejecucion: StoreEjecucion
  flujo: StoreFlujo
}

function crearAdminMock(store: Store) {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla === 'ejecuciones_flujo') return crearBuilderEjecucion(store)
      if (tabla === 'flujos') return crearBuilderFlujo(store)
      throw new Error(`Tabla mock no soportada: ${tabla}`)
    }),
  }
}

function crearBuilderEjecucion(store: Store) {
  let pendingUpdate: Record<string, unknown> | null = null
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    update: vi.fn((cambios: Record<string, unknown>) => {
      pendingUpdate = cambios
      return builder
    }),
    eq: vi.fn(() => {
      if (pendingUpdate) {
        Object.assign(store.ejecucion, pendingUpdate)
        pendingUpdate = null
        return Promise.resolve({ data: null, error: null })
      }
      return builder
    }),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: { ...store.ejecucion }, error: null }),
    ),
  }
  return builder
}

function crearBuilderFlujo(store: Store) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: { ...store.flujo }, error: null }),
    ),
  }
  return builder
}

const sleepInstantaneo = () => Promise.resolve()

// ─── Helpers comunes ─────────────────────────────────────────

function nuevaStore(acciones: unknown[]): Store {
  return {
    ejecucion: {
      id: 'ej-1',
      empresa_id: 'emp-1',
      flujo_id: 'flujo-1',
      estado: 'pendiente',
      log: [],
      inicio_en: null,
      fin_en: null,
      proximo_paso_en: null,
      contexto_inicial: {},
    },
    flujo: { id: 'flujo-1', acciones },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================
// Casos
// =============================================================

describe('correrEjecucion', () => {
  it('caso 1: 3 acciones OK → completado, log con 3 entries', async () => {
    const store = nuevaStore([
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' },
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'b' },
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'c' },
    ])
    ejecutarAccionMock.mockResolvedValue({
      ok: true,
      resultado: { notificacion_id: 'notif-1' },
    })
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('completado')
    expect(r.pasos_completados).toBe(3)
    expect(r.pasos_fallados).toBe(0)
    expect(store.ejecucion.estado).toBe('completado')
    expect(store.ejecucion.log).toHaveLength(3)
    expect(store.ejecucion.log.every((p) => p.estado === 'ok')).toBe(true)
    expect(store.ejecucion.log[0].intentos).toHaveLength(1)
    expect(store.ejecucion.log[0].intentos[0].resultado).toBe('ok')
    expect(store.ejecucion.fin_en).toBeTruthy()
    expect(store.ejecucion.inicio_en).toBeTruthy()
  })

  it('caso 2: acción 2 falla sin continuar_si_falla → fallado, paso 3 NO ejecuta', async () => {
    const store = nuevaStore([
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' },
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'b' }, // falla
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'c' }, // no debe ejecutarse
    ])
    ejecutarAccionMock
      .mockResolvedValueOnce({ ok: true, resultado: { notificacion_id: 'n-1' } })
      .mockResolvedValueOnce({
        ok: false,
        error: {
          mensaje: 'RLS bloqueado',
          transitorio: false,
          raw_class: 'pg:42501',
        },
      })
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('fallado')
    expect(store.ejecucion.estado).toBe('fallado')
    expect(store.ejecucion.log).toHaveLength(2)
    expect(store.ejecucion.log[1].estado).toBe('fallado')
    expect(store.ejecucion.log[1].intentos[0].error?.mensaje).toBe('RLS bloqueado')
    expect(store.ejecucion.log[1].intentos[0].error?.raw_class).toBe('pg:42501')
    // El executor solo se invocó 2 veces (el 3er paso no se ejecutó).
    expect(ejecutarAccionMock).toHaveBeenCalledTimes(2)
  })

  it('caso 3: acción 2 falla con continuar_si_falla:true → paso 3 ejecuta, completado', async () => {
    const store = nuevaStore([
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' },
      {
        tipo: 'notificar_usuario',
        usuario_id: 'u-1',
        titulo: 'b',
        continuar_si_falla: true,
      },
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'c' },
    ])
    ejecutarAccionMock
      .mockResolvedValueOnce({ ok: true, resultado: { notificacion_id: 'n-1' } })
      .mockResolvedValueOnce({
        ok: false,
        error: { mensaje: 'fallo', transitorio: false, raw_class: 'X' },
      })
      .mockResolvedValueOnce({ ok: true, resultado: { notificacion_id: 'n-3' } })
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('completado')
    expect(store.ejecucion.log).toHaveLength(3)
    expect(store.ejecucion.log[1].estado).toBe('fallado')
    expect(store.ejecucion.log[1].continuo_pese_a_fallo).toBe(true)
    expect(store.ejecucion.log[2].estado).toBe('ok')
    expect(ejecutarAccionMock).toHaveBeenCalledTimes(3)
  })

  it('caso 4: reintento transitorio en intento 1, OK en intento 2 → log con 2 intentos', async () => {
    const store = nuevaStore([
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' },
    ])
    ejecutarAccionMock
      .mockResolvedValueOnce({
        ok: false,
        error: { mensaje: 'rate limit', transitorio: true, status: 429, raw_class: 'MetaError' },
      })
      .mockResolvedValueOnce({ ok: true, resultado: { notificacion_id: 'n-1' } })
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('completado')
    expect(store.ejecucion.log).toHaveLength(1)
    const paso = store.ejecucion.log[0]
    expect(paso.estado).toBe('ok')
    expect(paso.intentos).toHaveLength(2)
    expect(paso.intentos[0].resultado).toBe('fallo_transitorio')
    expect(paso.intentos[0].error?.status).toBe(429)
    expect(paso.intentos[0].error?.raw_class).toBe('MetaError')
    expect(paso.intentos[1].resultado).toBe('ok')
    // Confirmamos que el executor se invocó 2 veces.
    expect(ejecutarAccionMock).toHaveBeenCalledTimes(2)
  })

  // Casos extra: defensa anti-doble-fire.

  it('cortocircuito: ejecución ya completada → no toca nada', async () => {
    const store = nuevaStore([{ tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' }])
    store.ejecucion.estado = 'completado'
    store.ejecucion.log = [
      { paso: 1, tipo: 'notificar_usuario', estado: 'ok', inicio_en: 'x', fin_en: 'y', intentos: [] },
    ]
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('completado')
    expect(r.pasos_completados).toBe(1)
    // Ni el executor ni un UPDATE se invocaron.
    expect(ejecutarAccionMock).not.toHaveBeenCalled()
  })

  it('cortocircuito: ejecución corriendo (otro orquestador activo) → no duplica trabajo', async () => {
    const store = nuevaStore([{ tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' }])
    store.ejecucion.estado = 'corriendo'
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('corriendo')
    expect(ejecutarAccionMock).not.toHaveBeenCalled()
  })

  it('agota reintentos transitorios (3) y marca fallado', async () => {
    const store = nuevaStore([
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' },
    ])
    ejecutarAccionMock.mockResolvedValue({
      ok: false,
      error: { mensaje: 'rate limit', transitorio: true, status: 429 },
    })
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('fallado')
    expect(store.ejecucion.log[0].intentos).toHaveLength(4) // 1 inicial + 3 reintentos
    expect(ejecutarAccionMock).toHaveBeenCalledTimes(4)
  })

  // ─── Tests sub-PR 15.2 ─────────────────────────────────────

  it('15.2: acción esperar marca ejecución esperando + proximo_paso_en, no avanza', async () => {
    const store = nuevaStore([
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' },
      { tipo: 'esperar', duracion_ms: 60000 },
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'b' }, // no debe ejecutar todavía
    ])
    const futuroIso = new Date(Date.now() + 60000).toISOString()
    ejecutarAccionMock
      .mockResolvedValueOnce({ ok: true, resultado: { notificacion_id: 'n-1' } })
      .mockResolvedValueOnce({
        ok: true,
        resultado: {
          ['__workflow_esperando__']: true,
          accion_pendiente_id: 'ap-1',
          ejecutar_en: futuroIso,
        },
      })
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('esperando')
    expect(store.ejecucion.estado).toBe('esperando')
    expect(store.ejecucion.proximo_paso_en).toBe(futuroIso)
    expect(store.ejecucion.fin_en).toBeNull()
    expect(store.ejecucion.log).toHaveLength(2)
    expect(ejecutarAccionMock).toHaveBeenCalledTimes(2) // paso 3 NO ejecuta
  })

  it('15.2: reanuda desde el log si la ejecución llega en estado esperando', async () => {
    const store = nuevaStore([
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' }, // ya hecha
      { tipo: 'esperar', duracion_ms: 60000 },                       // ya hecha
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'b' }, // próxima
    ])
    // Simulamos retorno post-cron: estado esperando, log con 2 pasos.
    store.ejecucion.estado = 'esperando'
    store.ejecucion.log = [
      { paso: 1, tipo: 'notificar_usuario', estado: 'ok', inicio_en: 'x', fin_en: 'y', intentos: [] },
      { paso: 2, tipo: 'esperar', estado: 'ok', inicio_en: 'x', fin_en: 'y', intentos: [] },
    ]
    ejecutarAccionMock.mockResolvedValueOnce({
      ok: true,
      resultado: { notificacion_id: 'n-2' },
    })
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('completado')
    expect(store.ejecucion.log).toHaveLength(3)
    expect(store.ejecucion.log[2].tipo).toBe('notificar_usuario')
    // El executor solo se invocó para el paso 3.
    expect(ejecutarAccionMock).toHaveBeenCalledTimes(1)
  })

  it('15.2: acción terminar_flujo corta el flujo con estado completado', async () => {
    const store = nuevaStore([
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'a' },
      { tipo: 'terminar_flujo', motivo: 'fin temprano' },
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'no debe' },
    ])
    ejecutarAccionMock
      .mockResolvedValueOnce({ ok: true, resultado: { notificacion_id: 'n-1' } })
      .mockResolvedValueOnce({
        ok: true,
        resultado: { ['__workflow_terminar__']: true, motivo: 'fin temprano' },
      })
    const admin = crearAdminMock(store)

    const r = await correrEjecucion('ej-1', admin as never, { sleep: sleepInstantaneo })

    expect(r.estado_final).toBe('completado')
    expect(store.ejecucion.log).toHaveLength(2) // paso 3 no ejecuta
    expect(ejecutarAccionMock).toHaveBeenCalledTimes(2)
  })
})

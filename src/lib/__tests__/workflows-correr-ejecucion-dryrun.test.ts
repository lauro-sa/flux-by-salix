/**
 * Tests del orquestador de dry-run (sub-PR 19.5).
 *
 * Verifica el comportamiento end-to-end de `correrEjecucionDryRun`:
 *   - Flujo completo con mix de acciones reales termina sin tocar BD
 *     ni servicios externos.
 *   - `esperar` avanza synchronously (NO bloquea, NO inserta).
 *   - `condicion_branch` evalúa contra el contexto y ejecuta la rama.
 *   - `terminar_flujo` corta el loop; pasos posteriores no se loguean.
 *   - Acciones no implementadas en el motor (`enviar_correo_plantilla`)
 *     se loguean con `no_implementada: true` para el banner ámbar de
 *     la consola (caveat D3).
 *   - Variables `{{vars}}` faltantes (caveat D6: cron sin entidad) NO
 *     crashean el orquestador; el paso queda fallado y el resto sigue.
 *
 * Mocks: igual patrón que el test del executor — spies sobre Meta y
 * `aplicarTransicionEstado`. El admin de Supabase está mockeado para
 * que NO se llame nunca a `from(<tabla con side-effect>)`.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/whatsapp', () => ({
  enviarPlantillaWhatsApp: vi.fn(),
}))
vi.mock('@/lib/estados/aplicar-transicion', () => ({
  aplicarTransicionEstado: vi.fn(),
}))

import { correrEjecucionDryRun } from '../workflows/correr-ejecucion-dryrun'
import { enviarPlantillaWhatsApp } from '@/lib/whatsapp'
import { aplicarTransicionEstado } from '@/lib/estados/aplicar-transicion'

const enviarPlantillaWhatsAppMock = vi.mocked(enviarPlantillaWhatsApp)
const aplicarTransicionEstadoMock = vi.mocked(aplicarTransicionEstado)

// Builder de admin que registra qué tablas se consultaron y nunca
// permite INSERT (devuelve data null + error null en read-only).
function crearAdminTrackeable(porTabla: Record<string, { data?: unknown }> = {}) {
  const llamadas: Array<{ tabla: string; metodo: string }> = []
  const admin = {
    from: vi.fn((tabla: string) => {
      const cfg = porTabla[tabla] ?? {}
      const builder: Record<string, unknown> = {
        select: vi.fn((..._a: unknown[]) => {
          llamadas.push({ tabla, metodo: 'select' })
          return builder
        }),
        insert: vi.fn(() => {
          llamadas.push({ tabla, metodo: 'insert' })
          return builder
        }),
        update: vi.fn(() => {
          llamadas.push({ tabla, metodo: 'update' })
          return builder
        }),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() =>
          Promise.resolve({ data: cfg.data ?? null, error: null }),
        ),
        single: vi.fn(() =>
          Promise.resolve({ data: cfg.data ?? null, error: null }),
        ),
      }
      return builder
    }),
    rpc: vi.fn(),
  }
  return { admin, llamadas }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================
// 1) Flujo end-to-end con mix de acciones — cero side-effects
// =============================================================

describe('correrEjecucionDryRun — flujo end-to-end mixto', () => {
  it('ejecuta WhatsApp + crear_actividad + esperar + notificar sin tocar BD ni Meta', async () => {
    const { admin, llamadas } = crearAdminTrackeable({
      tipos_actividad: { data: { clave: 'seguimiento', etiqueta: 'Seguimiento' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
    })

    const acciones = [
      {
        tipo: 'enviar_whatsapp_plantilla',
        canal_id: 'c-1',
        telefono: '5491134567890',
        plantilla_nombre: 'recordatorio',
        idioma: 'es_AR',
      },
      {
        tipo: 'crear_actividad',
        tipo_actividad_id: 'tipo-1',
        titulo: 'Hacer seguimiento',
      },
      { tipo: 'esperar', duracion_ms: 60_000 },
      { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'Listo' },
    ]

    const r = await correrEjecucionDryRun(
      { empresaId: 'emp-1', acciones, contextoVars: {} },
      admin as never,
    )

    // Cero side-effects.
    expect(enviarPlantillaWhatsAppMock).not.toHaveBeenCalled()
    expect(aplicarTransicionEstadoMock).not.toHaveBeenCalled()
    const inserts = llamadas.filter((l) => l.metodo === 'insert')
    expect(inserts).toHaveLength(0)
    // Tablas con INSERT crítico jamás se consultaron.
    expect(admin.from).not.toHaveBeenCalledWith('actividades')
    expect(admin.from).not.toHaveBeenCalledWith('notificaciones')
    expect(admin.from).not.toHaveBeenCalledWith('acciones_pendientes')
    expect(admin.from).not.toHaveBeenCalledWith('canales_whatsapp')

    // Log esperado.
    expect(r.estado_final).toBe('completado')
    expect(r.log).toHaveLength(4)
    expect(r.log.every((p) => p.estado === 'ok')).toBe(true)
    expect(r.log.every((p) => p.respuesta?.simulado === true)).toBe(true)

    // Resumen.
    expect(r.resumen.completados).toBe(4)
    expect(r.resumen.fallados).toBe(0)
    expect(r.resumen.simulados).toBe(4)
    expect(r.resumen.no_implementados).toBe(0)
    expect(r.resumen.terminado_temprano).toBe(false)
  })
})

// =============================================================
// 2) condicion_branch — evalúa real contra contexto
// =============================================================

describe('correrEjecucionDryRun — branches', () => {
  it('rama si: ejecuta sub-acciones simuladas cuando condición verdadera', async () => {
    const { admin } = crearAdminTrackeable()
    const r = await correrEjecucionDryRun(
      {
        empresaId: 'emp-1',
        acciones: [
          {
            tipo: 'condicion_branch',
            condicion: { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'aceptado' },
            acciones_si: [{ tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'aceptado' }],
            acciones_no: [{ tipo: 'notificar_usuario', usuario_id: 'u-2', titulo: 'no aceptado' }],
          },
        ],
        contextoVars: {
          entidad: { estado_nuevo: 'aceptado' },
        },
      },
      admin as never,
    )

    expect(r.estado_final).toBe('completado')
    expect(r.log).toHaveLength(1)
    expect(r.log[0].respuesta?.rama_ejecutada).toBe('si')
    const subPasos = r.log[0].respuesta?.sub_pasos as Array<Record<string, unknown>>
    expect(subPasos).toHaveLength(1)
    const respuestaSub = subPasos[0].respuesta as Record<string, unknown>
    expect(respuestaSub.simulado).toBe(true)
    expect(admin.from).not.toHaveBeenCalledWith('notificaciones')
  })

  it('terminar_flujo en rama corta el loop antes de procesar pasos posteriores', async () => {
    const { admin } = crearAdminTrackeable()
    const r = await correrEjecucionDryRun(
      {
        empresaId: 'emp-1',
        acciones: [
          {
            tipo: 'condicion_branch',
            condicion: { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'aceptado' },
            acciones_si: [{ tipo: 'terminar_flujo', motivo: 'corte' }],
            acciones_no: [],
          },
          { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'NO debería ejecutarse' },
        ],
        contextoVars: { entidad: { estado_nuevo: 'aceptado' } },
      },
      admin as never,
    )

    expect(r.estado_final).toBe('completado')
    expect(r.log).toHaveLength(1)
    expect(r.resumen.terminado_temprano).toBe(true)
  })
})

// =============================================================
// 3) Acción no implementada → simulado + flag para banner ámbar
// =============================================================

describe('correrEjecucionDryRun — acciones no implementadas en motor', () => {
  it('enviar_correo_plantilla queda como no_implementada=true en el log', async () => {
    const { admin } = crearAdminTrackeable()
    const r = await correrEjecucionDryRun(
      {
        empresaId: 'emp-1',
        acciones: [
          {
            tipo: 'enviar_correo_plantilla',
            plantilla_id: 'p-1',
            destinatario: 'lauro@test.com',
          },
        ],
        contextoVars: {},
      },
      admin as never,
    )

    expect(r.estado_final).toBe('completado')
    expect(r.log).toHaveLength(1)
    expect(r.log[0].estado).toBe('ok')
    expect(r.log[0].no_implementada).toBe(true)
    expect(r.resumen.no_implementados).toBe(1)
  })
})

// =============================================================
// 4) Caveat D6: cron sin entidad + variables faltantes
// =============================================================

describe('correrEjecucionDryRun — disparador cron sin entidad (caveat D6)', () => {
  it('flujo cron con {{contacto.nombre}} faltante: el paso falla pero el orquestador NO crashea', async () => {
    const { admin } = crearAdminTrackeable()
    // Contexto típico de un cron sin entidad de ejemplo: empresa + ahora,
    // sin entidad ni contacto. Ningún crash al referenciar {{contacto.nombre}}.
    const contextoVars = {
      empresa: { id: 'emp-1', nombre: 'ACME' },
      ahora: '2026-05-06T14:00:00Z',
      entidad: null,
      contacto: null,
      actor: null,
    }
    const r = await correrEjecucionDryRun(
      {
        empresaId: 'emp-1',
        acciones: [
          {
            tipo: 'notificar_usuario',
            usuario_id: 'u-1',
            titulo: 'Hola {{contacto.nombre}}',
          },
        ],
        contextoVars,
      },
      admin as never,
    )

    // No crash, terminó el orquestador.
    expect(r.log).toHaveLength(1)
    expect(r.log[0].estado).toBe('fallado')
    expect(r.log[0].error?.raw_class).toBe('VariableFaltante')
    expect(r.estado_final).toBe('fallado')
    // Sin side-effects.
    expect(admin.from).not.toHaveBeenCalledWith('notificaciones')
  })

  it('flujo cron con literal (sin variables): completa sin problemas', async () => {
    const { admin } = crearAdminTrackeable()
    const r = await correrEjecucionDryRun(
      {
        empresaId: 'emp-1',
        acciones: [
          { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'Recordatorio diario' },
        ],
        contextoVars: { empresa: { nombre: 'ACME' }, ahora: '2026-05-06T14:00:00Z' },
      },
      admin as never,
    )
    expect(r.estado_final).toBe('completado')
    expect(r.log[0].estado).toBe('ok')
  })
})

// =============================================================
// 5) continuar_si_falla permite seguir tras error
// =============================================================

describe('correrEjecucionDryRun — continuar_si_falla', () => {
  it('si una acción con continuar_si_falla=true falla, el flujo sigue', async () => {
    const { admin } = crearAdminTrackeable()
    const r = await correrEjecucionDryRun(
      {
        empresaId: 'emp-1',
        acciones: [
          {
            tipo: 'notificar_usuario',
            usuario_id: 'u-1',
            titulo: 'Hola {{contacto.nombre}}',
            continuar_si_falla: true,
          },
          { tipo: 'notificar_usuario', usuario_id: 'u-2', titulo: 'Sigue' },
        ],
        contextoVars: { contacto: null },
      },
      admin as never,
    )

    expect(r.log).toHaveLength(2)
    expect(r.log[0].estado).toBe('fallado')
    expect(r.log[0].continuo_pese_a_fallo).toBe(true)
    expect(r.log[1].estado).toBe('ok')
    expect(r.estado_final).toBe('completado')
  })
})

// =============================================================
// 6) esperar NO bloquea ni inserta
// =============================================================

describe('correrEjecucionDryRun — esperar no bloquea', () => {
  it('flujo con esperar(7d) termina synchronous con todos los pasos posteriores ejecutados', async () => {
    const { admin } = crearAdminTrackeable()
    const inicio = Date.now()
    const r = await correrEjecucionDryRun(
      {
        empresaId: 'emp-1',
        acciones: [
          { tipo: 'esperar', duracion_ms: 7 * 24 * 60 * 60 * 1000 }, // 7 días
          { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'Después de 7 días' },
        ],
        contextoVars: {},
      },
      admin as never,
    )
    const transcurrido = Date.now() - inicio

    expect(transcurrido).toBeLessThan(1000) // synchronous (mucho menos que 7 días).
    expect(r.estado_final).toBe('completado')
    expect(r.log).toHaveLength(2)
    expect(r.log[0].respuesta?.simulado).toBe(true)
    expect(r.log[0].respuesta?.esperaria_ms).toBe(7 * 24 * 60 * 60 * 1000)
    expect(r.log[1].estado).toBe('ok')
    expect(admin.from).not.toHaveBeenCalledWith('acciones_pendientes')
  })
})

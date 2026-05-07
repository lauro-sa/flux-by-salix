/**
 * Tests del executor de workflows en modo dry-run (sub-PR 19.5).
 *
 * Garantía central: cuando el `ContextoEjecucion` lleva `dry_run: true`,
 * cada handler de acción con side-effect externo debe:
 *
 *   1. NO invocar el módulo externo (Meta WhatsApp, transición de estado,
 *      INSERT en BD).
 *   2. Devolver `ok: true` con `resultado.simulado === true` y un payload
 *      legible (`accion_simulada`, parámetros principales).
 *   3. Para acciones de control (esperar, condicion_branch, terminar_flujo)
 *      RESPETAR el control de flujo: branches evalúan condición real,
 *      terminar_flujo termina, esperar avanza sin bloquear el flujo.
 *
 * Cada test usa spies sobre los mocks para verificar count = 0 en los
 * caminos críticos (la prueba más fuerte de "cero side-effects").
 *
 * NO tocar tests existentes en `workflows-executor.test.ts` — esos
 * verifican el path normal (sin flag) y deben seguir verde idénticos.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// ─── Mocks ─────────────────────────────────────────────────────
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

// ─── Builder mock encadenable de Supabase con spies expuestos ─────
// A diferencia del builder de los tests del path normal, acá guardamos
// los `vi.fn()` por tabla para que cada test pueda verificar
// `expect(builder.insert).not.toHaveBeenCalled()` en dry-run.

interface BuilderConfig {
  data?: unknown
  error?: { message: string; code?: string } | null
}

interface BuilderConSpies {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

function crearAdminConSpies(porTabla: Record<string, BuilderConfig>) {
  const builders: Record<string, BuilderConSpies> = {}
  const admin = {
    from: vi.fn((tabla: string) => {
      const cfg = porTabla[tabla] ?? { data: null, error: null }
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
      builders[tabla] = builder as unknown as BuilderConSpies
      return builder
    }),
    rpc: vi.fn(),
  }
  return { admin, builders }
}

const ctxDry: ContextoEjecucion = {
  empresa_id: 'emp-1',
  ejecucion_id: 'ej-dry',
  flujo_id: 'flujo-1',
  dry_run: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================
// 1) enviar_whatsapp_plantilla — dry-run no debe llamar a Meta
// =============================================================

describe('dry-run — enviar_whatsapp_plantilla', () => {
  const accion = {
    tipo: 'enviar_whatsapp_plantilla' as const,
    canal_id: 'canal-1',
    telefono: '5491134567890',
    plantilla_nombre: 'recordatorio_pago',
    idioma: 'es_AR',
  }

  it('NO invoca enviarPlantillaWhatsApp y devuelve simulado=true', async () => {
    const { admin } = crearAdminConSpies({})
    const r = await ejecutarAccion(accion, ctxDry, admin as never)

    expect(enviarPlantillaWhatsAppMock).not.toHaveBeenCalled()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.simulado).toBe(true)
      expect(r.resultado.accion_simulada).toBe('enviar_whatsapp_plantilla')
      expect(r.resultado.destinatario).toBe('5491134567890')
      expect(r.resultado.plantilla).toBe('recordatorio_pago')
      expect(r.resultado.idioma).toBe('es_AR')
    }
  })

  it('NO consulta canales_whatsapp (no toca BD para credenciales)', async () => {
    const { admin } = crearAdminConSpies({})
    await ejecutarAccion(accion, ctxDry, admin as never)
    expect(admin.from).not.toHaveBeenCalledWith('canales_whatsapp')
  })

  it('preserva los componentes en el payload simulado', async () => {
    const { admin } = crearAdminConSpies({})
    const accionConComponentes = {
      ...accion,
      componentes: [
        { type: 'body', parameters: [{ type: 'text', text: 'Lauro' }] },
      ],
    }
    const r = await ejecutarAccion(accionConComponentes, ctxDry, admin as never)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.componentes).toEqual(accionConComponentes.componentes)
    }
  })
})

// =============================================================
// 2) crear_actividad — dry-run no debe insertar
// =============================================================

describe('dry-run — crear_actividad', () => {
  const accion = {
    tipo: 'crear_actividad' as const,
    tipo_actividad_id: 'tipo-1',
    titulo: 'Hacer seguimiento',
    descripcion: 'Llamar al cliente',
    prioridad: 'alta' as const,
  }

  it('NO inserta en actividades pero sí lee tipo y estado para enriquecer log', async () => {
    const { admin, builders } = crearAdminConSpies({
      tipos_actividad: { data: { clave: 'seguimiento', etiqueta: 'Seguimiento' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
    })

    const r = await ejecutarAccion(accion, ctxDry, admin as never)

    // Lee tipos y estados (read-only — para mostrar etiquetas en el log).
    expect(admin.from).toHaveBeenCalledWith('tipos_actividad')
    expect(admin.from).toHaveBeenCalledWith('estados_actividad')
    // NO toca actividades.
    expect(admin.from).not.toHaveBeenCalledWith('actividades')
    // Defensa en profundidad: si llegó a llamarse from('actividades'),
    // tampoco debe haberse llamado a insert.
    expect(builders.actividades?.insert).toBeUndefined()

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.simulado).toBe(true)
      expect(r.resultado.accion_simulada).toBe('crear_actividad')
      expect(r.resultado.titulo).toBe('Hacer seguimiento')
      expect(r.resultado.descripcion).toBe('Llamar al cliente')
      expect(r.resultado.prioridad).toBe('alta')
      // Etiqueta legible que viene del lookup read-only.
      expect(r.resultado.tipo_etiqueta).toBe('Seguimiento')
    }
  })

  it('reporta tipo no encontrado igual que el path real (validación read-only)', async () => {
    const { admin } = crearAdminConSpies({
      tipos_actividad: { data: null },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
    })
    const r = await ejecutarAccion(accion, ctxDry, admin as never)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.raw_class).toBe('TipoNoEncontrado')
  })
})

// =============================================================
// 3) cambiar_estado_entidad — dry-run no debe aplicar transición
// =============================================================

describe('dry-run — cambiar_estado_entidad', () => {
  const accion = {
    tipo: 'cambiar_estado_entidad' as const,
    entidad_tipo: 'conversacion' as const,
    entidad_id: 'conv-1',
    hasta_clave: 'resuelta',
  }

  it('NO invoca aplicarTransicionEstado y devuelve simulado', async () => {
    const { admin } = crearAdminConSpies({})
    const r = await ejecutarAccion(accion, ctxDry, admin as never)

    expect(aplicarTransicionEstadoMock).not.toHaveBeenCalled()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.simulado).toBe(true)
      expect(r.resultado.accion_simulada).toBe('cambiar_estado_entidad')
      expect(r.resultado.entidad_tipo).toBe('conversacion')
      expect(r.resultado.entidad_id).toBe('conv-1')
      expect(r.resultado.estado_nuevo).toBe('resuelta')
    }
  })
})

// =============================================================
// 4) notificar_usuario — dry-run no debe insertar
// =============================================================

describe('dry-run — notificar_usuario', () => {
  const accion = {
    tipo: 'notificar_usuario' as const,
    usuario_id: 'user-1',
    titulo: 'Tenés una visita asignada',
    cuerpo: 'Cliente: Acme',
  }

  it('NO inserta en notificaciones y devuelve simulado', async () => {
    const { admin } = crearAdminConSpies({})
    const r = await ejecutarAccion(accion, ctxDry, admin as never)

    expect(admin.from).not.toHaveBeenCalledWith('notificaciones')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.simulado).toBe(true)
      expect(r.resultado.accion_simulada).toBe('notificar_usuario')
      expect(r.resultado.usuario_id).toBe('user-1')
      expect(r.resultado.titulo).toBe('Tenés una visita asignada')
      expect(r.resultado.cuerpo).toBe('Cliente: Acme')
    }
  })
})

// =============================================================
// 5) esperar — dry-run NO inserta, NO devuelve marcador esperando
// =============================================================

describe('dry-run — esperar', () => {
  it('NO inserta en acciones_pendientes y avanza sin marcador esperando', async () => {
    const { admin } = crearAdminConSpies({})
    const r = await ejecutarAccion(
      { tipo: 'esperar', duracion_ms: 60_000 },
      ctxDry,
      admin as never,
    )

    expect(admin.from).not.toHaveBeenCalledWith('acciones_pendientes')
    expect(r.ok).toBe(true)
    if (r.ok) {
      // Crítico: NO devolver el marcador esperando, sino el orquestador
      // marca la ejecución como 'esperando' y queda colgada.
      expect(r.resultado['__workflow_esperando__']).toBeUndefined()
      expect(r.resultado.simulado).toBe(true)
      expect(r.resultado.esperaria_ms).toBe(60_000)
      expect(typeof r.resultado.esperaria_hasta).toBe('string')
    }
  })

  it('respeta hasta_fecha como alternativa a duracion_ms', async () => {
    const { admin } = crearAdminConSpies({})
    const fecha = '2030-01-01T00:00:00.000Z'
    const r = await ejecutarAccion(
      { tipo: 'esperar', hasta_fecha: fecha },
      ctxDry,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.esperaria_hasta).toBe(fecha)
      expect(r.resultado['__workflow_esperando__']).toBeUndefined()
    }
  })

  it('falla si hasta_fecha es no parseable (mismo criterio que path normal)', async () => {
    const { admin } = crearAdminConSpies({})
    const r = await ejecutarAccion(
      { tipo: 'esperar', hasta_fecha: 'no-es-fecha' },
      ctxDry,
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.raw_class).toBe('FechaInvalida')
  })
})

// =============================================================
// 6) condicion_branch — dry-run propaga el flag a sub-acciones
// =============================================================

describe('dry-run — condicion_branch', () => {
  const ctxDryConDatos: ContextoEjecucion = {
    ...ctxDry,
    contexto_inicial: {
      entidad: { estado_nuevo: 'aceptado', monto: 200000 },
    },
  }

  it('rama si: ejecuta sub-acciones SIMULADAS (no llama a Meta ni inserta)', async () => {
    const { admin } = crearAdminConSpies({})
    const r = await ejecutarAccion(
      {
        tipo: 'condicion_branch',
        condicion: { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'aceptado' },
        acciones_si: [
          {
            tipo: 'enviar_whatsapp_plantilla',
            canal_id: 'c-1',
            telefono: '111',
            plantilla_nombre: 'p',
            idioma: 'es_AR',
          },
          { tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 't' },
        ],
        acciones_no: [{ tipo: 'notificar_usuario', usuario_id: 'u-2', titulo: 'no' }],
      },
      ctxDryConDatos,
      admin as never,
    )

    expect(enviarPlantillaWhatsAppMock).not.toHaveBeenCalled()
    expect(admin.from).not.toHaveBeenCalledWith('notificaciones')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.rama_ejecutada).toBe('si')
      const subPasos = r.resultado.sub_pasos as Array<Record<string, unknown>>
      expect(subPasos).toHaveLength(2)
      const respuesta0 = subPasos[0].respuesta as Record<string, unknown>
      const respuesta1 = subPasos[1].respuesta as Record<string, unknown>
      expect(respuesta0.simulado).toBe(true)
      expect(respuesta1.simulado).toBe(true)
    }
  })

  it('evalúa la condición real (rama no cuando la condición es falsa)', async () => {
    const { admin } = crearAdminConSpies({})
    const r = await ejecutarAccion(
      {
        tipo: 'condicion_branch',
        condicion: { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'rechazado' },
        acciones_si: [{ tipo: 'notificar_usuario', usuario_id: 'u-1', titulo: 'si' }],
        acciones_no: [{ tipo: 'notificar_usuario', usuario_id: 'u-2', titulo: 'no' }],
      },
      ctxDryConDatos,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.rama_ejecutada).toBe('no')
  })

  it('propaga terminar_flujo desde una rama (control de flujo intacto)', async () => {
    const { admin } = crearAdminConSpies({})
    const r = await ejecutarAccion(
      {
        tipo: 'condicion_branch',
        condicion: { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'aceptado' },
        acciones_si: [{ tipo: 'terminar_flujo', motivo: 'cortado' }],
        acciones_no: [],
      },
      ctxDryConDatos,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado['__workflow_terminar__']).toBe(true)
  })
})

// =============================================================
// 7) terminar_flujo — comportamiento idéntico (no tiene side-effect)
// =============================================================

describe('dry-run — terminar_flujo', () => {
  it('devuelve marcador terminar igual que el path normal', async () => {
    const { admin } = crearAdminConSpies({})
    const r = await ejecutarAccion(
      { tipo: 'terminar_flujo', motivo: 'fin' },
      ctxDry,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado['__workflow_terminar__']).toBe(true)
      expect(r.resultado.motivo).toBe('fin')
    }
  })
})

// =============================================================
// 8) Acción no implementada en el motor
//    Sin flag → AccionNoImplementada (path normal). Con flag dry-run
//    → resultado simulado para que el log de la consola muestre
//    "se HARÍA esto" y el banner ámbar de la UI lo destaque.
// =============================================================

describe('dry-run — acción no implementada en el motor', () => {
  it('devuelve simulado=true con accion_simulada en vez de AccionNoImplementada', async () => {
    const { admin } = crearAdminConSpies({})
    const accion = {
      tipo: 'enviar_correo_plantilla',
      plantilla_id: 'pl-1',
      destinatario: '{{contacto.email}}',
    } as never
    const r = await ejecutarAccion(accion, ctxDry, admin as never)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.simulado).toBe(true)
      expect(r.resultado.accion_simulada).toBe('enviar_correo_plantilla')
      // Marca para que la UI sepa que es un tipo NO soportado por el motor.
      expect(r.resultado.no_implementada).toBe(true)
      // Payload preservado para que el log tenga la info que el usuario configuró.
      const payload = r.resultado.payload as Record<string, unknown>
      expect(payload.plantilla_id).toBe('pl-1')
    }
  })
})

// =============================================================
// 9) Sin flag (control negativo) — path normal sigue intacto
//    Si rompo el path normal por accidente, este test falla.
// =============================================================

describe('control negativo — sin dry_run, comportamiento original', () => {
  it('enviar_whatsapp_plantilla SÍ llama a enviarPlantillaWhatsApp', async () => {
    enviarPlantillaWhatsAppMock.mockResolvedValue({
      messaging_product: 'whatsapp',
      contacts: [{ input: '5491134567890', wa_id: '5491134567890' }],
      messages: [{ id: 'wamid.OK' }],
    })
    const { admin } = crearAdminConSpies({
      canales_whatsapp: {
        data: {
          id: 'canal-1',
          config_conexion: {
            access_token: 'tok',
            phone_number_id: 'pn',
            waba_id: 'wa',
          },
          numero_telefono: '+5491100000000',
        },
      },
    })
    const ctxNormal: ContextoEjecucion = {
      empresa_id: 'emp-1',
      ejecucion_id: 'ej-normal',
      flujo_id: 'flujo-1',
      // sin dry_run
    }
    await ejecutarAccion(
      {
        tipo: 'enviar_whatsapp_plantilla',
        canal_id: 'canal-1',
        telefono: '5491134567890',
        plantilla_nombre: 'recordatorio_pago',
        idioma: 'es_AR',
      },
      ctxNormal,
      admin as never,
    )
    expect(enviarPlantillaWhatsAppMock).toHaveBeenCalledTimes(1)
  })
})

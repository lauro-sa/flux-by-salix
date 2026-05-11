/**
 * Test cross-flujo end-to-end (sub-PR 20.5, commit 7).
 *
 * Cubre el caveat C-mig-7: la verificación E2E vía MCP en flux-dev solo
 * llegó hasta el matcher (porque el worker en Vercel no conoce las
 * acciones nuevas hasta el merge a main). Este test cubre el end-to-end
 * vía mocks sin depender del worker.
 *
 * Caso central — handoff cross-flujo via `actividades_relaciones`:
 *   1. Flujo A: disparador `entidad.estado_cambio` con
 *      `solo_creacion=true`, hasta_clave='borrador'. Acción
 *      `crear_actividad` → registra fila en `actividades_relaciones`
 *      vinculada al presupuesto (sub-PR 20.2 auto-enriquecimiento).
 *   2. Flujo B: disparador `entidad.estado_cambio` hasta_clave='enviado'.
 *      Acción `completar_actividad` con criterio `relacionada_a` →
 *      lee `actividades_relaciones` y encuentra la actividad creada
 *      por el flujo A.
 *
 * Mock de `SupabaseClient` con estado compartido (fake DB en memoria)
 * que persiste entre las 2 invocaciones de `ejecutarAccion`. El mock
 * de `@/lib/chatter` captura las llamadas a `registrarChatter` para
 * verificar el chatter de Automatización.
 *
 * Cubre 3 casos:
 *   1. Caso feliz cross-flujo (handoff via actividades_relaciones).
 *   2. Idempotencia: re-ejecutar flujo B sobre actividad ya cerrada
 *      respeta `si_no_encuentra='continuar'` y devuelve cantidad=0.
 *   3. Multi-tenant: flujo de empresa A NO afecta actividades de
 *      empresa B vinculadas a presupuesto distinto.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AccionCrearActividad,
  AccionCompletarActividad,
} from '@/tipos/workflow'
import type { ContextoEjecucion } from '../workflows/executor'

// Mock global del módulo chatter para capturar llamadas sin tocar BD.
const chatterCapturado: Array<Record<string, unknown>> = []
vi.mock('@/lib/chatter', () => ({
  registrarChatter: vi.fn(async (args: Record<string, unknown>) => {
    chatterCapturado.push(args)
    return undefined
  }),
  registrarCambioEstado: vi.fn(),
}))

// Import después de vi.mock para que el executor use el mock.
import { ejecutarAccion } from '../workflows/executor'

// =============================================================
// Fake DB compartida entre invocaciones del executor
// =============================================================

interface FakeFila {
  [key: string]: unknown
}

interface FakeDB {
  actividades: FakeFila[]
  actividades_relaciones: FakeFila[]
  tipos_actividad: FakeFila[]
  estados_actividad: FakeFila[]
  flujos: FakeFila[]
}

function crearFakeDB(): FakeDB {
  return {
    actividades: [],
    actividades_relaciones: [],
    tipos_actividad: [
      { id: 'tipo-llamada', clave: 'llamada', etiqueta: 'Llamada', empresa_id: 'empresa-A' },
      { id: 'tipo-llamada', clave: 'llamada', etiqueta: 'Llamada', empresa_id: 'empresa-B' },
    ],
    estados_actividad: [
      { id: 'est-pendiente-A', clave: 'pendiente', grupo: 'pendiente', empresa_id: 'empresa-A' },
      { id: 'est-completado-A', clave: 'completada', grupo: 'completado', empresa_id: 'empresa-A' },
      { id: 'est-pendiente-B', clave: 'pendiente', grupo: 'pendiente', empresa_id: 'empresa-B' },
      { id: 'est-completado-B', clave: 'completada', grupo: 'completado', empresa_id: 'empresa-B' },
    ],
    flujos: [
      { id: 'flujo-A', empresa_id: 'empresa-A', nombre: 'Crear actividad al crear presupuesto' },
      { id: 'flujo-B', empresa_id: 'empresa-A', nombre: 'Cerrar al enviar presupuesto' },
    ],
  }
}

/**
 * Mock de SupabaseClient que rutea cada `from(tabla)` a un builder
 * encadenable que opera contra `db`. Cubre solo las queries que el
 * executor usa para `crear_actividad` + `completar_actividad`.
 */
function crearAdminMock(db: FakeDB): SupabaseClient {
  const filtros: Record<string, unknown>[] = []
  let tablaActual = ''

  const builder: Record<string, unknown> = {
    select: vi.fn((_cols?: string) => builder),
    insert: vi.fn((fila: FakeFila) => {
      const conId = { ...fila, id: fila.id ?? `${tablaActual}-${db[tablaActual as keyof FakeDB].length + 1}` }
      ;(db[tablaActual as keyof FakeDB] as FakeFila[]).push(conId)
      return {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: conId, error: null })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: conId, error: null })),
        })),
      }
    }),
    upsert: vi.fn((fila: FakeFila) => {
      // Para actividades_relaciones, simulamos UNIQUE (empresa_id, actividad_id, entidad_tipo, entidad_id) + ignoreDuplicates
      const tabla = db[tablaActual as keyof FakeDB] as FakeFila[]
      const yaExiste = tabla.some(
        (f) =>
          f.empresa_id === fila.empresa_id &&
          f.actividad_id === fila.actividad_id &&
          f.entidad_tipo === fila.entidad_tipo &&
          f.entidad_id === fila.entidad_id,
      )
      if (!yaExiste) {
        tabla.push({ ...fila, id: `rel-${tabla.length + 1}` })
      }
      return Promise.resolve({ data: null, error: null })
    }),
    update: vi.fn((cambios: FakeFila) => {
      // Aplicar cambios a las filas que matchean los filtros acumulados.
      const tabla = db[tablaActual as keyof FakeDB] as FakeFila[]
      const matches = tabla.filter((f) =>
        filtros.every((filtro) => {
          if ('id_in' in filtro) return (filtro.id_in as string[]).includes(f.id as string)
          for (const [k, v] of Object.entries(filtro)) {
            if (f[k] !== v) return false
          }
          return true
        }),
      )
      for (const m of matches) {
        Object.assign(m, cambios)
      }
      return {
        eq: vi.fn(() => builder),
        in: vi.fn(() => Promise.resolve({ data: null, error: null })),
      }
    }),
    eq: vi.fn((col: string, val: unknown) => {
      filtros.push({ [col]: val })
      return builder
    }),
    in: vi.fn((col: string, vals: unknown[]) => {
      if (col === 'id') filtros.push({ id_in: vals })
      else filtros.push({ [`${col}_in`]: vals })
      return builder
    }),
    contains: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => {
      const tabla = db[tablaActual as keyof FakeDB] as FakeFila[]
      const match = tabla.find((f) =>
        filtros.every((filtro) => {
          for (const [k, v] of Object.entries(filtro)) {
            if (f[k] !== v) return false
          }
          return true
        }),
      )
      return Promise.resolve({ data: match ?? null, error: null })
    }),
    single: vi.fn(() => {
      const tabla = db[tablaActual as keyof FakeDB] as FakeFila[]
      const match = tabla.find((f) =>
        filtros.every((filtro) => {
          for (const [k, v] of Object.entries(filtro)) {
            if (f[k] !== v) return false
          }
          return true
        }),
      )
      return Promise.resolve({ data: match ?? null, error: null })
    }),
    // Para queries que terminan sin .single/.maybeSingle (ej:
    // .from('actividades_relaciones').select(...).eq(...).eq(...) usado
    // en relacionada_a). Hacemos thenable.
    then: (resolve: (val: unknown) => void) => {
      const tabla = db[tablaActual as keyof FakeDB] as FakeFila[]
      const matches = tabla.filter((f) =>
        filtros.every((filtro) => {
          if ('id_in' in filtro) return (filtro.id_in as string[]).includes(f.id as string)
          for (const [k, v] of Object.entries(filtro)) {
            if (f[k] !== v) return false
          }
          return true
        }),
      )
      filtros.length = 0
      resolve({ data: matches, error: null })
    },
  }

  return {
    from: vi.fn((tabla: string) => {
      tablaActual = tabla
      filtros.length = 0
      return builder
    }),
  } as unknown as SupabaseClient
}

// =============================================================
// Tests
// =============================================================

describe('Cross-flujo end-to-end (handoff via actividades_relaciones)', () => {
  beforeEach(() => {
    chatterCapturado.length = 0
  })

  it('caso feliz: flujo A crea actividad vinculada al presupuesto + flujo B la cierra via relacionada_a', async () => {
    const db = crearFakeDB()
    const admin = crearAdminMock(db)

    // ─── ACCIÓN 1: flujo A — crear_actividad ───
    const accionA: AccionCrearActividad = {
      tipo: 'crear_actividad',
      tipo_actividad_id: 'tipo-llamada',
      titulo: 'Llamar al cliente',
    }
    const contextoA: ContextoEjecucion = {
      empresa_id: 'empresa-A',
      ejecucion_id: 'ej-A',
      flujo_id: 'flujo-A',
      contexto_inicial: {
        entidad: { tipo: 'presupuesto', id: 'presu-1' },
        cambio: { estado_anterior: null, estado_nuevo: 'borrador' },
      },
    }

    const resultadoA = await ejecutarAccion(accionA, contextoA, admin)
    expect(resultadoA.ok).toBe(true)

    // Verificar: actividad creada
    expect(db.actividades).toHaveLength(1)
    expect(db.actividades[0].titulo).toBe('Llamar al cliente')
    expect(db.actividades[0].empresa_id).toBe('empresa-A')
    expect(db.actividades[0].estado_clave).toBe('pendiente')
    expect(db.actividades[0].creado_por_nombre).toBe('Automatización')

    // Verificar: relación auto-enriquecida vincula la actividad al presupuesto
    expect(db.actividades_relaciones).toHaveLength(1)
    expect(db.actividades_relaciones[0]).toMatchObject({
      empresa_id: 'empresa-A',
      actividad_id: db.actividades[0].id,
      entidad_tipo: 'presupuesto',
      entidad_id: 'presu-1',
    })

    // ─── ACCIÓN 2: flujo B — completar_actividad via relacionada_a ───
    const accionB: AccionCompletarActividad = {
      tipo: 'completar_actividad',
      criterio: {
        relacionada_a: { entidad_tipo: 'presupuesto', entidad_id: 'presu-1' },
        si_multiple: 'todas',
        si_no_encuentra: 'continuar',
      },
    }
    const contextoB: ContextoEjecucion = {
      empresa_id: 'empresa-A',
      ejecucion_id: 'ej-B',
      flujo_id: 'flujo-B',
      contexto_inicial: {
        entidad: { tipo: 'presupuesto', id: 'presu-1' },
        cambio: { estado_anterior: 'borrador', estado_nuevo: 'enviado' },
      },
    }

    const resultadoB = await ejecutarAccion(accionB, contextoB, admin)
    expect(resultadoB.ok).toBe(true)
    expect(resultadoB.ok && resultadoB.resultado.cantidad).toBe(1)

    // Verificar: la actividad creada por el flujo A ahora está completada
    expect(db.actividades[0].estado_clave).toBe('completada')
    expect(db.actividades[0].editado_por_nombre).toBe('Automatización')

    // Verificar: chatter de Automatización registrado
    const chattersAutomatizacion = chatterCapturado.filter(
      (c) => c.autorNombre === 'Automatización' && c.entidadTipo === 'actividad',
    )
    expect(chattersAutomatizacion).toHaveLength(1)
    const meta = chattersAutomatizacion[0].metadata as {
      accion?: string
      detalles?: { origen?: string; flujo_id?: string }
    }
    expect(meta.accion).toBe('actividad_completada')
    expect(meta.detalles?.origen).toBe('flujo')
    expect(meta.detalles?.flujo_id).toBe('flujo-B')
  })

  it('idempotencia: re-ejecutar flujo B sobre actividad ya cerrada respeta si_no_encuentra=continuar (cantidad=0)', async () => {
    const db = crearFakeDB()
    const admin = crearAdminMock(db)

    // Estado inicial: actividad ya completada + relación existente.
    db.actividades.push({
      id: 'act-1',
      empresa_id: 'empresa-A',
      titulo: 'Llamar al cliente',
      tipo_id: 'tipo-llamada',
      estado_id: 'est-completado-A',
      estado_clave: 'completada',
    })
    db.actividades_relaciones.push({
      id: 'rel-1',
      empresa_id: 'empresa-A',
      actividad_id: 'act-1',
      entidad_tipo: 'presupuesto',
      entidad_id: 'presu-1',
    })

    const accion: AccionCompletarActividad = {
      tipo: 'completar_actividad',
      criterio: {
        relacionada_a: { entidad_tipo: 'presupuesto', entidad_id: 'presu-1' },
        si_multiple: 'todas',
        si_no_encuentra: 'continuar',
      },
    }
    const contexto: ContextoEjecucion = {
      empresa_id: 'empresa-A',
      ejecucion_id: 'ej-rerun',
      flujo_id: 'flujo-B',
    }

    const resultado = await ejecutarAccion(accion, contexto, admin)
    expect(resultado.ok).toBe(true)
    // Sin matches porque el WHERE estado_clave='pendiente' filtra la
    // ya completada. Devuelve cantidad=0 silencioso (idempotente).
    expect(resultado.ok && resultado.resultado.cantidad).toBe(0)
    // No se registró chatter nuevo (no había nada para cerrar).
    expect(chatterCapturado).toHaveLength(0)
  })

  it('multi-tenant: flujo de empresa-A NO afecta actividades vinculadas en empresa-B', async () => {
    const db = crearFakeDB()
    const admin = crearAdminMock(db)

    // Setup: actividad pendiente en empresa-B vinculada a un presupuesto
    // con el MISMO id que el de empresa-A (caso edge: ids colisionan).
    db.actividades.push({
      id: 'act-B',
      empresa_id: 'empresa-B',
      titulo: 'Actividad de B',
      tipo_id: 'tipo-llamada',
      estado_id: 'est-pendiente-B',
      estado_clave: 'pendiente',
    })
    db.actividades_relaciones.push({
      id: 'rel-B',
      empresa_id: 'empresa-B',
      actividad_id: 'act-B',
      entidad_tipo: 'presupuesto',
      entidad_id: 'presu-shared',
    })

    // Flujo de empresa-A intenta cerrar por presupuesto presu-shared.
    // El filtro empresa_id en el query de actividades_relaciones debe
    // excluir la fila de B.
    const accion: AccionCompletarActividad = {
      tipo: 'completar_actividad',
      criterio: {
        relacionada_a: { entidad_tipo: 'presupuesto', entidad_id: 'presu-shared' },
        si_multiple: 'todas',
        si_no_encuentra: 'continuar',
      },
    }
    const contexto: ContextoEjecucion = {
      empresa_id: 'empresa-A',
      ejecucion_id: 'ej-tenant',
      flujo_id: 'flujo-B',
    }

    const resultado = await ejecutarAccion(accion, contexto, admin)
    expect(resultado.ok).toBe(true)
    // No matchea porque el filtro empresa_id='empresa-A' excluye la
    // relación de empresa-B.
    expect(resultado.ok && resultado.resultado.cantidad).toBe(0)

    // Verificar: la actividad de empresa-B sigue intacta
    expect(db.actividades.find((a) => a.id === 'act-B')?.estado_clave).toBe('pendiente')
  })
})

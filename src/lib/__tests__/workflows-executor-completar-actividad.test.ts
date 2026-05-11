/**
 * Tests unit del handler `completar_actividad` del executor (sub-PR 20.1).
 *
 * Cubre:
 *   - Resolución del set por criterio (tipo_actividad_id + filtros).
 *   - si_multiple: 'mas_antigua' / 'mas_reciente' / 'todas' / 'fallar'.
 *   - si_no_encuentra: 'fallar' / 'continuar' (default).
 *   - Defensa runtime cuando el criterio queda sin filtro positivo.
 *   - relacionada_a sin tipo_actividad_id → PendienteSubPR20_2 (gating
 *     explícito hasta sub-PR 20.2).
 *   - Idempotencia: re-ejecutar con todas las matches ya cerradas no
 *     hace ruido (default 'continuar' devuelve cantidad=0).
 *   - Dry-run: no muta BD ni invoca chatter; payload legible (D6 caveat).
 *   - Chatter incluye motivo cuando llega (D5 caveat).
 *   - Resolución de variables anidadas vía `resolverEnObjeto` aplicado
 *     al shape del criterio (verifica el contrato R-1 que pidió el
 *     coordinador).
 *
 * NO mezclamos con los tests existentes (workflows-executor.test.ts /
 * workflows-executor-dryrun.test.ts) para no alterar su superficie —
 * regla R1 del coordinador: tests del motor existente deben pasar
 * IDÉNTICOS al cerrar 20.1.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// ─── Mocks ─────────────────────────────────────────────────────
// El handler real llama a `registrarChatter` que instancia su propio
// admin client. Lo mockeamos a no-op para que ningún test toque BD.
vi.mock('@/lib/chatter', () => ({
  registrarChatter: vi.fn(async () => undefined),
}))

import { ejecutarAccion, type ContextoEjecucion } from '../workflows/executor'
import { registrarChatter } from '@/lib/chatter'
import { resolverEnObjeto } from '../workflows/resolver-variables'

const registrarChatterMock = vi.mocked(registrarChatter)

// =============================================================
// Builder mock encadenable de Supabase con soporte para .in /
// .order / .limit / .contains, que el handler nuevo usa.
// =============================================================

interface BuilderConfig {
  /** Filas que devuelve el builder al resolver el await final. */
  data?: unknown
  error?: { message: string; code?: string } | null
}

interface BuilderEspia {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  contains: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  /** Última promesa resolvable: si no hay then() explícito, el await
   *  cae al thenable propio del builder (igual que el SDK). */
  then: (resolve: (v: unknown) => void) => void
}

function crearBuilder(cfg: BuilderConfig): BuilderEspia {
  const resultado = { data: cfg.data ?? null, error: cfg.error ?? null }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(resultado)),
    single: vi.fn(() => Promise.resolve(resultado)),
    then: (onFulfilled: (v: unknown) => unknown) => onFulfilled(resultado),
  })
  return builder as unknown as BuilderEspia
}

function crearAdmin(porTabla: Record<string, BuilderConfig>) {
  // Una instancia por tabla. El handler de completar_actividad invoca
  // `from('actividades')` dos veces (SELECT + UPDATE), y querés que las
  // spies acumulen sobre la misma instancia para verificar la query
  // entera. Si quisiéramos resultados distintos por llamada habría que
  // armar un builder con ciclo — hoy todos los tests usan resultado
  // único por tabla, así que no hace falta.
  const builders: Record<string, BuilderEspia> = {}
  const admin = {
    from: vi.fn((tabla: string) => {
      if (!builders[tabla]) {
        const cfg = porTabla[tabla] ?? { data: null, error: null }
        builders[tabla] = crearBuilder(cfg)
      }
      return builders[tabla]
    }),
    rpc: vi.fn(),
  }
  return { admin, builders }
}

const ctxBase: ContextoEjecucion = {
  empresa_id: 'emp-1',
  ejecucion_id: 'ej-1',
  flujo_id: 'flujo-1',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================
// Type guard / criterio insuficiente
// =============================================================

describe('completar_actividad — defensa runtime del criterio', () => {
  it('falla con CriterioInsuficiente si no hay tipo_actividad_id ni relacionada_a', async () => {
    const { admin } = crearAdmin({})
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { si_multiple: 'mas_antigua', asignado_id: 'u-1' },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.transitorio).toBe(false)
      expect(r.error.raw_class).toBe('CriterioInsuficiente')
    }
  })

  // sub-PR 20.2 reemplazó el stub `PendienteSubPR20_2` por lookup real
  // contra `actividades_relaciones`. El comportamiento esperado ahora es
  // "resuelve el set vía la tabla" — los tests del bloque
  // "resolver_real" cubren ese contrato.
})

// =============================================================
// Resolución del set
// =============================================================

const filaActA = {
  id: 'act-a',
  titulo: 'Presupuestar para visita 1',
  tipo_id: 'tipo-presupuestar',
  asignados_ids: ['user-1'],
  vinculo_ids: ['contacto-1'],
  creado_en: '2026-04-30T10:00:00Z',
}
const filaActB = {
  id: 'act-b',
  titulo: 'Presupuestar para visita 2',
  tipo_id: 'tipo-presupuestar',
  asignados_ids: ['user-1'],
  vinculo_ids: ['contacto-2'],
  creado_en: '2026-05-02T10:00:00Z',
}

describe('completar_actividad — resolución del set', () => {
  it('mas_antigua: cierra solo la primera (creado_en ASC)', async () => {
    const { admin, builders } = crearAdmin({
      // Builder de búsqueda: el handler hace .order ASC + .limit(2).
      actividades: { data: [filaActA, filaActB] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'Cerrar Presupuestar al enviar' } },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'mas_antigua' },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.cantidad).toBe(1)
      expect(r.resultado.actividades_completadas).toEqual(['act-a'])
    }
    // Verificamos que el handler pidió order ASC con limit(2).
    expect(builders.actividades.order).toHaveBeenCalledWith('creado_en', { ascending: true })
    expect(builders.actividades.limit).toHaveBeenCalledWith(2)
    // Y que registró un chatter por la actividad cerrada.
    expect(registrarChatterMock).toHaveBeenCalledTimes(1)
  })

  it('mas_reciente: invoca order DESC', async () => {
    const { admin, builders } = crearAdmin({
      actividades: { data: [filaActB, filaActA] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'F' } },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'mas_reciente' },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.actividades_completadas).toEqual(['act-b'])
    expect(builders.actividades.order).toHaveBeenCalledWith('creado_en', { ascending: false })
  })

  it('todas: cierra todas las matches (sin limit)', async () => {
    const { admin, builders } = crearAdmin({
      actividades: { data: [filaActA, filaActB] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'F' } },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'todas' },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.cantidad).toBe(2)
      expect(r.resultado.actividades_completadas).toEqual(['act-a', 'act-b'])
    }
    expect(builders.actividades.limit).not.toHaveBeenCalled()
    expect(registrarChatterMock).toHaveBeenCalledTimes(2)
  })

  it('fallar: si hay >1 match, error MultiplesMatches sin cerrar nada', async () => {
    const { admin } = crearAdmin({
      actividades: { data: [filaActA, filaActB] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'F' } },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'fallar' },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.transitorio).toBe(false)
      expect(r.error.raw_class).toBe('MultiplesMatches')
    }
    // No se llamó chatter porque no se cerró ninguna.
    expect(registrarChatterMock).not.toHaveBeenCalled()
  })
})

// =============================================================
// si_no_encuentra
// =============================================================

describe('completar_actividad — si_no_encuentra', () => {
  it("default 'continuar': set vacío devuelve cantidad=0 sin error (idempotencia)", async () => {
    const { admin } = crearAdmin({
      actividades: { data: [] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'mas_antigua' },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.cantidad).toBe(0)
      expect(r.resultado.actividades_completadas).toEqual([])
    }
    // Idempotencia: ningún chatter, ninguna mutación de estado.
    expect(registrarChatterMock).not.toHaveBeenCalled()
  })

  it("'fallar': set vacío rompe con NoEncontrada y transitorio=false", async () => {
    const { admin } = crearAdmin({
      actividades: { data: [] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          tipo_actividad_id: 'tipo-presupuestar',
          si_multiple: 'mas_antigua',
          si_no_encuentra: 'fallar',
        },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.raw_class).toBe('NoEncontrada')
      expect(r.error.transitorio).toBe(false)
    }
  })
})

// =============================================================
// Filtro estado_clave default 'pendiente'
// =============================================================

describe('completar_actividad — filtro estado_clave default', () => {
  it("aplica eq('estado_clave', 'pendiente') por default", async () => {
    const { admin, builders } = crearAdmin({
      actividades: { data: [filaActA] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'F' } },
    })
    await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'mas_antigua' },
      },
      ctxBase,
      admin as never,
    )
    // Buscamos algún .eq con estado_clave=pendiente en el builder de actividades.
    const llamadasEq = builders.actividades.eq.mock.calls
    expect(llamadasEq).toContainEqual(['estado_clave', 'pendiente'])
    expect(llamadasEq).toContainEqual(['empresa_id', 'emp-1'])
    expect(llamadasEq).toContainEqual(['tipo_id', 'tipo-presupuestar'])
  })

  it('respeta estado_clave override del criterio', async () => {
    const { admin, builders } = crearAdmin({
      actividades: { data: [] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
    })
    await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          tipo_actividad_id: 'tipo-presupuestar',
          estado_clave: 'pospuesta',
          si_multiple: 'mas_antigua',
        },
      },
      ctxBase,
      admin as never,
    )
    expect(builders.actividades.eq.mock.calls).toContainEqual(['estado_clave', 'pospuesta'])
  })
})

// =============================================================
// Multi-tenant — eq('empresa_id', ...)
// =============================================================

describe('completar_actividad — multi-tenant', () => {
  it('todas las queries filtran por empresa_id de la ejecución', async () => {
    const { admin, builders } = crearAdmin({
      actividades: { data: [filaActA] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'F' } },
    })
    await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'mas_antigua' },
      },
      ctxBase,
      admin as never,
    )
    // El builder de actividades, estados_actividad y flujos filtró por empresa_id.
    expect(builders.actividades.eq.mock.calls).toContainEqual(['empresa_id', 'emp-1'])
    expect(builders.estados_actividad.eq.mock.calls).toContainEqual(['empresa_id', 'emp-1'])
    expect(builders.flujos.eq.mock.calls).toContainEqual(['empresa_id', 'emp-1'])
    // El UPDATE también se acota a empresa_id (defense-in-depth contra
    // un id colisionando con otra empresa).
    expect(builders.actividades.eq.mock.calls).toContainEqual(['empresa_id', 'emp-1'])
  })
})

// =============================================================
// Chatter
// =============================================================

describe('completar_actividad — chatter', () => {
  it('mensaje sin motivo: "Completada por flujo «X»"', async () => {
    const { admin } = crearAdmin({
      actividades: { data: [filaActA] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'Cerrar Presupuestar al enviar' } },
    })
    await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'mas_antigua' },
      },
      ctxBase,
      admin as never,
    )
    expect(registrarChatterMock).toHaveBeenCalledTimes(1)
    const args = registrarChatterMock.mock.calls[0][0]
    expect(args.contenido).toBe('Completada por flujo «Cerrar Presupuestar al enviar»')
    expect(args.entidadTipo).toBe('actividad')
    expect(args.entidadId).toBe('act-a')
    expect(args.autorNombre).toBe('Automatización')
    expect(args.autorId).toBeNull()
    expect(args.metadata?.accion).toBe('actividad_completada')
    expect((args.metadata?.detalles as Record<string, unknown>)?.flujo_id).toBe('flujo-1')
    expect((args.metadata?.detalles as Record<string, unknown>)?.ejecucion_id).toBe('ej-1')
  })

  it('mensaje CON motivo: "Completada por flujo «X». Motivo: «Y»" (D5 caveat)', async () => {
    const { admin } = crearAdmin({
      actividades: { data: [filaActA] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'F' } },
    })
    await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'mas_antigua' },
        motivo: 'Presupuesto enviado',
      },
      ctxBase,
      admin as never,
    )
    const args = registrarChatterMock.mock.calls[0][0]
    expect(args.contenido).toBe('Completada por flujo «F». Motivo: «Presupuesto enviado»')
    expect((args.metadata?.detalles as Record<string, unknown>)?.motivo).toBe('Presupuesto enviado')
  })
})

// =============================================================
// Dry-run
// =============================================================

describe('completar_actividad — dry-run', () => {
  const ctxDry: ContextoEjecucion = { ...ctxBase, dry_run: true }

  it('NO mutar BD ni invocar chatter; payload incluye títulos + tipos legibles', async () => {
    const { admin, builders } = crearAdmin({
      actividades: { data: [filaActA] },
      tipos_actividad: { data: [{ id: 'tipo-presupuestar', etiqueta: 'Presupuestar', clave: 'presupuestar' }] },
      usuarios: { data: [{ id: 'user-1', nombre_completo: 'Lauro Salix' }] },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'mas_antigua' },
      },
      ctxDry,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.resultado.simulado).toBe(true)
      expect(r.resultado.accion_simulada).toBe('completar_actividad')
      expect(r.resultado.cantidad).toBe(1)
      const cerraria = r.resultado.actividades_que_cerraria as Array<Record<string, unknown>>
      expect(cerraria).toHaveLength(1)
      expect(cerraria[0]).toMatchObject({
        id: 'act-a',
        titulo: 'Presupuestar para visita 1',
        tipo_actividad_etiqueta: 'Presupuestar',
        creado_en: '2026-04-30T10:00:00Z',
      })
      expect(cerraria[0].asignado_nombres).toEqual(['Lauro Salix'])
    }
    // Críticas: NO se invocaron .update ni .insert sobre actividades.
    expect(builders.actividades.update).not.toHaveBeenCalled()
    expect(builders.actividades.insert).not.toHaveBeenCalled()
    expect(registrarChatterMock).not.toHaveBeenCalled()
  })

  it('dry-run cero matches: cantidad=0 sin pedir tipos ni usuarios', async () => {
    const { admin, builders } = crearAdmin({
      actividades: { data: [] },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-presupuestar', si_multiple: 'mas_antigua' },
      },
      ctxDry,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.cantidad).toBe(0)
    expect(builders.tipos_actividad).toBeUndefined()
    expect(builders.usuarios).toBeUndefined()
  })
})

// =============================================================
// Resolución de variables anidadas — contrato R-1 del coordinador
// =============================================================

describe('completar_actividad — resolución de {{vars}} anidadas', () => {
  it('resolverEnObjeto resuelve {{entidad.id}} dentro de criterio.relacionada_a.entidad_id', () => {
    const accionConVars = {
      tipo: 'completar_actividad' as const,
      criterio: {
        tipo_actividad_id: 'tipo-presupuestar',
        si_multiple: 'mas_antigua' as const,
        relacionada_a: {
          entidad_tipo: 'visita',
          entidad_id: '{{entidad.id}}',
        },
      },
    }
    const contexto = { entidad: { id: 'visita-real-uuid' } }
    const resuelta = resolverEnObjeto(accionConVars, contexto) as typeof accionConVars
    expect(resuelta.criterio.relacionada_a?.entidad_id).toBe('visita-real-uuid')
    // El resto del shape queda intacto.
    expect(resuelta.criterio.tipo_actividad_id).toBe('tipo-presupuestar')
    expect(resuelta.criterio.si_multiple).toBe('mas_antigua')
  })

  it('también resuelve filtros simples como contacto_id y asignado_id', () => {
    const accion = {
      tipo: 'completar_actividad' as const,
      criterio: {
        tipo_actividad_id: 'tipo-presupuestar',
        contacto_id: '{{contacto.id}}',
        asignado_id: '{{actor.id}}',
        si_multiple: 'mas_antigua' as const,
      },
    }
    const contexto = {
      contacto: { id: 'contacto-real' },
      actor: { id: 'actor-real' },
    }
    const resuelta = resolverEnObjeto(accion, contexto) as typeof accion
    expect(resuelta.criterio.contacto_id).toBe('contacto-real')
    expect(resuelta.criterio.asignado_id).toBe('actor-real')
  })
})

// =============================================================
// Resolver real de relacionada_a — sub-PR 20.2
// =============================================================
// Reemplazo del stub `PendienteSubPR20_2` del 20.1: ahora el ejecutor
// hace lookup contra `actividades_relaciones` con filtro multi-tenant
// explícito (no solo RLS — el motor corre con service_role).

describe('completar_actividad — resolver real de relacionada_a (20.2)', () => {
  it('match cross-entidad: cierra la actividad vinculada a la entidad madre', async () => {
    // Caso del prompt original: "presupuesto enviado → cierra Presupuestar
    // de esa visita". El criterio busca actividades de tipo
    // tipo-presupuestar vinculadas a la visita visita-1.
    const { admin, builders } = crearAdmin({
      actividades_relaciones: { data: [{ actividad_id: 'act-a' }] },
      actividades: { data: [filaActA] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'Cerrar Presupuestar al enviar' } },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          tipo_actividad_id: 'tipo-presupuestar',
          relacionada_a: { entidad_tipo: 'visita', entidad_id: 'visita-1' },
          si_multiple: 'mas_antigua',
        },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.actividades_completadas).toEqual(['act-a'])
    // C3: la query a actividades_relaciones filtró por empresa_id de la
    // ejecución (defensa explícita aunque RLS exista).
    expect(builders.actividades_relaciones.eq.mock.calls).toContainEqual([
      'empresa_id',
      'emp-1',
    ])
    expect(builders.actividades_relaciones.eq.mock.calls).toContainEqual([
      'entidad_tipo',
      'visita',
    ])
    expect(builders.actividades_relaciones.eq.mock.calls).toContainEqual([
      'entidad_id',
      'visita-1',
    ])
    // Y la query a actividades aplicó .in('id', [...]) con los ids
    // resueltos por el lookup.
    expect(builders.actividades.in.mock.calls).toContainEqual(['id', ['act-a']])
  })

  it('relacionada_a SOLO (sin tipo_actividad_id) ahora funciona — ya no es PendienteSubPR20_2', async () => {
    const { admin, builders } = crearAdmin({
      actividades_relaciones: { data: [{ actividad_id: 'act-a' }] },
      actividades: { data: [filaActA] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'F' } },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          relacionada_a: { entidad_tipo: 'visita', entidad_id: 'visita-1' },
          si_multiple: 'mas_antigua',
        },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(true)
    // No se aplicó filtro por tipo_id porque el criterio no lo trajo.
    const llamadasEqAct = builders.actividades.eq.mock.calls
    expect(llamadasEqAct).not.toContainEqual([
      'tipo_id',
      expect.any(String) as unknown,
    ])
  })

  it('sin relación registrada + si_no_encuentra=continuar → cantidad=0 (idempotencia)', async () => {
    const { admin } = crearAdmin({
      actividades_relaciones: { data: [] },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          relacionada_a: { entidad_tipo: 'visita', entidad_id: 'visita-x' },
          si_multiple: 'mas_antigua',
        },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.cantidad).toBe(0)
    // Short-circuit: NO se invocó chatter ni se llegó a query actividades.
    expect(registrarChatterMock).not.toHaveBeenCalled()
  })

  it("sin relación + si_no_encuentra='fallar' → NoEncontrada con mensaje legible", async () => {
    const { admin } = crearAdmin({
      actividades_relaciones: { data: [] },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          relacionada_a: { entidad_tipo: 'visita', entidad_id: 'visita-x' },
          si_multiple: 'mas_antigua',
          si_no_encuentra: 'fallar',
        },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.raw_class).toBe('NoEncontrada')
      // Mensaje incluye la entidad para que el operador entienda por qué.
      expect(r.error.mensaje).toMatch(/visita\/visita-x/)
    }
  })

  it('combina tipo_actividad_id + relacionada_a (ambos filtros aplican)', async () => {
    const { admin, builders } = crearAdmin({
      actividades_relaciones: { data: [{ actividad_id: 'act-a' }] },
      actividades: { data: [filaActA] },
      estados_actividad: { data: { id: 'estado-completada', clave: 'completada' } },
      flujos: { data: { nombre: 'F' } },
    })
    await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          tipo_actividad_id: 'tipo-presupuestar',
          relacionada_a: { entidad_tipo: 'visita', entidad_id: 'visita-1' },
          si_multiple: 'mas_antigua',
        },
      },
      ctxBase,
      admin as never,
    )
    // Ambos filtros visibles en la query a actividades.
    expect(builders.actividades.eq.mock.calls).toContainEqual([
      'tipo_id',
      'tipo-presupuestar',
    ])
    expect(builders.actividades.in.mock.calls).toContainEqual(['id', ['act-a']])
  })

  it('multi-tenant aislado: empresa B no resuelve relaciones de empresa A', async () => {
    // El handler usa ctx.empresa_id en el .eq() — el builder mock NO
    // distingue empresas; verificamos que el filtro está presente.
    const ctxEmpresaB = { ...ctxBase, empresa_id: 'emp-B' }
    const { admin, builders } = crearAdmin({
      actividades_relaciones: { data: [] },
    })
    await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          relacionada_a: { entidad_tipo: 'visita', entidad_id: 'visita-1' },
          si_multiple: 'mas_antigua',
        },
      },
      ctxEmpresaB,
      admin as never,
    )
    expect(builders.actividades_relaciones.eq.mock.calls).toContainEqual([
      'empresa_id',
      'emp-B',
    ])
  })

  it('dry-run con relacionada_a: hace lookup pero NO muta BD', async () => {
    const ctxDry: ContextoEjecucion = { ...ctxBase, dry_run: true }
    const { admin, builders } = crearAdmin({
      actividades_relaciones: { data: [{ actividad_id: 'act-a' }] },
      actividades: { data: [filaActA] },
      tipos_actividad: {
        data: [{ id: 'tipo-presupuestar', etiqueta: 'Presupuestar', clave: 'presupuestar' }],
      },
      usuarios: { data: [{ id: 'user-1', nombre_completo: 'Lauro' }] },
    })
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          relacionada_a: { entidad_tipo: 'visita', entidad_id: 'visita-1' },
          si_multiple: 'mas_antigua',
        },
      },
      ctxDry,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.simulado).toBe(true)
    // Lookup hecho (read), pero NO update / NO chatter.
    expect(builders.actividades.update).not.toHaveBeenCalled()
    expect(registrarChatterMock).not.toHaveBeenCalled()
  })
})

// =============================================================
// Auto-enriquecimiento desde crear_actividad — sub-PR 20.2
// =============================================================
// Cuando el flujo crea una actividad con `crear_actividad` y el
// contexto trae entidad disparadora, el ejecutor debe upsertear una
// fila en `actividades_relaciones` (idempotente por UNIQUE).

describe('crear_actividad — auto-enriquecimiento de relación (20.2)', () => {
  const accionCrear = {
    tipo: 'crear_actividad' as const,
    tipo_actividad_id: 'tipo-presupuestar',
    titulo: 'Presupuestar',
  }

  it('inserta fila en actividades_relaciones con la entidad disparadora', async () => {
    const ctxConEntidad: ContextoEjecucion = {
      ...ctxBase,
      contexto_inicial: {
        entidad: { tipo: 'visita', id: 'visita-1', motivo: 'Presupuesto' },
      },
    }
    const { admin, builders } = crearAdmin({
      tipos_actividad: { data: { clave: 'presupuestar', etiqueta: 'Presupuestar' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
      actividades: { data: { id: 'act-nueva', titulo: 'Presupuestar' } },
      actividades_relaciones: { data: null },
    })
    const r = await ejecutarAccion(accionCrear, ctxConEntidad, admin as never)
    expect(r.ok).toBe(true)
    // Upsert con onConflict + ignoreDuplicates (C2).
    expect(builders.actividades_relaciones.upsert).toHaveBeenCalledTimes(1)
    const [fila, opciones] = builders.actividades_relaciones.upsert.mock.calls[0]
    expect(fila).toMatchObject({
      empresa_id: 'emp-1',
      actividad_id: 'act-nueva',
      entidad_tipo: 'visita',
      entidad_id: 'visita-1',
      creado_por: null,
    })
    expect(opciones).toMatchObject({
      onConflict: 'empresa_id,actividad_id,entidad_tipo,entidad_id',
      ignoreDuplicates: true,
    })
  })

  it('idempotencia: el upsert con ignoreDuplicates absorbe re-ejecuciones', async () => {
    // Simulamos que la fila ya existe — el UNIQUE de SQL la rechaza pero
    // ignoreDuplicates hace que supabase-js NO devuelva error. El handler
    // continúa OK.
    const ctxConEntidad: ContextoEjecucion = {
      ...ctxBase,
      contexto_inicial: {
        entidad: { tipo: 'visita', id: 'visita-1' },
      },
    }
    const { admin } = crearAdmin({
      tipos_actividad: { data: { clave: 'presupuestar', etiqueta: 'Presupuestar' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
      actividades: { data: { id: 'act-nueva', titulo: 'Presupuestar' } },
      actividades_relaciones: { data: null, error: null },
    })
    const r = await ejecutarAccion(accionCrear, ctxConEntidad, admin as never)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.actividad_id).toBe('act-nueva')
  })

  it('fallo del upsert NO rompe la cadena: actividad creada igual', async () => {
    // Si la BD rechaza el upsert por algún motivo (RLS, etc.), preservamos
    // la actividad creada y solo logueamos warn. Mejor degradar (perder
    // la relación) que abortar con la actividad huérfana en BD.
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const ctxConEntidad: ContextoEjecucion = {
      ...ctxBase,
      contexto_inicial: {
        entidad: { tipo: 'visita', id: 'visita-1' },
      },
    }
    const { admin } = crearAdmin({
      tipos_actividad: { data: { clave: 'presupuestar', etiqueta: 'Presupuestar' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
      actividades: { data: { id: 'act-nueva', titulo: 'Presupuestar' } },
      actividades_relaciones: {
        data: null,
        error: { message: 'rls violation', code: '42501' },
      },
    })
    const r = await ejecutarAccion(accionCrear, ctxConEntidad, admin as never)
    expect(r.ok).toBe(true) // actividad creada igual
    expect(consoleWarnSpy).toHaveBeenCalled()
    const log = consoleWarnSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(log) as Record<string, unknown>
    // Shape del warn estructurado (V1 del coordinador): contexto completo
    // para debug en producción. Si alguno se borra por error, este test
    // pinta el síntoma.
    expect(parsed.mensaje).toBe('auto_enriquecimiento_relacion_fallo')
    expect(parsed.flujo_id).toBe('flujo-1')
    expect(parsed.ejecucion_id).toBe('ej-1')
    expect(parsed.empresa_id).toBe('emp-1')
    expect(parsed.actividad_id).toBe('act-nueva')
    expect(parsed.entidad_tipo).toBe('visita')
    expect(parsed.entidad_id).toBe('visita-1')
    expect(parsed.error_message).toBe('rls violation')
    expect(parsed.error_code).toBe('42501')
    consoleWarnSpy.mockRestore()
  })

  it('cron sin entidad disparadora: NO inserta relación (skip silencioso)', async () => {
    const ctxSinEntidad: ContextoEjecucion = {
      ...ctxBase,
      contexto_inicial: { entidad: null },
    }
    const { admin, builders } = crearAdmin({
      tipos_actividad: { data: { clave: 'presupuestar', etiqueta: 'Presupuestar' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
      actividades: { data: { id: 'act-cron', titulo: 'Presupuestar' } },
    })
    const r = await ejecutarAccion(accionCrear, ctxSinEntidad, admin as never)
    expect(r.ok).toBe(true)
    expect(builders.actividades_relaciones).toBeUndefined()
  })

  it('tipo de entidad fuera del set EntidadRelacionable: NO inserta', async () => {
    // Un tipo desconocido en la entidad disparadora (ej: nuevo módulo
    // cuya entidad no se sumó a EntidadRelacionable) cae al skip
    // silencioso del helper `leerEntidadDisparadora`.
    const ctxTipoRaro: ContextoEjecucion = {
      ...ctxBase,
      contexto_inicial: {
        entidad: { tipo: 'modulo_nuevo_no_listado', id: 'x-1' },
      },
    }
    const { admin, builders } = crearAdmin({
      tipos_actividad: { data: { clave: 'presupuestar', etiqueta: 'Presupuestar' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
      actividades: { data: { id: 'act-x', titulo: 'Presupuestar' } },
    })
    const r = await ejecutarAccion(accionCrear, ctxTipoRaro, admin as never)
    expect(r.ok).toBe(true)
    expect(builders.actividades_relaciones).toBeUndefined()
  })

  it('multi-tenant: empresa_id de la fila coincide con la ejecución', async () => {
    const ctxEmpresaB: ContextoEjecucion = {
      ...ctxBase,
      empresa_id: 'emp-B',
      contexto_inicial: {
        entidad: { tipo: 'presupuesto', id: 'pres-1' },
      },
    }
    const { admin, builders } = crearAdmin({
      tipos_actividad: { data: { clave: 'seguir', etiqueta: 'Seguir' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
      actividades: { data: { id: 'act-B', titulo: 'Seguir' } },
      actividades_relaciones: { data: null },
    })
    await ejecutarAccion(accionCrear, ctxEmpresaB, admin as never)
    const [fila] = builders.actividades_relaciones.upsert.mock.calls[0]
    expect(fila.empresa_id).toBe('emp-B')
  })

  it('dry-run NO inserta en actividades_relaciones', async () => {
    const ctxDry: ContextoEjecucion = {
      ...ctxBase,
      dry_run: true,
      contexto_inicial: { entidad: { tipo: 'visita', id: 'visita-1' } },
    }
    const { admin, builders } = crearAdmin({
      tipos_actividad: { data: { clave: 'presupuestar', etiqueta: 'Presupuestar' } },
      estados_actividad: { data: { id: 'estado-pend', clave: 'pendiente' } },
    })
    const r = await ejecutarAccion(accionCrear, ctxDry, admin as never)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resultado.simulado).toBe(true)
    expect(builders.actividades_relaciones).toBeUndefined()
  })
})

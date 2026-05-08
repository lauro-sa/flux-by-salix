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

  it('falla con PendienteSubPR20_2 si solo viene relacionada_a sin tipo_actividad_id', async () => {
    const { admin } = crearAdmin({})
    const r = await ejecutarAccion(
      {
        tipo: 'completar_actividad',
        criterio: {
          si_multiple: 'mas_antigua',
          relacionada_a: { entidad_tipo: 'visita', entidad_id: 'visita-1' },
        },
      },
      ctxBase,
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.raw_class).toBe('PendienteSubPR20_2')
    }
  })
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

/**
 * Tests de `enriquecerListadoPresupuestos` — agrega resumen_pagos,
 * actividades_activas y orden_trabajo a cada fila del listado.
 *
 * Validamos:
 *   - Lista vacía → devuelve la lista vacía sin tocar Supabase.
 *   - resumen_pagos: cuotas ordenadas + suma de pagos NO-adicionales
 *     (los adicionales se ignoran).
 *   - actividades_activas: agrupa por tipo, ignora completadas y en
 *     papelera, hidrata etiqueta + color desde tipos_actividad.
 *   - orden_trabajo: si hay varias, elige la más "activa" según
 *     ESTADOS_OT_PRIORIDAD (abierta > en_curso > … > cancelada).
 *   - Si un presupuesto no tiene nada vinculado → resumen vacío,
 *     actividades=[], orden_trabajo=null.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { enriquecerListadoPresupuestos } from '../presupuestos/enriquecer-listado'

const EMPRESA = 'empresa-1'

interface BD {
  cuotas: Array<{ presupuesto_id: string; numero: number; estado_clave: string | null; estado: string | null }>
  pagos: Array<{ presupuesto_id: string; monto: number; es_adicional: boolean }>
  relaciones: Array<{ entidad_id: string; actividad_id: string }>
  actividades: Array<{ id: string; tipo_id: string | null; fecha_completada: string | null; en_papelera: boolean }>
  tipos: Array<{ id: string; etiqueta: string; color: string }>
  ordenes: Array<{ id: string; presupuesto_id: string; estado: string; en_papelera: boolean }>
}

function crearAdminMock(bd: BD) {
  const builder = (rows: unknown[]) => {
    // Cada query del helper hace .select().eq().eq()...in()...order()? y termina
    // resolviendo. Lo hacemos thenable encadenable.
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      in: () => b,
      order: () => Promise.resolve({ data: rows, error: null }),
      then: (resolve: (val: { data: unknown[]; error: null }) => void) =>
        resolve({ data: rows, error: null }),
    }
    return b
  }
  return {
    from: vi.fn((tabla: string) => {
      switch (tabla) {
        case 'presupuesto_cuotas':
          return builder(bd.cuotas)
        case 'presupuesto_pagos':
          return builder(bd.pagos)
        case 'actividades_relaciones':
          return builder(bd.relaciones)
        case 'ordenes_trabajo':
          return builder(bd.ordenes)
        case 'actividades':
          return builder(bd.actividades)
        case 'tipos_actividad':
          return builder(bd.tipos)
        default:
          throw new Error(`Tabla mock no soportada: ${tabla}`)
      }
    }),
  }
}

function bdVacia(overrides: Partial<BD> = {}): BD {
  return {
    cuotas: [],
    pagos: [],
    relaciones: [],
    actividades: [],
    tipos: [],
    ordenes: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('enriquecerListadoPresupuestos', () => {
  it('lista vacía → devuelve lista vacía sin tocar Supabase', async () => {
    const admin = { from: vi.fn() } as unknown as Parameters<typeof enriquecerListadoPresupuestos>[0]
    const res = await enriquecerListadoPresupuestos(admin, EMPRESA, [])
    expect(res).toEqual([])
    expect((admin as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled()
  })

  it('resumen_pagos: cuotas ordenadas + suma de pagos no-adicionales', async () => {
    const bd = bdVacia({
      cuotas: [
        { presupuesto_id: 'P1', numero: 1, estado_clave: 'cobrada', estado: 'cobrada' },
        { presupuesto_id: 'P1', numero: 2, estado_clave: 'pendiente', estado: 'pendiente' },
      ],
      pagos: [
        { presupuesto_id: 'P1', monto: 500, es_adicional: false },
        { presupuesto_id: 'P1', monto: 1000, es_adicional: false },
        { presupuesto_id: 'P1', monto: 9999, es_adicional: true }, // ignorado
      ],
    })
    const admin = crearAdminMock(bd) as unknown as Parameters<typeof enriquecerListadoPresupuestos>[0]

    const res = await enriquecerListadoPresupuestos(admin, EMPRESA, [{ id: 'P1' }])

    expect(res[0]).toMatchObject({
      resumen_pagos: {
        cuotas: ['cobrada', 'pendiente'],
        cantidad_pagos: 2,
        total_cobrado: 1500,
      },
    })
  })

  it('resumen_pagos: presupuesto sin cuotas ni pagos → resumen vacío', async () => {
    const admin = crearAdminMock(bdVacia()) as unknown as Parameters<typeof enriquecerListadoPresupuestos>[0]
    const res = await enriquecerListadoPresupuestos(admin, EMPRESA, [{ id: 'P-vacio' }])

    expect(res[0]).toMatchObject({
      resumen_pagos: { cuotas: [], cantidad_pagos: 0, total_cobrado: 0 },
      actividades_activas: [],
      orden_trabajo: null,
    })
  })

  it('actividades_activas: agrupa por tipo, ignora completadas y en papelera', async () => {
    const bd = bdVacia({
      relaciones: [
        { entidad_id: 'P1', actividad_id: 'A1' },
        { entidad_id: 'P1', actividad_id: 'A2' },
        { entidad_id: 'P1', actividad_id: 'A3' }, // completada → no aparece
        { entidad_id: 'P1', actividad_id: 'A4' }, // papelera   → no aparece
        { entidad_id: 'P1', actividad_id: 'A5' }, // otro tipo
      ],
      actividades: [
        { id: 'A1', tipo_id: 'T-LLAMADA', fecha_completada: null, en_papelera: false },
        { id: 'A2', tipo_id: 'T-LLAMADA', fecha_completada: null, en_papelera: false },
        { id: 'A3', tipo_id: 'T-LLAMADA', fecha_completada: '2026-01-01T00:00:00Z', en_papelera: false },
        { id: 'A4', tipo_id: 'T-LLAMADA', fecha_completada: null, en_papelera: true },
        { id: 'A5', tipo_id: 'T-VISITA',  fecha_completada: null, en_papelera: false },
      ],
      tipos: [
        { id: 'T-LLAMADA', etiqueta: 'Llamada', color: '#abcdef' },
        { id: 'T-VISITA',  etiqueta: 'Visita',  color: '#123456' },
      ],
    })
    const admin = crearAdminMock(bd) as unknown as Parameters<typeof enriquecerListadoPresupuestos>[0]

    const res = await enriquecerListadoPresupuestos(admin, EMPRESA, [{ id: 'P1' }])

    const acts = (res[0] as unknown as {
      actividades_activas: Array<{ tipo_id: string; tipo_etiqueta: string; tipo_color: string; cantidad: number }>
    }).actividades_activas
    expect(acts).toHaveLength(2)

    const llamada = acts.find(a => a.tipo_id === 'T-LLAMADA')
    expect(llamada).toMatchObject({ cantidad: 2, tipo_etiqueta: 'Llamada', tipo_color: '#abcdef' })

    const visita = acts.find(a => a.tipo_id === 'T-VISITA')
    expect(visita).toMatchObject({ cantidad: 1, tipo_etiqueta: 'Visita' })
  })

  it('orden_trabajo: si hay varias, elige la más activa (abierta > cerrada)', async () => {
    const bd = bdVacia({
      ordenes: [
        { id: 'OT-vieja',  presupuesto_id: 'P1', estado: 'cerrada',  en_papelera: false },
        { id: 'OT-activa', presupuesto_id: 'P1', estado: 'abierta',  en_papelera: false },
        { id: 'OT-curso',  presupuesto_id: 'P1', estado: 'en_curso', en_papelera: false },
      ],
    })
    const admin = crearAdminMock(bd) as unknown as Parameters<typeof enriquecerListadoPresupuestos>[0]

    const res = await enriquecerListadoPresupuestos(admin, EMPRESA, [{ id: 'P1' }])

    expect(res[0]).toMatchObject({
      orden_trabajo: { id: 'OT-activa', estado: 'abierta' },
    })
  })

  it('cuotas sin estado_clave caen al campo estado legacy', async () => {
    const bd = bdVacia({
      cuotas: [
        { presupuesto_id: 'P1', numero: 1, estado_clave: null, estado: 'parcial' },
        { presupuesto_id: 'P1', numero: 2, estado_clave: null, estado: null }, // → 'pendiente'
      ],
    })
    const admin = crearAdminMock(bd) as unknown as Parameters<typeof enriquecerListadoPresupuestos>[0]

    const res = await enriquecerListadoPresupuestos(admin, EMPRESA, [{ id: 'P1' }])

    expect((res[0] as unknown as { resumen_pagos: { cuotas: string[] } }).resumen_pagos.cuotas).toEqual([
      'parcial',
      'pendiente',
    ])
  })

  it('ignora presupuestos sin id en el array', async () => {
    const admin = crearAdminMock(bdVacia()) as unknown as Parameters<typeof enriquecerListadoPresupuestos>[0]

    const res = await enriquecerListadoPresupuestos(admin, EMPRESA, [
      { id: null },
      { /* sin id */ },
    ])

    // Sin ids válidos → devuelve la data sin enriquecer, sin tocar admin.
    expect(res).toHaveLength(2)
    expect(res[0]).not.toHaveProperty('resumen_pagos')
  })
})

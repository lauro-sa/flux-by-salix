/**
 * Enriquece el listado de presupuestos con información derivada que vive
 * en otras tablas pero que la grilla muestra inline:
 *
 *   - `resumen_pagos`: estados de las cuotas + cantidad y total de pagos
 *     no-adicionales (alimenta la columna "Pagos" del listado).
 *   - `actividades_activas`: tipos de actividad pendiente vinculados al
 *     presupuesto (chips redondos con color en la columna "Actividades").
 *   - `orden_trabajo`: id + estado de la OT generada desde el presupuesto
 *     si existe (preferimos la activa sobre las cerradas).
 *
 * Se llama tanto desde `/api/presupuestos` (refetch) como desde el SSR
 * de `(flux)/presupuestos/page.tsx` (primera carga). Antes era un
 * pass-through y la grilla mostraba "—" hasta el primer refetch
 * cliente — bug visible al hacer F5 sobre el listado.
 *
 * Diseño: una sola pasada por todos los presupuestos del listado, con
 * cuatro queries `.in('presupuesto_id', ids)` en paralelo. No hace N+1
 * queries — el costo es constante respecto al tamaño de página.
 */

import type { crearClienteAdmin } from '@/lib/supabase/admin'

type ClienteAdmin = ReturnType<typeof crearClienteAdmin>

type ResumenPagos = {
  cuotas: string[]
  cantidad_pagos: number
  total_cobrado: number
}

type ActividadActiva = {
  tipo_id: string
  tipo_etiqueta: string
  tipo_color: string
  cantidad: number
}

type OrdenTrabajoResumen = { id: string; estado: string }

interface PresupuestoBase {
  id?: string | null
  [k: string]: unknown
}

interface CuotaLite {
  presupuesto_id: string
  numero: number | null
  estado_clave: string | null
  estado: string | null
}

interface PagoLite {
  presupuesto_id: string
  monto: number | string | null
  es_adicional: boolean | null
}

interface RelacionLite {
  entidad_id: string
  actividad_id: string
}

interface ActividadLite {
  id: string
  tipo_id: string | null
  fecha_completada: string | null
  en_papelera: boolean | null
}

interface TipoActividadLite {
  id: string
  etiqueta: string | null
  color: string | null
}

interface OrdenLite {
  id: string
  presupuesto_id: string | null
  estado: string | null
  en_papelera: boolean | null
}

const ESTADOS_OT_PRIORIDAD: Record<string, number> = {
  // Más activa primero (menor número = prioridad mayor).
  abierta: 0,
  en_curso: 1,
  pendiente_cierre: 2,
  facturada: 3,
  cerrada: 4,
  cancelada: 5,
}

function prioridadOT(estado: string | null | undefined): number {
  if (!estado) return 99
  return ESTADOS_OT_PRIORIDAD[estado] ?? 50
}

export async function enriquecerListadoPresupuestos<T extends PresupuestoBase>(
  admin: ClienteAdmin,
  empresaId: string,
  data: T[],
): Promise<T[]> {
  if (!data || data.length === 0) return data

  const ids = data.map(p => p.id).filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (ids.length === 0) return data

  // ── Cargar todo en paralelo ─────────────────────────────────────────
  const [cuotasRes, pagosRes, relacionesRes, ordenesRes] = await Promise.all([
    admin
      .from('presupuesto_cuotas')
      .select('presupuesto_id, numero, estado_clave, estado')
      .eq('empresa_id', empresaId)
      .in('presupuesto_id', ids)
      .order('numero', { ascending: true }),
    admin
      .from('presupuesto_pagos')
      .select('presupuesto_id, monto, es_adicional')
      .eq('empresa_id', empresaId)
      .in('presupuesto_id', ids),
    admin
      .from('actividades_relaciones')
      .select('entidad_id, actividad_id')
      .eq('empresa_id', empresaId)
      .eq('entidad_tipo', 'presupuesto')
      .in('entidad_id', ids),
    admin
      .from('ordenes_trabajo')
      .select('id, presupuesto_id, estado, en_papelera')
      .eq('empresa_id', empresaId)
      .in('presupuesto_id', ids)
      .eq('en_papelera', false),
  ])

  const cuotas = (cuotasRes.data ?? []) as CuotaLite[]
  const pagos = (pagosRes.data ?? []) as PagoLite[]
  const relaciones = (relacionesRes.data ?? []) as RelacionLite[]
  const ordenes = (ordenesRes.data ?? []) as OrdenLite[]

  // ── 2ª pasada: hidratar actividades + tipos_actividad ───────────────
  // Las relaciones nos dan los actividad_id, ahora pedimos los detalles
  // y los tipos de actividad para mostrar etiqueta + color en los chips.
  const actividadIds = Array.from(new Set(relaciones.map(r => r.actividad_id)))
  let actividadesMap = new Map<string, ActividadLite>()
  let tiposMap = new Map<string, TipoActividadLite>()
  if (actividadIds.length > 0) {
    const { data: actividadesData } = await admin
      .from('actividades')
      .select('id, tipo_id, fecha_completada, en_papelera')
      .eq('empresa_id', empresaId)
      .in('id', actividadIds)

    const actividades = (actividadesData ?? []) as ActividadLite[]
    actividadesMap = new Map(actividades.map(a => [a.id, a]))

    const tipoIds = Array.from(
      new Set(actividades.map(a => a.tipo_id).filter((x): x is string => typeof x === 'string')),
    )
    if (tipoIds.length > 0) {
      const { data: tiposData } = await admin
        .from('tipos_actividad')
        .select('id, etiqueta, color')
        .eq('empresa_id', empresaId)
        .in('id', tipoIds)
      tiposMap = new Map(((tiposData ?? []) as TipoActividadLite[]).map(t => [t.id, t]))
    }
  }

  // ── Indexado por presupuesto_id ─────────────────────────────────────
  const cuotasPorPresup = new Map<string, CuotaLite[]>()
  for (const c of cuotas) {
    if (!c.presupuesto_id) continue
    const arr = cuotasPorPresup.get(c.presupuesto_id) ?? []
    arr.push(c)
    cuotasPorPresup.set(c.presupuesto_id, arr)
  }

  const resumenPagos = new Map<string, { cantidad_pagos: number; total_cobrado: number }>()
  for (const p of pagos) {
    if (!p.presupuesto_id) continue
    if (p.es_adicional) continue
    const acc = resumenPagos.get(p.presupuesto_id) ?? { cantidad_pagos: 0, total_cobrado: 0 }
    const monto = typeof p.monto === 'string' ? parseFloat(p.monto) : p.monto ?? 0
    acc.cantidad_pagos += 1
    acc.total_cobrado += Number.isFinite(monto) ? monto : 0
    resumenPagos.set(p.presupuesto_id, acc)
  }

  // Actividades pendientes (no completadas, no papelera) agrupadas por
  // tipo, asociadas al presupuesto vía actividades_relaciones.
  const actividadesPorPresup = new Map<string, ActividadActiva[]>()
  for (const rel of relaciones) {
    const act = actividadesMap.get(rel.actividad_id)
    if (!act) continue
    if (act.fecha_completada) continue
    if (act.en_papelera) continue
    if (!act.tipo_id) continue
    const tipo = tiposMap.get(act.tipo_id)
    if (!tipo) continue

    const lista = actividadesPorPresup.get(rel.entidad_id) ?? []
    const existente = lista.find(a => a.tipo_id === act.tipo_id)
    if (existente) {
      existente.cantidad += 1
    } else {
      lista.push({
        tipo_id: act.tipo_id,
        tipo_etiqueta: tipo.etiqueta ?? '',
        tipo_color: tipo.color ?? '',
        cantidad: 1,
      })
    }
    actividadesPorPresup.set(rel.entidad_id, lista)
  }

  // OT por presupuesto: preferir activa sobre cerrada/cancelada.
  const ordenPorPresup = new Map<string, OrdenTrabajoResumen>()
  for (const ot of ordenes) {
    if (!ot.presupuesto_id) continue
    const actual = ordenPorPresup.get(ot.presupuesto_id)
    if (!actual || prioridadOT(ot.estado) < prioridadOT(actual.estado)) {
      ordenPorPresup.set(ot.presupuesto_id, { id: ot.id, estado: ot.estado ?? '' })
    }
  }

  // ── Inyectar al resultado ───────────────────────────────────────────
  return data.map(p => {
    const id = p.id
    if (typeof id !== 'string' || !id) return p

    const cuotasPresup = cuotasPorPresup.get(id) ?? []
    // Preferimos estado_clave (id estable del estado configurable) y caemos
    // al estado text legacy si la cuota todavía no migró.
    const estadosCuotas = cuotasPresup.map(c => c.estado_clave ?? c.estado ?? 'pendiente')
    const pagosResumen = resumenPagos.get(id) ?? { cantidad_pagos: 0, total_cobrado: 0 }

    const resumen: ResumenPagos = {
      cuotas: estadosCuotas,
      cantidad_pagos: pagosResumen.cantidad_pagos,
      total_cobrado: pagosResumen.total_cobrado,
    }

    return {
      ...p,
      resumen_pagos: resumen,
      actividades_activas: actividadesPorPresup.get(id) ?? [],
      orden_trabajo: ordenPorPresup.get(id) ?? null,
    } as T
  })
}

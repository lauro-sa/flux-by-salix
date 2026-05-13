/**
 * Siembra las tareas iniciales de una OT a partir de las líneas del
 * presupuesto que la originó.
 *
 * Mapeo:
 *   - lineas_presupuesto.tipo_linea='producto'  →  tareas_orden.tipo='producto'  estado='pendiente'
 *   - lineas_presupuesto.tipo_linea='seccion'   →  tareas_orden.tipo='seccion'   estado='no_aplica'
 *   - lineas_presupuesto.tipo_linea='nota'      →  tareas_orden.tipo='nota'      estado='no_aplica'
 *   - lineas_presupuesto.tipo_linea='descuento' →  skip (no es tarea operativa y
 *                                                  rompería el CHECK tipo de tareas_orden)
 *
 * Asume que la OT recién se creó y NO tiene tareas previas: la idempotencia
 * del flujo "generar OT desde presupuesto" la maneja el caller en
 * `/api/ordenes/generar/route.ts` (devuelve 409 si la OT ya existe). Por eso
 * acá no defendemos contra re-ejecución: cada llamada inserta.
 *
 * Si la OT no tiene líneas válidas devuelve `{ agregadas: 0 }`.
 * Si Supabase falla, lanza el error — el caller decide si abortar la creación
 * de la OT (hoy NO está en try-catch, intencional: una OT sin sus tareas
 * operativas queda inconsistente).
 */

import { crearClienteAdmin } from '@/lib/supabase/admin'

interface ArgsSembrarTareasOT {
  empresaId: string
  presupuestoId: string
  ordenTrabajoId: string
  creadoPor: string
  creadoPorNombre?: string | null
}

interface ResultadoSembrarTareasOT {
  agregadas: number
}

type TipoTareaSembrada = 'producto' | 'seccion' | 'nota'

const TIPOS_TAREA_VALIDOS: ReadonlySet<TipoTareaSembrada> = new Set([
  'producto',
  'seccion',
  'nota',
])

interface LineaPresupuestoMin {
  id: string
  tipo_linea: string | null
  orden: number | null
  codigo_producto: string | null
  descripcion: string | null
  descripcion_detalle: string | null
}

export async function sembrarTareasOT(
  args: ArgsSembrarTareasOT,
): Promise<ResultadoSembrarTareasOT> {
  const { empresaId, presupuestoId, ordenTrabajoId, creadoPor, creadoPorNombre } = args
  const admin = crearClienteAdmin()

  const { data: lineas, error: errorLineas } = await admin
    .from('lineas_presupuesto')
    .select('id, tipo_linea, orden, codigo_producto, descripcion, descripcion_detalle')
    .eq('presupuesto_id', presupuestoId)
    .eq('empresa_id', empresaId)
    .order('orden', { ascending: true })

  if (errorLineas) {
    console.error('[sembrarTareasOT] Error al leer líneas del presupuesto:', errorLineas)
    throw new Error(`No se pudieron leer las líneas del presupuesto: ${errorLineas.message}`)
  }

  const lineasNormalizadas = (lineas ?? []) as LineaPresupuestoMin[]
  if (lineasNormalizadas.length === 0) {
    return { agregadas: 0 }
  }

  const filasTareas: Array<Record<string, unknown>> = []
  for (const linea of lineasNormalizadas) {
    const tipoLinea = (linea.tipo_linea ?? 'producto').toLowerCase()

    // Tipos no operativos (ej. 'descuento') o desconocidos se omiten.
    if (!TIPOS_TAREA_VALIDOS.has(tipoLinea as TipoTareaSembrada)) {
      if (tipoLinea !== 'descuento') {
        console.warn(
          `[sembrarTareasOT] Tipo de línea desconocido "${tipoLinea}" (linea ${linea.id}) — omitida`,
        )
      }
      continue
    }

    const tipoTarea = tipoLinea as TipoTareaSembrada
    const esCompletable = tipoTarea === 'producto'
    const tituloDirecto = linea.descripcion?.trim()
    const titulo = tituloDirecto && tituloDirecto.length > 0 ? tituloDirecto : '(sin título)'

    filasTareas.push({
      empresa_id: empresaId,
      orden_trabajo_id: ordenTrabajoId,
      tipo: tipoTarea,
      titulo,
      descripcion_detalle: linea.descripcion_detalle ?? null,
      codigo_producto: linea.codigo_producto ?? null,
      origen_linea_id: linea.id,
      estado: esCompletable ? 'pendiente' : 'no_aplica',
      prioridad: 'normal',
      orden: linea.orden ?? 0,
      creado_por: creadoPor,
      creado_por_nombre: creadoPorNombre ?? null,
    })
  }

  if (filasTareas.length === 0) {
    return { agregadas: 0 }
  }

  const { error: errorInsert } = await admin.from('tareas_orden').insert(filasTareas)
  if (errorInsert) {
    console.error('[sembrarTareasOT] Error al insertar tareas:', errorInsert)
    throw new Error(`No se pudieron sembrar las tareas de la OT: ${errorInsert.message}`)
  }

  return { agregadas: filasTareas.length }
}

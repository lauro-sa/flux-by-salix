/**
 * Ejecutor: consultar_actividades
 * Consulta actividades pendientes, vencidas o completadas.
 * Respeta visibilidad ver_propio vs ver_todos.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'
import { cargarVinculosPorActividad } from '@/lib/actividades-relaciones-helpers'

export async function ejecutarConsultarActividades(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const visibilidad = determinarVisibilidad(ctx.miembro, 'actividades')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver actividades' }
  }

  const estado = (params.estado as string) || 'pendiente'
  const limite = Math.min((params.limite as number) || 20, 50)

  // Búsqueda por texto: union de matches en `actividades.titulo` y
  // `actividades_relaciones.entidad_nombre` (reemplaza el ilike sobre
  // `vinculos::text` legacy).
  let actIdsFromBusqueda: string[] | null = null
  if (params.busqueda) {
    const busq = params.busqueda as string
    const [titRes, vincRes] = await Promise.all([
      ctx.admin
        .from('actividades')
        .select('id')
        .eq('empresa_id', ctx.empresa_id)
        .eq('en_papelera', false)
        .ilike('titulo', `%${busq}%`),
      ctx.admin
        .from('actividades_relaciones')
        .select('actividad_id')
        .eq('empresa_id', ctx.empresa_id)
        .ilike('entidad_nombre', `%${busq}%`),
    ])
    const idsTit = (titRes.data || []).map((a: { id: string }) => a.id)
    const idsVinc = (vincRes.data || []).map((r: { actividad_id: string }) => r.actividad_id)
    actIdsFromBusqueda = [...new Set([...idsTit, ...idsVinc])]
    if (actIdsFromBusqueda.length === 0) {
      return { exito: true, datos: [], mensaje_usuario: 'No hay actividades que coincidan con la búsqueda.' }
    }
  }

  let query = ctx.admin
    .from('actividades')
    .select('id, titulo, descripcion, tipo_clave, estado_clave, prioridad, fecha_vencimiento, asignados, creado_en')
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .limit(limite)

  if (actIdsFromBusqueda !== null) {
    query = query.in('id', actIdsFromBusqueda)
  }

  // Filtrar por estado
  if (estado !== 'todas' && !params.busqueda) {
    query = query.eq('estado_clave', estado)
  }

  // Filtrar por tipo
  if (params.tipo_clave) {
    query = query.eq('tipo_clave', params.tipo_clave)
  }

  // Filtrar por fechas
  if (params.fecha_desde) {
    query = query.gte('fecha_vencimiento', `${params.fecha_desde}T00:00:00`)
  }
  if (params.fecha_hasta) {
    query = query.lte('fecha_vencimiento', `${params.fecha_hasta}T23:59:59`)
  }

  // Filtrar por asignado
  if (visibilidad === 'propio') {
    query = query.contains('asignados_ids', [ctx.usuario_id])
  } else if (params.asignado_a_id) {
    query = query.contains('asignados_ids', [params.asignado_a_id])
  }

  const { data, error } = await query

  if (error) {
    return { exito: false, error: `Error consultando actividades: ${error.message}` }
  }

  // Cargar vínculos del set resultante para extraer contacto / presupuesto
  // vinculado en el shape de la respuesta.
  const filas = (data || []) as Array<Record<string, unknown>>
  const ids = filas.map((a) => a.id as string)
  const mapaVinculos = await cargarVinculosPorActividad(ctx.admin, ctx.empresa_id, ids)

  const actividades = filas.map((a) => {
    const vencimiento = a.fecha_vencimiento as string | null
    const estaVencida = !!vencimiento && new Date(vencimiento) < new Date() && a.estado_clave === 'pendiente'

    // Extraer nombres de asignados
    const asignadosList = a.asignados as { id: string; nombre: string }[] | null
    const nombresAsignados = asignadosList?.map(x => x.nombre).join(', ') || null

    const vinculos = mapaVinculos.get(a.id as string) ?? []

    return {
      id: a.id,
      titulo: a.titulo,
      tipo: a.tipo_clave,
      estado: a.estado_clave,
      prioridad: a.prioridad,
      fecha_vencimiento: vencimiento,
      vencida: estaVencida,
      asignado_a: nombresAsignados,
      contacto_vinculado: vinculos.find((v) => v.tipo === 'contacto')?.nombre || null,
      presupuesto_vinculado: vinculos.find((v) => v.tipo === 'presupuesto')?.nombre || null,
    }
  })

  const vencidas = actividades.filter((a: { vencida: boolean }) => a.vencida).length

  return {
    exito: true,
    datos: actividades,
    mensaje_usuario: actividades.length === 0
      ? `No hay actividades ${estado === 'todas' ? '' : estado + 's'}.`
      : `${actividades.length} actividad(es)${vencidas > 0 ? ` (${vencidas} vencida${vencidas > 1 ? 's' : ''})` : ''}.`,
  }
}

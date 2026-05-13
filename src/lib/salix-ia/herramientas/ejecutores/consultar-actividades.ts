/**
 * Ejecutor: consultar_actividades
 * Consulta actividades pendientes, vencidas o completadas.
 * Respeta visibilidad ver_propio vs ver_todos.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

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
  // Filtro adicional por vencimiento. Independiente del estado para poder pedir:
  //   estado=pendiente + filtro_vencimiento=vencidas     → pendientes ya vencidas
  //   estado=pendiente + filtro_vencimiento=no_vencidas  → pendientes todavía a tiempo
  //   estado=pendiente + filtro_vencimiento=sin_fecha    → pendientes sin fecha de vencimiento
  const filtroVencimiento = (params.filtro_vencimiento as string) || 'todas'

  let query = ctx.admin
    .from('actividades')
    .select('id, titulo, descripcion, tipo_clave, estado_clave, prioridad, fecha_vencimiento, asignados, vinculos, creado_en')
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .limit(limite)

  // Aplicar filtro_vencimiento a nivel query para no traer registros que vamos
  // a descartar después. Usamos el timestamp ahora como corte.
  const ahoraISO = new Date().toISOString()
  if (filtroVencimiento === 'vencidas') {
    query = query.lt('fecha_vencimiento', ahoraISO)
  } else if (filtroVencimiento === 'no_vencidas') {
    // Incluye las que tienen fecha futura. Las "sin fecha" quedan afuera; si
    // el usuario las quiere, debe pedir explícitamente filtro_vencimiento=todas
    // o filtro_vencimiento=sin_fecha.
    query = query.gte('fecha_vencimiento', ahoraISO)
  } else if (filtroVencimiento === 'sin_fecha') {
    query = query.is('fecha_vencimiento', null)
  }

  // Buscar por texto en título o vinculado
  if (params.busqueda) {
    const busq = params.busqueda as string
    query = query.or(`titulo.ilike.%${busq}%,vinculos::text.ilike.%${busq}%`)
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

  const actividades = (data || []).map((a: Record<string, unknown>) => {
    const vencimiento = a.fecha_vencimiento as string | null
    const estaVencida = vencimiento && new Date(vencimiento) < new Date() && a.estado_clave === 'pendiente'

    // Extraer nombres de asignados
    const asignadosList = a.asignados as { id: string; nombre: string }[] | null
    const nombresAsignados = asignadosList?.map(x => x.nombre).join(', ') || null

    return {
      id: a.id,
      titulo: a.titulo,
      descripcion: (a.descripcion as string) || null,
      tipo: a.tipo_clave,
      estado: a.estado_clave,
      prioridad: a.prioridad,
      fecha_vencimiento: vencimiento,
      vencida: estaVencida,
      asignado_a: nombresAsignados,
      contacto_vinculado: (a.vinculos as { tipo: string; nombre: string }[] | null)
        ?.find((v) => v.tipo === 'contacto')?.nombre || null,
      presupuesto_vinculado: (a.vinculos as { tipo: string; nombre: string }[] | null)
        ?.find((v) => v.tipo === 'presupuesto')?.nombre || null,
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

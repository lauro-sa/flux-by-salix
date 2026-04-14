/**
 * Ejecutor: consultar_visitas
 * Consulta visitas programadas, completadas o canceladas.
 * Respeta visibilidad ver_propio vs ver_todos.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

export async function ejecutarConsultarVisitas(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const visibilidad = determinarVisibilidad(ctx.miembro, 'visitas')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver visitas' }
  }

  const estado = (params.estado as string) || 'programada'
  const limite = Math.min((params.limite as number) || 20, 50)

  let query = ctx.admin
    .from('visitas')
    .select('id, contacto_nombre, direccion_texto, asignado_nombre, fecha_programada, fecha_completada, estado, motivo, prioridad, duracion_estimada_min')
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .order('fecha_programada', { ascending: true })
    .limit(limite)

  // Filtrar por estado
  if (estado !== 'todas') {
    query = query.eq('estado', estado)
  }

  // Filtrar por fechas
  if (params.fecha_desde) {
    query = query.gte('fecha_programada', `${params.fecha_desde}T00:00:00`)
  }
  if (params.fecha_hasta) {
    query = query.lte('fecha_programada', `${params.fecha_hasta}T23:59:59`)
  }

  // Filtrar por asignado
  if (visibilidad === 'propio') {
    query = query.eq('asignado_a', ctx.usuario_id)
  } else if (params.asignado_a_id) {
    query = query.eq('asignado_a', params.asignado_a_id)
  }

  const { data, error } = await query

  if (error) {
    return { exito: false, error: `Error consultando visitas: ${error.message}` }
  }

  const visitas = (data || []).map((v: Record<string, unknown>) => ({
    id: v.id,
    contacto: v.contacto_nombre,
    direccion: v.direccion_texto || null,
    asignado: v.asignado_nombre,
    fecha: v.fecha_programada,
    estado: v.estado,
    motivo: v.motivo || null,
    prioridad: v.prioridad,
    duracion_min: v.duracion_estimada_min,
  }))

  return {
    exito: true,
    datos: visitas,
    mensaje_usuario: visitas.length === 0
      ? `No hay visitas ${estado === 'todas' ? '' : estado + 's'}.`
      : `${visitas.length} visita(s) encontrada(s).`,
  }
}

/**
 * Ejecutor: consultar_calendario
 * Consulta eventos del calendario para una fecha o rango.
 * Respeta visibilidad ver_propio vs ver_todos.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

export async function ejecutarConsultarCalendario(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const visibilidad = determinarVisibilidad(ctx.miembro, 'calendario')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver el calendario' }
  }

  const fechaInicio = (params.fecha_inicio as string) || new Date().toISOString().split('T')[0]
  const fechaFin = (params.fecha_fin as string) || fechaInicio

  // Construir rango de búsqueda (inicio del día → fin del día)
  const inicio = `${fechaInicio}T00:00:00`
  const fin = `${fechaFin}T23:59:59`

  let query = ctx.admin
    .from('eventos_calendario')
    .select('id, titulo, descripcion, ubicacion, tipo_clave, color, fecha_inicio, fecha_fin, todo_el_dia, estado, asignados, creado_por_nombre')
    .eq('empresa_id', ctx.empresa_id)
    .lte('fecha_inicio', fin)
    .gte('fecha_fin', inicio)
    .order('fecha_inicio', { ascending: true })
    .limit(50)

  // Filtrar por usuario si ver_propio
  if (visibilidad === 'propio') {
    query = query.contains('asignado_ids', [ctx.usuario_id])
  } else if (params.usuario_id) {
    query = query.contains('asignado_ids', [params.usuario_id])
  }

  const { data, error } = await query

  if (error) {
    return { exito: false, error: `Error consultando calendario: ${error.message}` }
  }

  const eventos = (data || []).map((e: Record<string, unknown>) => ({
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion || null,
    ubicacion: e.ubicacion || null,
    tipo: e.tipo_clave,
    fecha_inicio: e.fecha_inicio,
    fecha_fin: e.fecha_fin,
    todo_el_dia: e.todo_el_dia,
    estado: e.estado,
  }))

  return {
    exito: true,
    datos: eventos,
    mensaje_usuario: eventos.length === 0
      ? `No hay eventos en el calendario para ${fechaInicio === fechaFin ? fechaInicio : `${fechaInicio} a ${fechaFin}`}.`
      : `${eventos.length} evento(s) encontrado(s).`,
  }
}

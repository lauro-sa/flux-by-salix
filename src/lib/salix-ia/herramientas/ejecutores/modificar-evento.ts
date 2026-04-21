/**
 * Ejecutor: modificar_evento
 * Modifica o cancela un evento del calendario.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarModificarEvento(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const evento_id = params.evento_id as string
  if (!evento_id) {
    return { exito: false, error: 'Se requiere el ID del evento' }
  }

  const { data: evento, error: errorBusca } = await ctx.admin
    .from('eventos_calendario')
    .select('id, titulo, estado, fecha_inicio, fecha_fin')
    .eq('id', evento_id)
    .eq('empresa_id', ctx.empresa_id)
    .single()

  if (errorBusca || !evento) {
    return { exito: false, error: 'Evento no encontrado' }
  }

  const cambios: Record<string, unknown> = {}
  const descripcionCambios: string[] = []

  // Cambiar estado (cancelar/confirmar)
  if (params.estado) {
    cambios.estado = params.estado
    descripcionCambios.push(`estado → ${params.estado}`)
  }

  // Cambiar fecha
  if (params.fecha_inicio) {
    cambios.fecha_inicio = params.fecha_inicio
    descripcionCambios.push(`fecha → ${new Date(params.fecha_inicio as string).toLocaleDateString('es', { timeZone: ctx.zona_horaria || 'America/Argentina/Buenos_Aires' })}`)
  }
  if (params.fecha_fin) {
    cambios.fecha_fin = params.fecha_fin
  }

  // Cambiar título
  if (params.titulo) {
    cambios.titulo = params.titulo
    descripcionCambios.push(`título → ${params.titulo}`)
  }

  // Eliminar evento (mover a cancelado, no borrar)
  if (params.eliminar === true) {
    cambios.estado = 'cancelado'
    descripcionCambios.push('cancelado')
  }

  if (Object.keys(cambios).length === 0) {
    return { exito: false, error: 'No se indicaron cambios para realizar' }
  }

  cambios.editado_por = ctx.usuario_id
  cambios.actualizado_en = new Date().toISOString()

  const { error } = await ctx.admin
    .from('eventos_calendario')
    .update(cambios)
    .eq('id', evento_id)

  if (error) {
    return { exito: false, error: `Error modificando evento: ${error.message}` }
  }

  return {
    exito: true,
    datos: { id: evento_id, cambios: descripcionCambios },
    mensaje_usuario: `Evento "${evento.titulo}" actualizado: ${descripcionCambios.join(', ')}.`,
  }
}

/**
 * Ejecutor: crear_recordatorio
 * Crea un evento de tipo recordatorio en el calendario con su alerta.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarCrearRecordatorio(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const titulo = (params.titulo as string)?.trim()
  const fecha = params.fecha as string

  if (!titulo || !fecha) {
    return { exito: false, error: 'Se requieren título y fecha para el recordatorio' }
  }

  // Buscar tipo de evento "recordatorio"
  const { data: tipos } = await ctx.admin
    .from('tipos_evento_calendario')
    .select('id, clave')
    .eq('empresa_id', ctx.empresa_id)

  const tipoRecordatorio = tipos?.find((t: { clave: string }) => t.clave === 'recordatorio')
    || tipos?.[0]

  if (!tipoRecordatorio) {
    return { exito: false, error: 'No hay tipos de evento configurados en la empresa. Contactá al administrador.' }
  }

  // Crear el evento en el calendario
  const fechaInicio = new Date(fecha)
  const fechaFin = new Date(fechaInicio.getTime() + 30 * 60 * 1000) // 30 min por defecto

  const { data: evento, error: errorEvento } = await ctx.admin
    .from('eventos_calendario')
    .insert({
      empresa_id: ctx.empresa_id,
      titulo,
      descripcion: (params.descripcion as string)?.trim() || '',
      tipo_id: tipoRecordatorio?.id || null,
      tipo_clave: tipoRecordatorio?.clave || 'recordatorio',
      fecha_inicio: fechaInicio.toISOString(),
      fecha_fin: fechaFin.toISOString(),
      todo_el_dia: false,
      creado_por: ctx.usuario_id,
      creado_por_nombre: ctx.nombre_usuario,
      asignados: [{ id: ctx.usuario_id, nombre: ctx.nombre_usuario }],
      asignado_ids: [ctx.usuario_id],
      estado: 'confirmado',
    })
    .select('id, titulo, descripcion, fecha_inicio, fecha_fin, tipo_clave, estado')
    .single()

  if (errorEvento) {
    return { exito: false, error: `Error creando recordatorio: ${errorEvento.message}` }
  }

  // Crear la alerta/recordatorio
  const minutosAntes = (params.minutos_antes as number) ?? 15

  await ctx.admin
    .from('recordatorios_calendario')
    .insert({
      empresa_id: ctx.empresa_id,
      evento_id: evento.id,
      usuario_id: ctx.usuario_id,
      minutos_antes: minutosAntes,
      tipo: 'notificacion',
    })

  const fechaFormateada = fechaInicio.toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  return {
    exito: true,
    datos: evento,
    mensaje_usuario: `Recordatorio "${titulo}" creado para ${fechaFormateada}. Te avisaré ${minutosAntes} minutos antes.`,
  }
}

/**
 * Ejecutor: crear_recordatorio
 * Crea un recordatorio personal con soporte de recurrencia.
 * Usa la tabla 'recordatorios' (no eventos_calendario) para aprovechar:
 * - Recurrencia (diario, semanal, mensual, anual)
 * - Notificaciones in-app + push + WhatsApp
 * - Alerta modal vs campana
 *
 * También crea un evento en el calendario para que sea visible ahí.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarCrearRecordatorio(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const titulo = (params.titulo as string)?.trim()
  const fechaParam = params.fecha as string

  if (!titulo || !fechaParam) {
    return { exito: false, error: 'Se requieren título y fecha para el recordatorio' }
  }

  // Extraer fecha y hora del ISO string
  const fechaObj = new Date(fechaParam)
  const fechaISO = fechaObj.toISOString().split('T')[0] // YYYY-MM-DD
  // Hora en formato HH:MM (UTC para consistencia con el cron)
  const horaUTC = `${String(fechaObj.getUTCHours()).padStart(2, '0')}:${String(fechaObj.getUTCMinutes()).padStart(2, '0')}`

  // Determinar recurrencia
  const repetir = (params.repetir as string) || 'ninguno'
  const repetirValidos = ['ninguno', 'diario', 'semanal', 'mensual', 'anual']
  if (!repetirValidos.includes(repetir)) {
    return { exito: false, error: `Tipo de repetición "${repetir}" no válido. Opciones: ${repetirValidos.join(', ')}` }
  }

  // Crear recordatorio en la tabla de recordatorios (con recurrencia)
  const { data: recordatorio, error: errorRecordatorio } = await ctx.admin
    .from('recordatorios')
    .insert({
      empresa_id: ctx.empresa_id,
      creado_por: ctx.usuario_id,
      asignado_a: ctx.usuario_id,
      titulo,
      descripcion: (params.descripcion as string)?.trim() || null,
      fecha: fechaISO,
      hora: horaUTC,
      repetir,
      alerta_modal: true,
      notificar_whatsapp: params.notificar_whatsapp !== false, // default: true
      completado: false,
    })
    .select('id, titulo, fecha, hora, repetir')
    .single()

  if (errorRecordatorio) {
    return { exito: false, error: `Error creando recordatorio: ${errorRecordatorio.message}` }
  }

  // También crear evento en el calendario para que aparezca visualmente
  const fechaFin = new Date(fechaObj.getTime() + 30 * 60 * 1000) // 30 min

  const { data: tipos } = await ctx.admin
    .from('tipos_evento_calendario')
    .select('id, clave')
    .eq('empresa_id', ctx.empresa_id)

  const tipoRecordatorio = tipos?.find((t: { clave: string }) => t.clave === 'recordatorio')
    || tipos?.[0]

  if (tipoRecordatorio) {
    await ctx.admin
      .from('eventos_calendario')
      .insert({
        empresa_id: ctx.empresa_id,
        titulo: `🔔 ${titulo}`,
        descripcion: (params.descripcion as string)?.trim() || '',
        tipo_id: tipoRecordatorio.id,
        tipo_clave: tipoRecordatorio.clave,
        fecha_inicio: fechaObj.toISOString(),
        fecha_fin: fechaFin.toISOString(),
        todo_el_dia: false,
        creado_por: ctx.usuario_id,
        creado_por_nombre: ctx.nombre_usuario,
        asignados: [{ id: ctx.usuario_id, nombre: ctx.nombre_usuario }],
        asignado_ids: [ctx.usuario_id],
        estado: 'confirmado',
      })
  }

  // Formatear respuesta
  const fechaFormateada = fechaObj.toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  const repetirTexto: Record<string, string> = {
    ninguno: '',
    diario: ' (se repite cada día)',
    semanal: ' (se repite cada semana)',
    mensual: ' (se repite cada mes)',
    anual: ' (se repite cada año)',
  }

  const canales: string[] = ['notificación in-app', 'push']
  if (params.notificar_whatsapp !== false) canales.push('WhatsApp')

  return {
    exito: true,
    datos: recordatorio,
    mensaje_usuario: `🔔 Recordatorio "${titulo}" creado para ${fechaFormateada}${repetirTexto[repetir]}.\nTe aviso por: ${canales.join(' + ')}.`,
  }
}

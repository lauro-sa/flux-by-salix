/**
 * Ejecutor: modificar_visita
 * Modifica una visita: cambiar estado, reprogramar, reasignar.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

const ESTADOS_VISITA = ['programada', 'en_camino', 'en_sitio', 'completada', 'cancelada', 'reprogramada']

export async function ejecutarModificarVisita(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const visita_id = params.visita_id as string
  if (!visita_id) {
    return { exito: false, error: 'Se requiere el ID de la visita' }
  }

  const { data: visita, error: errorBusca } = await ctx.admin
    .from('visitas')
    .select('id, contacto_nombre, estado, fecha_programada')
    .eq('id', visita_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .single()

  if (errorBusca || !visita) {
    return { exito: false, error: 'Visita no encontrada' }
  }

  const cambios: Record<string, unknown> = {}
  const descripcionCambios: string[] = []

  // Cambiar estado
  if (params.estado) {
    const nuevoEstado = params.estado as string
    if (!ESTADOS_VISITA.includes(nuevoEstado)) {
      return { exito: false, error: `Estado "${nuevoEstado}" no válido. Disponibles: ${ESTADOS_VISITA.join(', ')}` }
    }
    cambios.estado = nuevoEstado
    descripcionCambios.push(`estado → ${nuevoEstado}`)

    if (nuevoEstado === 'completada') {
      cambios.fecha_completada = new Date().toISOString()
    }
  }

  // Reprogramar
  if (params.fecha_programada) {
    cambios.fecha_programada = params.fecha_programada
    descripcionCambios.push(`reprogramada → ${new Date(params.fecha_programada as string).toLocaleDateString('es', { timeZone: ctx.zona_horaria || 'America/Argentina/Buenos_Aires' })}`)
  }

  // Cambiar notas/resultado
  if (params.notas !== undefined) {
    cambios.notas = params.notas
    descripcionCambios.push('notas actualizadas')
  }
  if (params.resultado !== undefined) {
    cambios.resultado = params.resultado
    descripcionCambios.push('resultado registrado')
  }

  if (Object.keys(cambios).length === 0) {
    return { exito: false, error: 'No se indicaron cambios para realizar' }
  }

  cambios.actualizado_en = new Date().toISOString()
  cambios.editado_por = ctx.usuario_id

  const { error } = await ctx.admin
    .from('visitas')
    .update(cambios)
    .eq('id', visita_id)

  if (error) {
    return { exito: false, error: `Error modificando visita: ${error.message}` }
  }

  return {
    exito: true,
    datos: { id: visita_id, cambios: descripcionCambios },
    mensaje_usuario: `Visita a ${visita.contacto_nombre} actualizada: ${descripcionCambios.join(', ')}.`,
  }
}

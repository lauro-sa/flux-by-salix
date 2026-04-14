/**
 * Ejecutor: modificar_actividad
 * Modifica una actividad existente: cambiar estado, fecha, prioridad, asignado.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarModificarActividad(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const actividad_id = params.actividad_id as string
  if (!actividad_id) {
    return { exito: false, error: 'Se requiere el ID de la actividad' }
  }

  // Verificar que la actividad existe y pertenece a la empresa
  const { data: actividad, error: errorBusca } = await ctx.admin
    .from('actividades')
    .select('id, titulo, estado_clave, tipo_clave, asignados')
    .eq('id', actividad_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .single()

  if (errorBusca || !actividad) {
    return { exito: false, error: 'Actividad no encontrada' }
  }

  const cambios: Record<string, unknown> = {}
  const descripcionCambios: string[] = []

  // Cambiar estado
  if (params.estado_clave) {
    const { data: estado } = await ctx.admin
      .from('estados_actividad')
      .select('id, clave, etiqueta')
      .eq('empresa_id', ctx.empresa_id)
      .eq('clave', params.estado_clave)
      .eq('activo', true)
      .single()

    if (!estado) {
      // Listar estados disponibles para ayudar
      const { data: estados } = await ctx.admin
        .from('estados_actividad')
        .select('clave, etiqueta')
        .eq('empresa_id', ctx.empresa_id)
        .eq('activo', true)

      const disponibles = (estados || []).map((e: { etiqueta: string; clave: string }) => `${e.etiqueta} (${e.clave})`).join(', ')
      return { exito: false, error: `Estado "${params.estado_clave}" no encontrado. Disponibles: ${disponibles}` }
    }

    cambios.estado_id = estado.id
    cambios.estado_clave = estado.clave
    descripcionCambios.push(`estado → ${estado.etiqueta}`)

    // Si se completa, registrar fecha
    if (estado.clave === 'completada') {
      cambios.fecha_completada = new Date().toISOString()
    }
  }

  // Cambiar prioridad
  if (params.prioridad) {
    cambios.prioridad = params.prioridad
    descripcionCambios.push(`prioridad → ${params.prioridad}`)
  }

  // Cambiar fecha de vencimiento
  if (params.fecha_vencimiento) {
    cambios.fecha_vencimiento = params.fecha_vencimiento
    descripcionCambios.push(`fecha → ${new Date(params.fecha_vencimiento as string).toLocaleDateString('es')}`)
  }

  // Reasignar
  if (params.asignado_a_id) {
    const { data: perfil } = await ctx.admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', params.asignado_a_id)
      .single()

    if (perfil) {
      const nombre = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ')
      cambios.asignados = [{ id: params.asignado_a_id, nombre }]
      cambios.asignados_ids = [params.asignado_a_id]
      descripcionCambios.push(`asignado → ${nombre}`)
    }
  }

  if (Object.keys(cambios).length === 0) {
    return { exito: false, error: 'No se indicaron cambios para realizar' }
  }

  cambios.editado_por = ctx.usuario_id
  cambios.actualizado_en = new Date().toISOString()

  const { error } = await ctx.admin
    .from('actividades')
    .update(cambios)
    .eq('id', actividad_id)

  if (error) {
    return { exito: false, error: `Error modificando actividad: ${error.message}` }
  }

  return {
    exito: true,
    datos: { id: actividad_id, cambios: descripcionCambios },
    mensaje_usuario: `Actividad "${actividad.titulo}" actualizada: ${descripcionCambios.join(', ')}.`,
  }
}

/**
 * Ejecutor: crear_visita
 * Agenda una visita a un contacto.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarCrearVisita(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const contacto_id = params.contacto_id as string
  const fecha_programada = params.fecha_programada as string

  if (!contacto_id || !fecha_programada) {
    return { exito: false, error: 'Se requieren contacto_id y fecha_programada' }
  }

  // Obtener datos del contacto
  const { data: contacto, error: errorContacto } = await ctx.admin
    .from('contactos')
    .select('id, nombre, apellido')
    .eq('id', contacto_id)
    .eq('empresa_id', ctx.empresa_id)
    .single()

  if (errorContacto || !contacto) {
    return { exito: false, error: 'Contacto no encontrado' }
  }

  const contactoNombre = [contacto.nombre, contacto.apellido].filter(Boolean).join(' ')

  // Obtener dirección principal del contacto si existe
  const { data: direccion } = await ctx.admin
    .from('contacto_direcciones')
    .select('id, direccion, localidad, provincia, latitud, longitud')
    .eq('contacto_id', contacto_id)
    .eq('tipo', 'principal')
    .limit(1)
    .single()

  const { data: visita, error } = await ctx.admin
    .from('visitas')
    .insert({
      empresa_id: ctx.empresa_id,
      contacto_id,
      contacto_nombre: contactoNombre,
      direccion_id: direccion?.id || null,
      direccion_texto: direccion ? [direccion.direccion, direccion.localidad, direccion.provincia].filter(Boolean).join(', ') : null,
      direccion_lat: direccion?.latitud || null,
      direccion_lng: direccion?.longitud || null,
      asignado_a: ctx.usuario_id,
      asignado_nombre: ctx.nombre_usuario,
      fecha_programada,
      estado: 'programada',
      motivo: (params.motivo as string)?.trim() || '',
      notas: (params.notas as string)?.trim() || '',
      prioridad: (params.prioridad as string) || 'normal',
      duracion_estimada_min: (params.duracion_estimada_min as number) || 60,
      creado_por: ctx.usuario_id,
    })
    .select('id, contacto_nombre, fecha_programada, estado')
    .single()

  if (error) {
    return { exito: false, error: `Error creando visita: ${error.message}` }
  }

  const fechaFormateada = new Date(fecha_programada).toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  let mensaje = `Visita a ${contactoNombre} programada para ${fechaFormateada}.`
  if (!direccion) {
    mensaje += '\n⚠ _El contacto no tiene dirección registrada. Podés agregarla desde su ficha._'
  }

  return {
    exito: true,
    datos: visita,
    mensaje_usuario: mensaje,
  }
}

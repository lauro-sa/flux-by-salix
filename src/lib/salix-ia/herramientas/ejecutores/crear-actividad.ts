/**
 * Ejecutor: crear_actividad
 * Crea una nueva actividad usando los tipos existentes de la empresa.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { insertarVinculosActividad, type VinculoLegacy } from '@/lib/actividades-relaciones-helpers'

export async function ejecutarCrearActividad(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const titulo = (params.titulo as string)?.trim()
  if (!titulo) {
    return { exito: false, error: 'Se requiere un título para la actividad' }
  }

  // Buscar tipo de actividad
  const tipoClave = (params.tipo_clave as string)?.trim()?.toLowerCase() || 'tarea'

  // Si piden crear actividad de tipo "visita", redirigir a crear_visita
  if (tipoClave === 'visita') {
    return {
      exito: false,
      error: 'Para crear una visita usá la herramienta crear_visita en vez de crear_actividad. Eso crea la visita con su actividad y evento de calendario vinculados.',
    }
  }

  const { data: tipos } = await ctx.admin
    .from('tipos_actividad')
    .select('id, clave, etiqueta')
    .eq('empresa_id', ctx.empresa_id)
    .eq('activo', true)

  const tipoEncontrado = tipos?.find((t: { clave: string }) =>
    t.clave === tipoClave
  )

  if (!tipoEncontrado) {
    const tiposDisponibles = (tipos || []).map((t: { clave: string; etiqueta: string }) => t.etiqueta).join(', ')
    return {
      exito: false,
      error: `No encontré el tipo de actividad "${tipoClave}". Tipos disponibles: ${tiposDisponibles}`,
    }
  }

  // Buscar estado pendiente por defecto
  const { data: estados } = await ctx.admin
    .from('estados_actividad')
    .select('id, clave')
    .eq('empresa_id', ctx.empresa_id)
    .eq('activo', true)

  const estadoPendiente = estados?.find((e: { clave: string }) =>
    e.clave === 'pendiente'
  ) || estados?.[0]

  if (!estadoPendiente) {
    return { exito: false, error: 'No se encontró un estado de actividad configurado' }
  }

  // Obtener datos del asignado
  const asignadoId = (params.asignado_a_id as string) || ctx.usuario_id
  const { data: perfilAsignado } = await ctx.admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', asignadoId)
    .single()

  const nombreAsignado = perfilAsignado
    ? [perfilAsignado.nombre, perfilAsignado.apellido].filter(Boolean).join(' ')
    : ctx.nombre_usuario

  // Construir vínculos si hay contacto_id o presupuesto_id. Los insertamos
  // en actividades_relaciones después del INSERT principal.
  const vinculos: VinculoLegacy[] = []

  if (params.contacto_id) {
    const { data: contacto } = await ctx.admin
      .from('contactos')
      .select('id, nombre, apellido')
      .eq('id', params.contacto_id)
      .eq('empresa_id', ctx.empresa_id)
      .single()

    if (contacto) {
      vinculos.push({
        tipo: 'contacto',
        id: contacto.id,
        nombre: [contacto.nombre, contacto.apellido].filter(Boolean).join(' '),
      })
    }
  }

  // Vincular presupuesto si se indica
  if (params.presupuesto_id) {
    const { data: presupuesto } = await ctx.admin
      .from('presupuestos')
      .select('id, numero, contacto_nombre, contacto_apellido')
      .eq('id', params.presupuesto_id)
      .eq('empresa_id', ctx.empresa_id)
      .single()

    if (presupuesto) {
      vinculos.push({
        tipo: 'presupuesto',
        id: presupuesto.id,
        nombre: `${presupuesto.numero} — ${[presupuesto.contacto_nombre, presupuesto.contacto_apellido].filter(Boolean).join(' ')}`,
      })
    }
  }

  const { data, error } = await ctx.admin
    .from('actividades')
    .insert({
      empresa_id: ctx.empresa_id,
      titulo,
      descripcion: (params.descripcion as string)?.trim() || '',
      tipo_id: tipoEncontrado.id,
      tipo_clave: tipoEncontrado.clave,
      estado_id: estadoPendiente.id,
      estado_clave: estadoPendiente.clave,
      prioridad: (params.prioridad as string) || 'normal',
      fecha_vencimiento: (params.fecha_vencimiento as string) || null,
      asignados: [{ id: asignadoId, nombre: nombreAsignado }],
      asignados_ids: [asignadoId],
      creado_por: ctx.usuario_id,
      creado_por_nombre: ctx.nombre_usuario,
    })
    .select('id, titulo, tipo_clave, estado_clave, prioridad, fecha_vencimiento')
    .single()

  if (error) {
    return { exito: false, error: `Error creando actividad: ${error.message}` }
  }

  // Registrar vínculos en actividades_relaciones (single source of truth).
  if (vinculos.length > 0) {
    await insertarVinculosActividad(ctx.admin, ctx.empresa_id, data.id, vinculos, ctx.usuario_id)
  }

  return {
    exito: true,
    datos: data,
    mensaje_usuario: `Actividad "${titulo}" (${tipoEncontrado.etiqueta}) creada y asignada a ${nombreAsignado}.`,
  }
}

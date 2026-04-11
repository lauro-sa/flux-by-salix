import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * Sincroniza actividad + evento calendario al crear/editar una visita.
 * Crea los registros si no existen, los actualiza si ya existen.
 * Se usa en: POST y PATCH de /api/visitas.
 */

interface DatosVisita {
  id: string
  empresa_id: string
  contacto_id: string
  contacto_nombre: string
  direccion_texto: string | null
  asignado_a: string | null
  asignado_nombre: string | null
  fecha_programada: string
  duracion_estimada_min: number
  estado: string
  motivo: string | null
  prioridad: string
  actividad_id: string | null
  creado_por: string
  creado_por_nombre: string | null
}

interface TiposVisita {
  tipo_actividad_id: string
  tipo_evento_id: string
  estado_pendiente_id: string
  estado_completada_id: string
  color_evento: string
}

/** Obtiene los IDs de tipos necesarios para crear actividad + evento */
export async function obtenerTiposVisita(empresaId: string): Promise<TiposVisita | null> {
  const admin = crearClienteAdmin()

  const [tipoAct, tipoEvt, estadoPend, estadoComp] = await Promise.all([
    admin.from('tipos_actividad').select('id').eq('empresa_id', empresaId).eq('clave', 'visita').single(),
    admin.from('tipos_evento_calendario').select('id, color').eq('empresa_id', empresaId).eq('clave', 'visita').single(),
    admin.from('estados_actividad').select('id').eq('empresa_id', empresaId).eq('clave', 'pendiente').single(),
    admin.from('estados_actividad').select('id').eq('empresa_id', empresaId).eq('clave', 'completada').single(),
  ])

  if (!tipoAct.data || !tipoEvt.data || !estadoPend.data || !estadoComp.data) return null

  return {
    tipo_actividad_id: tipoAct.data.id,
    tipo_evento_id: tipoEvt.data.id,
    estado_pendiente_id: estadoPend.data.id,
    estado_completada_id: estadoComp.data.id,
    color_evento: tipoEvt.data.color || '#3b82f6',
  }
}

/** Crea actividad + evento calendario para una visita nueva */
export async function crearRegistrosVinculados(visita: DatosVisita, tipos: TiposVisita) {
  const admin = crearClienteAdmin()

  const fechaInicio = new Date(visita.fecha_programada)
  const fechaFin = new Date(fechaInicio.getTime() + (visita.duracion_estimada_min || 30) * 60000)
  const esCompletada = visita.estado === 'completada'

  // Crear actividad
  const { data: actividad } = await admin
    .from('actividades')
    .insert({
      empresa_id: visita.empresa_id,
      titulo: `Visita: ${visita.contacto_nombre}`,
      descripcion: visita.motivo || null,
      tipo_id: tipos.tipo_actividad_id,
      tipo_clave: 'visita',
      estado_id: esCompletada ? tipos.estado_completada_id : tipos.estado_pendiente_id,
      estado_clave: esCompletada ? 'completada' : 'pendiente',
      prioridad: visita.prioridad,
      fecha_vencimiento: visita.fecha_programada,
      fecha_completada: esCompletada ? new Date().toISOString() : null,
      asignado_a: visita.asignado_a,
      asignado_nombre: visita.asignado_nombre,
      vinculos: [{ tipo: 'contacto', id: visita.contacto_id, nombre: visita.contacto_nombre }],
      vinculo_ids: [visita.contacto_id],
      creado_por: visita.creado_por,
      creado_por_nombre: visita.creado_por_nombre,
    })
    .select('id')
    .single()

  if (!actividad) return null

  // Crear evento calendario
  const asignados = visita.asignado_a
    ? [{ id: visita.asignado_a, nombre: visita.asignado_nombre || '' }]
    : []

  const { data: evento } = await admin
    .from('eventos_calendario')
    .insert({
      empresa_id: visita.empresa_id,
      titulo: `Visita: ${visita.contacto_nombre}`,
      descripcion: visita.motivo || null,
      ubicacion: visita.direccion_texto || null,
      tipo_id: tipos.tipo_evento_id,
      tipo_clave: 'visita',
      color: tipos.color_evento,
      fecha_inicio: fechaInicio.toISOString(),
      fecha_fin: fechaFin.toISOString(),
      todo_el_dia: false,
      visibilidad: 'publica',
      asignados,
      asignado_ids: visita.asignado_a ? [visita.asignado_a] : [],
      vinculos: [{ tipo: 'contacto', id: visita.contacto_id, nombre: visita.contacto_nombre }],
      vinculo_ids: [visita.contacto_id],
      actividad_id: actividad.id,
      visita_id: visita.id,
      estado: esCompletada ? 'cancelado' : 'confirmado',
      creado_por: visita.creado_por,
      creado_por_nombre: visita.creado_por_nombre,
    })
    .select('id')
    .single()

  // Vincular actividad a la visita
  await admin
    .from('visitas')
    .update({ actividad_id: actividad.id })
    .eq('id', visita.id)

  return { actividad_id: actividad.id, evento_id: evento?.id || null }
}

/** Sincroniza actividad + evento calendario al editar una visita */
export async function sincronizarRegistrosVinculados(visita: DatosVisita, tipos: TiposVisita) {
  const admin = crearClienteAdmin()

  const fechaInicio = new Date(visita.fecha_programada)
  const fechaFin = new Date(fechaInicio.getTime() + (visita.duracion_estimada_min || 30) * 60000)
  const esCompletada = visita.estado === 'completada'
  const esCancelada = visita.estado === 'cancelada'

  // Actualizar actividad vinculada
  if (visita.actividad_id) {
    await admin
      .from('actividades')
      .update({
        titulo: `Visita: ${visita.contacto_nombre}`,
        descripcion: visita.motivo || null,
        prioridad: visita.prioridad,
        fecha_vencimiento: visita.fecha_programada,
        estado_id: esCompletada ? tipos.estado_completada_id : tipos.estado_pendiente_id,
        estado_clave: esCompletada ? 'completada' : 'pendiente',
        fecha_completada: esCompletada ? new Date().toISOString() : null,
        asignado_a: visita.asignado_a,
        asignado_nombre: visita.asignado_nombre,
        vinculos: [{ tipo: 'contacto', id: visita.contacto_id, nombre: visita.contacto_nombre }],
        vinculo_ids: [visita.contacto_id],
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', visita.actividad_id)
  }

  // Actualizar evento calendario vinculado (buscar por visita_id)
  const asignados = visita.asignado_a
    ? [{ id: visita.asignado_a, nombre: visita.asignado_nombre || '' }]
    : []

  await admin
    .from('eventos_calendario')
    .update({
      titulo: `Visita: ${visita.contacto_nombre}`,
      descripcion: visita.motivo || null,
      ubicacion: visita.direccion_texto || null,
      fecha_inicio: fechaInicio.toISOString(),
      fecha_fin: fechaFin.toISOString(),
      asignados,
      asignado_ids: visita.asignado_a ? [visita.asignado_a] : [],
      vinculos: [{ tipo: 'contacto', id: visita.contacto_id, nombre: visita.contacto_nombre }],
      vinculo_ids: [visita.contacto_id],
      estado: esCancelada ? 'cancelado' : esCompletada ? 'cancelado' : 'confirmado',
      actualizado_en: new Date().toISOString(),
    })
    .eq('visita_id', visita.id)
}

/** Elimina actividad + evento calendario al borrar una visita */
export async function eliminarRegistrosVinculados(visitaId: string, actividadId: string | null) {
  const admin = crearClienteAdmin()

  // Eliminar evento calendario (tiene ON DELETE CASCADE desde visita_id)
  await admin
    .from('eventos_calendario')
    .delete()
    .eq('visita_id', visitaId)

  // Eliminar actividad si existe
  if (actividadId) {
    await admin
      .from('actividades')
      .delete()
      .eq('id', actividadId)
  }
}

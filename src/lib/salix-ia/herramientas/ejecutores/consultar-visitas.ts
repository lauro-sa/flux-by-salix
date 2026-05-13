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

  // Si piden filtrar por tipo de contacto (ej: solo visitas a edificios), primero
  // resolvemos los IDs de contactos de ese tipo y después los pasamos como .in().
  // Lo hacemos antes para poder cortar temprano si no hay coincidencias.
  let idsContactosFiltro: string[] | null = null
  const tipoContactoClave = (params.tipo_contacto_clave as string)?.trim()?.toLowerCase()

  if (tipoContactoClave) {
    const { data: tipo } = await ctx.admin
      .from('tipos_contacto')
      .select('id')
      .eq('empresa_id', ctx.empresa_id)
      .eq('clave', tipoContactoClave)
      .eq('activo', true)
      .maybeSingle()

    if (!tipo) {
      return { exito: false, error: `Tipo de contacto "${tipoContactoClave}" no existe.` }
    }

    const { data: contactosFiltrados } = await ctx.admin
      .from('contactos')
      .select('id')
      .eq('empresa_id', ctx.empresa_id)
      .eq('tipo_contacto_id', tipo.id)
      .eq('en_papelera', false)

    const ids: string[] = (contactosFiltrados || []).map((c: { id: string }) => c.id)
    idsContactosFiltro = ids

    if (ids.length === 0) {
      return {
        exito: true,
        datos: [],
        mensaje_usuario: `No hay contactos de tipo "${tipoContactoClave}", así que tampoco hay visitas.`,
      }
    }
  }

  // Orden default: si se pide 'completada' o estados pasados, lo más reciente
  // primero (útil para "últimas 5 visitas a edificios"). Para 'programada' o
  // 'todas', orden ascendente (próximas primero). El modelo puede forzar el
  // orden con el parámetro 'orden'.
  const ordenParam = (params.orden as string)?.toLowerCase()
  const orden: 'asc' | 'desc' = ordenParam === 'desc' || ordenParam === 'asc'
    ? ordenParam
    : (estado === 'completada' || estado === 'cancelada' ? 'desc' : 'asc')

  let query = ctx.admin
    .from('visitas')
    .select(`
      id, contacto_nombre, contacto_id, direccion_texto, direccion_lat, direccion_lng,
      asignado_nombre, fecha_programada, tiene_hora_especifica, fecha_completada,
      estado, motivo, prioridad, duracion_estimada_min, notas, resultado,
      temperatura, recibe_nombre, recibe_telefono
    `)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .order('fecha_programada', { ascending: orden === 'asc' })
    .limit(limite)

  if (idsContactosFiltro) {
    query = query.in('contacto_id', idsContactosFiltro)
  }

  // Búsqueda por texto (contacto, dirección, motivo)
  if (params.busqueda) {
    const busq = params.busqueda as string
    query = query.or(`contacto_nombre.ilike.%${busq}%,direccion_texto.ilike.%${busq}%,motivo.ilike.%${busq}%`)
  }

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
    contacto_id: v.contacto_id,
    direccion: v.direccion_texto || null,
    // Coordenadas — útiles para que el modelo arme links a Google Maps en la respuesta.
    direccion_lat: v.direccion_lat ?? null,
    direccion_lng: v.direccion_lng ?? null,
    asignado: v.asignado_nombre,
    fecha_programada: v.fecha_programada,
    // Si false: la hora dentro de fecha_programada es placeholder, mostrar
    // solo el día. El modelo debe mencionar "sin hora específica" en ese caso.
    tiene_hora_especifica: v.tiene_hora_especifica ?? false,
    fecha_completada: v.fecha_completada || null,
    estado: v.estado,
    motivo: v.motivo || null,
    prioridad: v.prioridad,
    duracion_min: v.duracion_estimada_min,
    notas: v.notas || null,
    resultado: v.resultado || null,
    temperatura: v.temperatura || null, // frio | tibio | caliente
    // Contacto de recepción (quien recibe al visitador, puede ser diferente al principal)
    recibe_nombre: v.recibe_nombre || null,
    recibe_telefono: v.recibe_telefono || null,
  }))

  return {
    exito: true,
    datos: visitas,
    mensaje_usuario: visitas.length === 0
      ? `No hay visitas ${estado === 'todas' ? '' : estado + 's'}.`
      : `${visitas.length} visita(s) encontrada(s).`,
  }
}

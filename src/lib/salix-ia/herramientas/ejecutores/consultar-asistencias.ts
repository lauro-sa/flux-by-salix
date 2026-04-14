/**
 * Ejecutor: consultar_asistencias
 * Consulta asistencia de empleados: presentes, ausentes, tardanzas.
 * Respeta visibilidad ver_propio vs ver_todos.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

export async function ejecutarConsultarAsistencias(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const visibilidad = determinarVisibilidad(ctx.miembro, 'asistencias')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver asistencias' }
  }

  const fecha = (params.fecha as string) || new Date().toISOString().split('T')[0]

  // Obtener miembro_id del usuario actual para filtro ver_propio
  let miembroIdActual: string | null = null
  if (visibilidad === 'propio') {
    const { data: miembro } = await ctx.admin
      .from('miembros')
      .select('id')
      .eq('usuario_id', ctx.usuario_id)
      .eq('empresa_id', ctx.empresa_id)
      .single()
    miembroIdActual = miembro?.id || null
  }

  // Query asistencias del día
  let query = ctx.admin
    .from('asistencias')
    .select(`
      id, miembro_id, fecha, hora_entrada, hora_salida,
      estado, tipo, puntualidad_min,
      miembro:miembros!miembro_id(
        id, puesto_nombre,
        perfil:perfiles!usuario_id(nombre, apellido)
      )
    `)
    .eq('empresa_id', ctx.empresa_id)
    .eq('fecha', fecha)

  // Filtrar si un miembro específico o solo el propio
  if (params.miembro_id) {
    query = query.eq('miembro_id', params.miembro_id)
  } else if (visibilidad === 'propio' && miembroIdActual) {
    query = query.eq('miembro_id', miembroIdActual)
  }

  const { data: asistencias, error } = await query

  if (error) {
    return { exito: false, error: `Error consultando asistencias: ${error.message}` }
  }

  // Obtener total de empleados activos para calcular ausentes
  let totalEmpleados = 0
  if (visibilidad === 'todos' && !params.miembro_id) {
    const { count } = await ctx.admin
      .from('miembros')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', ctx.empresa_id)
      .eq('activo', true)

    totalEmpleados = count || 0
  }

  // Clasificar asistencias
  const presentes: { nombre: string; hora_entrada: string; tipo: string }[] = []
  const tardanzas: { nombre: string; hora_entrada: string; minutos_tarde: number }[] = []

  for (const a of (asistencias || [])) {
    const miembro = a.miembro as { perfil: { nombre: string; apellido: string } } | null
    const nombre = miembro?.perfil
      ? [miembro.perfil.nombre, miembro.perfil.apellido].filter(Boolean).join(' ')
      : 'Sin nombre'

    if (a.tipo === 'tardanza' || (a.puntualidad_min && a.puntualidad_min > 0)) {
      tardanzas.push({
        nombre,
        hora_entrada: a.hora_entrada || '',
        minutos_tarde: a.puntualidad_min || 0,
      })
    } else {
      presentes.push({
        nombre,
        hora_entrada: a.hora_entrada || '',
        tipo: a.tipo || 'normal',
      })
    }
  }

  const totalPresentes = (asistencias || []).length
  const totalAusentes = totalEmpleados > 0 ? totalEmpleados - totalPresentes : 0

  return {
    exito: true,
    datos: {
      fecha,
      total_empleados: totalEmpleados,
      total_presentes: totalPresentes,
      total_tardanzas: tardanzas.length,
      total_ausentes: totalAusentes,
      presentes,
      tardanzas,
    },
    mensaje_usuario: visibilidad === 'propio'
      ? `Tu asistencia del ${fecha}: ${totalPresentes > 0 ? 'registrada' : 'sin registro'}.`
      : `Asistencia del ${fecha}: ${totalPresentes} presentes, ${tardanzas.length} tardanzas, ${totalAusentes} ausentes.`,
  }
}

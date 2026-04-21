/**
 * Ejecutor: consultar_asistencias
 * Consulta asistencia de empleados: presentes, ausentes, tardanzas, horas trabajadas.
 * Respeta visibilidad ver_propio vs ver_todos.
 * Devuelve: hora entrada, hora salida, estado de jornada, horas trabajadas.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

/** Formatea un timestamp a hora legible (ej: "08:32") en la zona horaria de la empresa */
function formatearHora(timestamp: string | null, zona: string): string | null {
  if (!timestamp) return null
  return new Date(timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona })
}

/** Calcula horas trabajadas entre entrada y salida */
function calcularHorasTrabajadas(entrada: string | null, salida: string | null): string | null {
  if (!entrada || !salida) return null
  const diff = new Date(salida).getTime() - new Date(entrada).getTime()
  const horas = Math.floor(diff / 3600000)
  const minutos = Math.floor((diff % 3600000) / 60000)
  return `${horas}h ${minutos}m`
}

/** Traduce el estado de jornada a texto legible */
function traducirEstado(estado: string): string {
  const estados: Record<string, string> = {
    activo: 'Trabajando',
    almuerzo: 'En almuerzo',
    particular: 'Salida particular',
    cerrado: 'Jornada cerrada',
    auto_cerrado: 'Cerrado automático',
    ausente: 'Ausente',
  }
  return estados[estado] || estado
}

export async function ejecutarConsultarAsistencias(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const visibilidad = determinarVisibilidad(ctx.miembro, 'asistencias')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver asistencias' }
  }

  const fecha = (params.fecha as string) || new Date().toISOString().split('T')[0]

  // Obtener miembro_id del usuario actual
  const { data: miembroActual } = await ctx.admin
    .from('miembros')
    .select('id')
    .eq('usuario_id', ctx.usuario_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('activo', true)
    .single()

  // Query asistencias del día — sin joins complejos
  let query = ctx.admin
    .from('asistencias')
    .select('id, miembro_id, fecha, hora_entrada, hora_salida, estado, tipo, puntualidad_min, metodo_registro, notas')
    .eq('empresa_id', ctx.empresa_id)
    .eq('fecha', fecha)

  // Filtrar por miembro específico o visibilidad
  if (params.miembro_id) {
    query = query.eq('miembro_id', params.miembro_id)
  } else if (visibilidad === 'propio' && miembroActual) {
    query = query.eq('miembro_id', miembroActual.id)
  }

  const { data: asistencias, error } = await query.order('hora_entrada', { ascending: true })

  if (error) {
    return { exito: false, error: `Error consultando asistencias: ${error.message}` }
  }

  // Obtener nombres de los miembros — queries separadas para evitar joins problemáticos
  const miembroIds = [...new Set((asistencias || []).map((a: { miembro_id: string }) => a.miembro_id))]

  let nombresMap = new Map<string, { nombre: string; puesto: string | null }>()

  if (miembroIds.length > 0) {
    const { data: miembros } = await ctx.admin
      .from('miembros')
      .select('id, usuario_id, puesto_nombre')
      .in('id', miembroIds)

    if (miembros) {
      const usuarioIds = miembros.map((m: { usuario_id: string | null }) => m.usuario_id).filter((x: string | null): x is string => !!x)
      const { data: perfiles } = usuarioIds.length > 0
        ? await ctx.admin.from('perfiles').select('id, nombre, apellido').in('id', usuarioIds)
        : { data: [] as Array<{ id: string; nombre: string | null; apellido: string | null }> }

      const perfilesMap = new Map<string, string>()
      for (const p of (perfiles || [])) {
        perfilesMap.set(p.id, [p.nombre, p.apellido].filter(Boolean).join(' '))
      }

      // Fallback contacto equipo para miembros sin cuenta Flux
      const miembrosIdsArr = miembros.map((m: { id: string }) => m.id)
      const { data: contactosEq } = miembrosIdsArr.length > 0
        ? await ctx.admin
            .from('contactos')
            .select('miembro_id, nombre, apellido')
            .in('miembro_id', miembrosIdsArr)
            .eq('en_papelera', false)
        : { data: [] as Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null }> }
      const contactoEqMap = new Map<string, string>()
      for (const c of (contactosEq || [])) {
        if (!c.miembro_id) continue
        contactoEqMap.set(c.miembro_id, [c.nombre, c.apellido].filter(Boolean).join(' '))
      }

      for (const m of miembros) {
        const desdePerfil = m.usuario_id ? perfilesMap.get(m.usuario_id) : null
        nombresMap.set(m.id, {
          nombre: desdePerfil || contactoEqMap.get(m.id) || 'Sin nombre',
          puesto: m.puesto_nombre,
        })
      }
    }
  }

  // Obtener todos los empleados activos (para calcular ausentes con nombres)
  let totalEmpleados = 0
  let ausentes: { nombre: string; puesto: string | null }[] = []

  if (visibilidad === 'todos' && !params.miembro_id) {
    const { data: todosLosMiembros } = await ctx.admin
      .from('miembros')
      .select('id, usuario_id, puesto_nombre')
      .eq('empresa_id', ctx.empresa_id)
      .eq('activo', true)

    totalEmpleados = todosLosMiembros?.length || 0

    // Identificar miembros que NO tienen registro de asistencia hoy
    const miembrosConRegistro = new Set(miembroIds)
    const miembrosSinRegistro = (todosLosMiembros || []).filter(
      (m: { id: string }) => !miembrosConRegistro.has(m.id)
    )

    if (miembrosSinRegistro.length > 0) {
      const usuarioIdsAusentes = miembrosSinRegistro
        .map((m: { usuario_id: string | null }) => m.usuario_id)
        .filter((x: string | null): x is string => !!x)
      const { data: perfilesAusentes } = usuarioIdsAusentes.length > 0
        ? await ctx.admin.from('perfiles').select('id, nombre, apellido').in('id', usuarioIdsAusentes)
        : { data: [] as Array<{ id: string; nombre: string | null; apellido: string | null }> }

      const perfilesAusentesMap = new Map<string, string>()
      for (const p of (perfilesAusentes || [])) {
        perfilesAusentesMap.set(p.id, [p.nombre, p.apellido].filter(Boolean).join(' '))
      }

      // Fallback contacto equipo para ausentes sin cuenta Flux
      const idsAusentes = miembrosSinRegistro.map((m: { id: string }) => m.id)
      const { data: contactosAus } = idsAusentes.length > 0
        ? await ctx.admin
            .from('contactos')
            .select('miembro_id, nombre, apellido')
            .in('miembro_id', idsAusentes)
            .eq('en_papelera', false)
        : { data: [] as Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null }> }
      const contactoAusMap = new Map<string, string>()
      for (const c of (contactosAus || [])) {
        if (!c.miembro_id) continue
        contactoAusMap.set(c.miembro_id, [c.nombre, c.apellido].filter(Boolean).join(' '))
      }

      ausentes = miembrosSinRegistro.map((m: { id: string; usuario_id: string | null; puesto_nombre: string | null }) => {
        const desdePerfil = m.usuario_id ? perfilesAusentesMap.get(m.usuario_id) : null
        return {
          nombre: desdePerfil || contactoAusMap.get(m.id) || 'Sin nombre',
          puesto: m.puesto_nombre,
        }
      })
    }
  }

  // Construir datos enriquecidos
  interface AsistenciaEnriquecida {
    nombre: string
    puesto: string | null
    hora_entrada: string | null
    hora_salida: string | null
    estado: string
    estado_texto: string
    tipo: string
    horas_trabajadas: string | null
    minutos_tarde: number | null
  }

  const registros: AsistenciaEnriquecida[] = (asistencias || []).map((a: {
    miembro_id: string
    hora_entrada: string | null
    hora_salida: string | null
    estado: string
    tipo: string
    puntualidad_min: number | null
  }) => {
    const info = nombresMap.get(a.miembro_id)
    return {
      nombre: info?.nombre || 'Sin nombre',
      puesto: info?.puesto || null,
      hora_entrada: formatearHora(a.hora_entrada, ctx.zona_horaria || 'America/Argentina/Buenos_Aires'),
      hora_salida: formatearHora(a.hora_salida, ctx.zona_horaria || 'America/Argentina/Buenos_Aires'),
      estado: a.estado,
      estado_texto: traducirEstado(a.estado),
      tipo: a.tipo,
      horas_trabajadas: calcularHorasTrabajadas(a.hora_entrada, a.hora_salida),
      minutos_tarde: a.puntualidad_min,
    }
  })

  const totalPresentes = registros.length
  const tardanzas = registros.filter(r => r.tipo === 'tardanza' || (r.minutos_tarde && r.minutos_tarde > 0))
  const totalAusentes = totalEmpleados > 0 ? totalEmpleados - totalPresentes : 0

  // Formatear mensaje según contexto
  let mensaje: string

  if (visibilidad === 'propio' || (params.miembro_id && params.miembro_id === miembroActual?.id)) {
    // Consulta propia
    if (registros.length === 0) {
      mensaje = `No tenés asistencia registrada para el ${fecha}.`
    } else {
      const r = registros[0]
      const partes = [`📅 *Tu asistencia del ${fecha}*`]
      partes.push(`⏰ Entrada: ${r.hora_entrada || 'sin registro'}`)
      if (r.hora_salida) {
        partes.push(`🏁 Salida: ${r.hora_salida}`)
      } else {
        partes.push(`🔄 Estado: ${r.estado_texto}`)
      }
      if (r.horas_trabajadas) {
        partes.push(`⏱ Horas trabajadas: ${r.horas_trabajadas}`)
      }
      if (r.minutos_tarde && r.minutos_tarde > 0) {
        partes.push(`⚠ Tardanza: ${r.minutos_tarde} min`)
      }
      mensaje = partes.join('\n')
    }
  } else {
    // Consulta de todos (admin)
    if (registros.length === 0) {
      mensaje = `No hay asistencias registradas para el ${fecha}.`
    } else {
      const partes = [`📅 *Asistencia del ${fecha}*`]
      partes.push(`✅ ${totalPresentes} presentes · ⚠ ${tardanzas.length} tardanzas · ❌ ${totalAusentes} ausentes`)
      partes.push('')

      for (const r of registros) {
        let linea = `• *${r.nombre}*`
        if (r.hora_entrada) linea += ` — entrada ${r.hora_entrada}`
        if (r.hora_salida) {
          linea += `, salida ${r.hora_salida}`
        } else {
          linea += ` _(${r.estado_texto})_`
        }
        if (r.horas_trabajadas) linea += ` · ${r.horas_trabajadas}`
        if (r.minutos_tarde && r.minutos_tarde > 0) linea += ` ⚠ +${r.minutos_tarde}min`
        partes.push(linea)
      }

      // Agregar lista de ausentes con nombres
      if (ausentes.length > 0) {
        partes.push('')
        partes.push(`❌ *Ausentes (${ausentes.length}):*`)
        for (const a of ausentes) {
          partes.push(`• ${a.nombre}${a.puesto ? ` _(${a.puesto})_` : ''}`)
        }
      }

      mensaje = partes.join('\n')
    }
  }

  return {
    exito: true,
    datos: {
      fecha,
      total_empleados: totalEmpleados,
      total_presentes: totalPresentes,
      total_tardanzas: tardanzas.length,
      total_ausentes: totalAusentes,
      registros,
      ausentes,
    },
    mensaje_usuario: mensaje,
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/visitas/planificacion — Visitas agrupadas por visitador para una fecha.
 * Usado por el coordinador para planificar recorridos del equipo.
 * SIEMPRE devuelve todos los miembros activos (aunque no tengan visitas).
 * Params: ?fecha=YYYY-MM-DD (default: hoy)
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'asignar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Filtro por mes: ?mes=YYYY-MM (default: mes actual)
    const { searchParams } = new URL(request.url)
    const mesParam = searchParams.get('mes')
    const ahora = new Date()
    const anio = mesParam ? parseInt(mesParam.split('-')[0]) : ahora.getFullYear()
    const mes = mesParam ? parseInt(mesParam.split('-')[1]) - 1 : ahora.getMonth()
    const inicioMes = new Date(anio, mes, 1).toISOString()
    const finMes = new Date(anio, mes + 1, 0, 23, 59, 59).toISOString()

    // Queries en paralelo: visitas del mes, miembros
    const [
      { data: visitas, error: errorVisitas },
      { data: miembros },
    ] = await Promise.all([
      admin
        .from('visitas')
        .select('id, contacto_id, contacto_nombre, direccion_texto, direccion_lat, direccion_lng, estado, prioridad, duracion_estimada_min, fecha_programada, motivo, asignado_a, asignado_nombre, contacto:contactos!visitas_contacto_id_fkey(tipo_contacto:tipos_contacto(clave, etiqueta))')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .in('estado', ['provisoria', 'programada', 'reprogramada', 'en_camino', 'en_sitio', 'completada', 'cancelada'])
        .gte('fecha_programada', inicioMes)
        .lte('fecha_programada', finMes)
        .order('fecha_programada', { ascending: true })
        .limit(500),
      admin
        .from('miembros')
        .select('usuario_id, rol, permisos_custom')
        .eq('empresa_id', empresaId)
        .eq('activo', true),
    ])

    if (errorVisitas) {
      console.error('Error al listar visitas planificación:', errorVisitas)
      return NextResponse.json({ error: 'Error al listar visitas' }, { status: 500 })
    }

    // Filtrar visitadores base:
    // - Propietario: siempre puede ser visitador
    // - Quien tiene permisos de recorrido (ver_propio / registrar) → visitador de campo
    // - Quien tiene visitas.asignar o visitas.ver_todos → coordinador/admin (también puede tomar visitas)
    const permisosRecorrido = ['ver_propio', 'registrar']
    const permisosCoordinador = ['asignar', 'ver_todos']
    const miembrosVisitadores = (miembros || []).filter(m => {
      if (m.rol === 'propietario') return true
      if (!m.permisos_custom) return false
      const permisos = m.permisos_custom as Record<string, string[]>
      const esVisitador = permisos.recorrido?.some((p: string) => permisosRecorrido.includes(p)) ?? false
      const esCoordinador = permisos.visitas?.some((p: string) => permisosCoordinador.includes(p)) ?? false
      return esVisitador || esCoordinador
    })

    // Agrupar visitas por asignado_a
    const visitasPorUsuario = new Map<string, typeof visitas>()
    const sinAsignar: typeof visitas = []

    for (const visita of visitas || []) {
      if (!visita.asignado_a) {
        sinAsignar.push(visita)
      } else {
        const lista = visitasPorUsuario.get(visita.asignado_a) || []
        lista.push(visita)
        visitasPorUsuario.set(visita.asignado_a, lista)
      }
    }

    // Incluir también usuarios que tienen visitas asignadas pero no están en la lista de visitadores
    const idsVisitadoresBase = new Set(miembrosVisitadores.map(m => m.usuario_id))
    const idsAsignadosExtra = [...visitasPorUsuario.keys()].filter(id => !idsVisitadoresBase.has(id))

    // Obtener perfiles de todos los usuarios necesarios (visitadores + asignados extra)
    const todosUsuarioIds = [...idsVisitadoresBase, ...idsAsignadosExtra]
    const { data: perfiles } = todosUsuarioIds.length > 0
      ? await admin.from('perfiles').select('id, nombre, apellido, avatar_url').in('id', todosUsuarioIds)
      : { data: [] as { id: string; nombre: string; apellido: string; avatar_url: string | null }[] }

    const perfilesPorId = new Map(
      (perfiles || []).map(p => [p.id, p])
    )

    // Armar respuesta: visitadores habilitados + usuarios con visitas asignadas
    const visitadores = miembrosVisitadores.map(miembro => {
      const usuarioId = miembro.usuario_id
      const perfil = perfilesPorId.get(usuarioId) || null
      const visitasUsuario = visitasPorUsuario.get(usuarioId) || []

      return {
        usuario_id: usuarioId,
        nombre: perfil?.nombre || '',
        apellido: perfil?.apellido || '',
        avatar_url: perfil?.avatar_url || null,
        rol: miembro.rol || null,
        visitas: visitasUsuario,
        recorrido: null,
      }
    })

    // Agregar columnas para usuarios con visitas asignadas que no son visitadores base
    for (const usuarioId of idsAsignadosExtra) {
      const perfil = perfilesPorId.get(usuarioId) || null
      const visitasUsuario = visitasPorUsuario.get(usuarioId) || []
      visitadores.push({
        usuario_id: usuarioId,
        nombre: perfil?.nombre || '',
        apellido: perfil?.apellido || '',
        avatar_url: perfil?.avatar_url || null,
        rol: null,
        visitas: visitasUsuario,
        recorrido: null,
      })
    }

    // Ordenar: los que tienen visitas primero, después por nombre
    visitadores.sort((a, b) => {
      if (a.visitas.length > 0 && b.visitas.length === 0) return -1
      if (a.visitas.length === 0 && b.visitas.length > 0) return 1
      return `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
    })

    return NextResponse.json({
      visitadores,
      sin_asignar: sinAsignar,
      pendientes_sin_asignar: sinAsignar,
      total_visitas: (visitas || []).length,
    })
  } catch (err) {
    console.error('Error en GET /api/visitas/planificacion:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

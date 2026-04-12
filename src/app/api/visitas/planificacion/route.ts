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

    // Queries en paralelo: TODAS las visitas pendientes, miembros
    const [
      { data: visitas, error: errorVisitas },
      { data: miembros },
    ] = await Promise.all([
      // Todas las visitas activas (cualquier fecha)
      admin
        .from('visitas')
        .select('id, contacto_id, contacto_nombre, direccion_texto, direccion_lat, direccion_lng, estado, prioridad, duracion_estimada_min, fecha_programada, motivo, asignado_a, asignado_nombre, contacto:contactos!visitas_contacto_id_fkey(tipo_contacto:tipos_contacto(clave, etiqueta))')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .in('estado', ['programada', 'reprogramada', 'en_camino', 'en_sitio', 'completada'])
        .order('fecha_programada', { ascending: true })
        .limit(200),
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

    // Filtrar solo visitadores:
    // - Propietario: siempre puede ser visitador
    // - Otros: solo si tienen ver_propio o registrar en recorrido en permisos_custom
    const permisosVisitador = ['ver_propio', 'registrar']
    const miembrosVisitadores = (miembros || []).filter(m => {
      if (m.rol === 'propietario') return true
      if (!m.permisos_custom) return false
      const permisos = m.permisos_custom as Record<string, string[]>
      return permisos.recorrido?.some((p: string) => permisosVisitador.includes(p)) ?? false
    })

    // Obtener perfiles de los visitadores
    const usuarioIds = miembrosVisitadores.map(m => m.usuario_id)
    const { data: perfiles } = usuarioIds.length > 0
      ? await admin.from('perfiles').select('id, nombre, apellido, avatar_url').in('id', usuarioIds)
      : { data: [] as { id: string; nombre: string; apellido: string; avatar_url: string | null }[] }

    const perfilesPorId = new Map(
      (perfiles || []).map(p => [p.id, p])
    )

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

    // Armar respuesta por visitadores habilitados
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

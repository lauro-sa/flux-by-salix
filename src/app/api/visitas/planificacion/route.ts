import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
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
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'asignar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { searchParams } = new URL(request.url)
    const fechaParam = searchParams.get('fecha')
    const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)
      ? fechaParam
      : new Date().toISOString().split('T')[0]

    const inicioDelDia = `${fecha}T00:00:00.000Z`
    const finDelDia = `${fecha}T23:59:59.999Z`

    // Queries en paralelo: visitas del día, miembros, recorridos
    const [
      { data: visitas, error: errorVisitas },
      { data: miembros },
      { data: recorridos },
    ] = await Promise.all([
      admin
        .from('visitas')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .neq('estado', 'cancelada')
        .gte('fecha_programada', inicioDelDia)
        .lte('fecha_programada', finDelDia)
        .order('fecha_programada', { ascending: true }),
      admin
        .from('miembros')
        .select('usuario_id, rol, permisos_custom')
        .eq('empresa_id', empresaId)
        .eq('activo', true),
      admin
        .from('recorridos')
        .select('*, paradas:recorrido_paradas(id, visita_id, orden)')
        .eq('empresa_id', empresaId)
        .eq('fecha', fecha),
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

    // Mapa de recorridos por usuario
    const recorridosPorUsuario = new Map<string, (typeof recorridos extends (infer T)[] | null ? T : never)>()
    for (const rec of recorridos || []) {
      recorridosPorUsuario.set(rec.asignado_a, rec)
    }

    // Armar respuesta por visitadores habilitados
    const visitadores = miembrosVisitadores.map(miembro => {
      const usuarioId = miembro.usuario_id
      const perfil = perfilesPorId.get(usuarioId) || null
      const visitasUsuario = visitasPorUsuario.get(usuarioId) || []
      const recorrido = recorridosPorUsuario.get(usuarioId) || null

      // Ordenar visitas según orden de paradas del recorrido si existe
      let visitasOrdenadas = visitasUsuario
      if (recorrido?.paradas?.length) {
        const ordenParadas = new Map(
          (recorrido.paradas as { visita_id: string; orden: number }[]).map(p => [p.visita_id, p.orden])
        )
        visitasOrdenadas = [...visitasUsuario].sort((a, b) => {
          const ordenA = ordenParadas.get(a.id) ?? 999
          const ordenB = ordenParadas.get(b.id) ?? 999
          return ordenA - ordenB
        })
      }

      return {
        usuario_id: usuarioId,
        nombre: perfil?.nombre || '',
        apellido: perfil?.apellido || '',
        avatar_url: perfil?.avatar_url || null,
        rol: miembro.rol || null,
        visitas: visitasOrdenadas,
        recorrido: recorrido ? {
          id: recorrido.id,
          estado: recorrido.estado,
          total_visitas: recorrido.total_visitas,
          visitas_completadas: recorrido.visitas_completadas,
          distancia_total_km: recorrido.distancia_total_km,
          duracion_total_min: recorrido.duracion_total_min,
          config: recorrido.config || null,
          paradas: recorrido.paradas || [],
        } : null,
      }
    })

    // Ordenar: los que tienen visitas primero, después por nombre
    visitadores.sort((a, b) => {
      if (a.visitas.length > 0 && b.visitas.length === 0) return -1
      if (a.visitas.length === 0 && b.visitas.length > 0) return 1
      return `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
    })

    return NextResponse.json({
      fecha,
      visitadores,
      sin_asignar: sinAsignar,
      total_visitas: (visitas || []).length,
    })
  } catch (err) {
    console.error('Error en GET /api/visitas/planificacion:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

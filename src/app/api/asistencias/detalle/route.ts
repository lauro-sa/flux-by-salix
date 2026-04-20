import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/asistencias/detalle?id=xxx — Obtener un registro por ID con tiempo activo.
 * Calcula el uso real del software a partir de los heartbeats del día.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

    const admin = crearClienteAdmin()

    const { data: registro } = await admin
      .from('asistencias')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!registro) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Obtener nombre del miembro (perfil con fallback a contacto equipo)
    const { data: miembro } = await admin
      .from('miembros')
      .select('usuario_id')
      .eq('id', registro.miembro_id)
      .single()

    let miembroNombre = 'Sin nombre'
    if (miembro) {
      if (miembro.usuario_id) {
        const { data: perfil } = await admin
          .from('perfiles')
          .select('nombre, apellido')
          .eq('id', miembro.usuario_id)
          .single()
        if (perfil && (perfil.nombre || perfil.apellido)) {
          miembroNombre = `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim()
        }
      }
      if (miembroNombre === 'Sin nombre') {
        const { data: contacto } = await admin
          .from('contactos')
          .select('nombre, apellido')
          .eq('miembro_id', registro.miembro_id)
          .eq('en_papelera', false)
          .maybeSingle()
        if (contacto && (contacto.nombre || contacto.apellido)) {
          miembroNombre = `${contacto.nombre || ''} ${contacto.apellido || ''}`.trim()
        }
      }
    }

    // Calcular tiempo activo real desde heartbeats.
    // Solo usamos 'heartbeat' (cada ~5 min de actividad real) — NO visibility/login/beforeunload
    // que se disparan por cambios de pestaña y no representan uso real.
    // Si entre dos heartbeats pasan más de 10 minutos, ese gap es inactividad.
    const GAP_INACTIVIDAD_MS = 10 * 60 * 1000

    // Filtrar por ventana del turno (hora_entrada → hora_salida o ahora)
    const inicioTurno = registro.hora_entrada || null
    const finTurno = registro.hora_salida || new Date().toISOString()

    const query = admin
      .from('fichajes_actividad')
      .select('timestamp')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', registro.miembro_id)
      .eq('fecha', registro.fecha)
      .eq('tipo', 'heartbeat')
      .order('timestamp', { ascending: true })

    // Filtrar por ventana del turno si hay hora de entrada
    if (inicioTurno) query.gte('timestamp', inicioTurno)
    query.lte('timestamp', finTurno)

    const { data: beats } = await query

    let tiempoActivoMin = 0
    const totalHeartbeats = beats?.length || 0

    if (beats && beats.length >= 2) {
      let inicioBloque = new Date(beats[0].timestamp).getTime()

      for (let i = 1; i < beats.length; i++) {
        const actual = new Date(beats[i].timestamp).getTime()
        const anterior = new Date(beats[i - 1].timestamp).getTime()
        const gap = actual - anterior

        if (gap > GAP_INACTIVIDAD_MS) {
          // Cerrar bloque activo anterior + sumar el intervalo del último heartbeat (~5 min)
          tiempoActivoMin += (anterior - inicioBloque + 5 * 60000) / 60000
          inicioBloque = actual
        }
      }

      // Cerrar último bloque + intervalo final
      const ultimoBeat = new Date(beats[beats.length - 1].timestamp).getTime()
      tiempoActivoMin += (ultimoBeat - inicioBloque + 5 * 60000) / 60000
    } else if (beats && beats.length === 1) {
      tiempoActivoMin = 5
    }

    return NextResponse.json({
      ...registro,
      miembro_nombre: miembroNombre,
      tiempo_activo_min: Math.round(tiempoActivoMin),
      total_heartbeats: totalHeartbeats,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'

/**
 * GET /api/calendario/visitas — Visitas y recorridos para inyectar en el calendario.
 * Devuelve visitas sueltas (sin recorrido) y recorridos con sus visitas agrupadas.
 * Params: desde, hasta (obligatorios, formato ISO)
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permisos — usa módulo 'visitas' para visibilidad
    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'visitas')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso para ver visitas' }, { status: 403 })
    const soloPropio = visibilidad.soloPropio

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')

    if (!desde || !hasta) {
      return NextResponse.json({ error: 'Parámetros desde y hasta son obligatorios' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // ── 1. Obtener todas las visitas del rango ──
    let queryVisitas = admin
      .from('visitas')
      .select('id, contacto_id, contacto_nombre, direccion_texto, asignado_a, asignado_nombre, fecha_programada, duracion_estimada_min, estado, motivo, prioridad, creado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .neq('estado', 'cancelada')
      .gte('fecha_programada', desde)
      .lt('fecha_programada', hasta)
      .order('fecha_programada', { ascending: true })

    // Filtro de visibilidad: solo mis visitas si soloPropio
    if (soloPropio) {
      queryVisitas = queryVisitas.or(`asignado_a.eq.${user.id},creado_por.eq.${user.id}`)
    }

    // ── 2. Obtener recorridos del rango con paradas ──
    let queryRecorridos = admin
      .from('recorridos')
      .select(`
        id, fecha, asignado_a, asignado_nombre, estado,
        total_visitas, visitas_completadas,
        recorrido_paradas (
          id, visita_id, orden,
          visitas (
            id, contacto_nombre, direccion_texto, fecha_programada, duracion_estimada_min, estado
          )
        )
      `)
      .eq('empresa_id', empresaId)
      .gte('fecha', desde.split('T')[0])
      .lte('fecha', hasta.split('T')[0])

    if (soloPropio) {
      queryRecorridos = queryRecorridos.or(`asignado_a.eq.${user.id},creado_por.eq.${user.id}`)
    }

    // Ejecutar en paralelo
    const [resVisitas, resRecorridos] = await Promise.all([queryVisitas, queryRecorridos])

    if (resVisitas.error) {
      console.error('Error al obtener visitas para calendario:', resVisitas.error)
      return NextResponse.json({ error: 'Error al obtener visitas' }, { status: 500 })
    }

    // ── 3. Determinar qué visitas están en un recorrido ──
    const visitasEnRecorrido = new Set<string>()
    const recorridos: Record<string, unknown>[] = []

    if (!resRecorridos.error && resRecorridos.data) {
      for (const rec of resRecorridos.data) {
        const paradas = (rec.recorrido_paradas as Record<string, unknown>[]) || []
        const visitasDelRecorrido: Record<string, unknown>[] = []

        for (const parada of paradas) {
          const visitaId = parada.visita_id as string
          visitasEnRecorrido.add(visitaId)
          const visita = parada.visitas as Record<string, unknown> | null
          visitasDelRecorrido.push({
            id: visitaId,
            contacto_nombre: visita?.contacto_nombre || '',
            direccion_texto: visita?.direccion_texto || null,
            estado: visita?.estado || 'programada',
            orden: parada.orden,
            hora_programada: visita?.fecha_programada || null,
            duracion_estimada_min: visita?.duracion_estimada_min || 30,
          })
        }

        // Ordenar por orden de parada
        visitasDelRecorrido.sort((a, b) => (a.orden as number) - (b.orden as number))

        recorridos.push({
          id: rec.id,
          fecha: rec.fecha,
          asignado_a: rec.asignado_a,
          asignado_nombre: rec.asignado_nombre,
          estado: rec.estado,
          total_visitas: rec.total_visitas,
          visitas_completadas: rec.visitas_completadas,
          visitas: visitasDelRecorrido,
        })
      }
    }

    // ── 4. Separar visitas sueltas (las que NO están en ningún recorrido) ──
    const visitasSueltas = (resVisitas.data || []).filter(
      (v: Record<string, unknown>) => !visitasEnRecorrido.has(v.id as string)
    )

    return NextResponse.json({
      visitas_sueltas: visitasSueltas,
      recorridos,
    })
  } catch (err) {
    console.error('Error en calendario/visitas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

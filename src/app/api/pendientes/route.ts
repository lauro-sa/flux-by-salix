import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/pendientes — Items pendientes del usuario con detalle.
 * Devuelve: actividades para hoy + vencidas (con datos), visitas hoy (count).
 * Se usa en: sidebar (dots), header (popover actividades con lista real).
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const ahora = new Date()
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    const hoyFin = new Date(hoyInicio)
    hoyFin.setDate(hoyFin.getDate() + 1)

    const camposActividad = 'id, titulo, fecha_vencimiento, estado_clave, tipo_clave, prioridad'

    const [resHoy, resVencidas, { count: visitasHoy }] = await Promise.all([
      // Actividades para hoy
      admin
        .from('actividades')
        .select(camposActividad, { count: 'exact' })
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .eq('estado_clave', 'pendiente')
        .gte('fecha_vencimiento', hoyInicio.toISOString())
        .lt('fecha_vencimiento', hoyFin.toISOString())
        .or(`creado_por.eq.${user.id},asignados_ids.cs.{${user.id}}`)
        .order('fecha_vencimiento', { ascending: true })
        .limit(10),

      // Actividades vencidas (más recientes primero)
      admin
        .from('actividades')
        .select(camposActividad, { count: 'exact' })
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .in('estado_clave', ['pendiente', 'vencida'])
        .lt('fecha_vencimiento', hoyInicio.toISOString())
        .or(`creado_por.eq.${user.id},asignados_ids.cs.{${user.id}}`)
        .order('fecha_vencimiento', { ascending: false })
        .limit(10),

      // Visitas programadas para hoy (solo count)
      admin
        .from('visitas')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .gte('fecha_programada', hoyInicio.toISOString())
        .lt('fecha_programada', hoyFin.toISOString())
        .in('estado', ['programada', 'en_camino', 'en_sitio'])
        .or(`asignado_a.eq.${user.id},creado_por.eq.${user.id}`),
    ])

    return NextResponse.json({
      actividades_hoy: resHoy.count || 0,
      actividades_hoy_items: resHoy.data || [],
      actividades_vencidas: resVencidas.count || 0,
      actividades_vencidas_items: resVencidas.data || [],
      visitas_hoy: visitasHoy || 0,
    })
  } catch (err) {
    console.error('Error en /api/pendientes:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

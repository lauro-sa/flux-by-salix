import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerInicioFinDiaEnZona } from '@/lib/formato-fecha'

/**
 * GET /api/pendientes — Items pendientes del usuario con detalle.
 * Devuelve: actividades para hoy + vencidas (con datos), visitas hoy (count).
 * Se usa en: sidebar (dots), header (popover actividades con lista real).
 */
export async function GET() {
  try {
    const guard = await requerirPermisoAPI('actividades', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    // Rango "hoy" en la zona de la empresa — sin esto, a la noche AR el endpoint
    // devolvía actividades del día siguiente (UTC ya es mañana).
    const { data: empresaTz } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zona = (empresaTz?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const rango = obtenerInicioFinDiaEnZona(zona)
    const hoyInicioISO = rango.inicio
    const hoyFinISO = rango.fin

    const camposActividad = 'id, titulo, fecha_vencimiento, estado_clave, tipo_clave, prioridad'

    const [resHoy, resVencidas, { count: visitasHoy }] = await Promise.all([
      // Actividades para hoy
      admin
        .from('actividades')
        .select(camposActividad, { count: 'exact' })
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .eq('estado_clave', 'pendiente')
        .gte('fecha_vencimiento', hoyInicioISO)
        .lt('fecha_vencimiento', hoyFinISO)
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
        .lt('fecha_vencimiento', hoyInicioISO)
        .or(`creado_por.eq.${user.id},asignados_ids.cs.{${user.id}}`)
        .order('fecha_vencimiento', { ascending: false })
        .limit(10),

      // Visitas programadas para hoy (solo count)
      admin
        .from('visitas')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .gte('fecha_programada', hoyInicioISO)
        .lt('fecha_programada', hoyFinISO)
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

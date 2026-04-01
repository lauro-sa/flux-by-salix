import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/cron/limpiar-notificaciones — Cleanup de notificaciones antiguas.
 * Ejecutado por Vercel Cron cada día a las 5:00 AM.
 *
 * Borra:
 * - Notificaciones leídas con más de 90 días
 * - Notificaciones no leídas con más de 180 días (safety net)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()
    const ahora = new Date()

    // Hace 90 días
    const hace90 = new Date(ahora)
    hace90.setDate(hace90.getDate() - 90)

    // Hace 180 días
    const hace180 = new Date(ahora)
    hace180.setDate(hace180.getDate() - 180)

    // Borrar leídas > 90 días
    const { count: borradasLeidas } = await admin
      .from('notificaciones')
      .delete({ count: 'exact' })
      .eq('leida', true)
      .lt('creada_en', hace90.toISOString())

    // Borrar no leídas > 180 días (safety net)
    const { count: borradasViejas } = await admin
      .from('notificaciones')
      .delete({ count: 'exact' })
      .lt('creada_en', hace180.toISOString())

    // Borrar recordatorios completados > 90 días
    const { count: recordatoriosBorrados } = await admin
      .from('recordatorios')
      .delete({ count: 'exact' })
      .eq('completado', true)
      .lt('completado_en', hace90.toISOString())

    return NextResponse.json({
      notificaciones_leidas_borradas: borradasLeidas || 0,
      notificaciones_viejas_borradas: borradasViejas || 0,
      recordatorios_borrados: recordatoriosBorrados || 0,
      timestamp: ahora.toISOString(),
    })
  } catch (err) {
    console.error('Error en cron limpiar-notificaciones:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

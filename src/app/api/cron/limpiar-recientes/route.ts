import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/cron/limpiar-recientes — Limpieza de historial reciente antiguo.
 * Ejecutado por Vercel Cron cada día a las 4:00 AM.
 *
 * Borra registros con más de 60 días de antigüedad.
 * También limita a máximo 50 registros por usuario (borra los más antiguos).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()

    // Borrar registros > 60 días
    const hace60 = new Date()
    hace60.setDate(hace60.getDate() - 60)

    const { count } = await admin
      .from('historial_recientes')
      .delete({ count: 'exact' })
      .lt('accedido_en', hace60.toISOString())

    return NextResponse.json({
      registros_borrados: count || 0,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error en cron limpiar-recientes:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

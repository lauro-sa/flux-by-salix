import { crearClienteAdmin } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/cron/despertar-snooze — Cron que despierta conversaciones pospuestas.
 * Ejecutado por Vercel Cron cada minuto.
 *
 * Busca conversaciones cuyo snooze_hasta ya pasó y limpia los campos de snooze,
 * devolviéndolas al inbox normal sin cambiar su estado.
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

    // Buscar conversaciones con snooze vencido
    const { data: vencidas, error: errorBusqueda } = await admin
      .from('conversaciones')
      .select('id')
      .not('snooze_hasta', 'is', null)
      .lte('snooze_hasta', ahora.toISOString())
      .limit(500)

    if (errorBusqueda) {
      console.error('Error buscando conversaciones con snooze vencido:', errorBusqueda)
      return NextResponse.json({ error: errorBusqueda.message }, { status: 500 })
    }

    if (!vencidas || vencidas.length === 0) {
      return NextResponse.json({ despertadas: 0, timestamp: ahora.toISOString() })
    }

    const ids = vencidas.map((c) => c.id)

    // Limpiar campos de snooze en lote
    const { error: errorUpdate } = await admin
      .from('conversaciones')
      .update({
        snooze_hasta: null,
        snooze_nota: null,
        snooze_por: null,
      })
      .in('id', ids)

    if (errorUpdate) {
      console.error('Error despertando conversaciones:', errorUpdate)
      return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
    }

    return NextResponse.json({
      despertadas: ids.length,
      timestamp: ahora.toISOString(),
    })
  } catch (err) {
    console.error('Error en cron despertar-snooze:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

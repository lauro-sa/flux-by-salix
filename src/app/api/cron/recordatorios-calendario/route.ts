import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'

/**
 * GET /api/cron/recordatorios-calendario — Cron que envía recordatorios de eventos.
 * Busca en recordatorios_calendario los pendientes cuya hora ya pasó,
 * crea notificaciones y marca como enviados.
 * Se ejecuta cada hora (plan Hobby) o cada 5 min (plan Pro).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()
    const ahora = new Date().toISOString()

    // Buscar recordatorios pendientes cuya hora programada ya pasó
    const { data: pendientes } = await admin
      .from('recordatorios_calendario')
      .select('*, eventos_calendario!inner(titulo, fecha_inicio, color, tipo_clave)')
      .eq('enviado', false)
      .lte('programado_para', ahora)
      .order('programado_para', { ascending: true })
      .limit(200)

    if (!pendientes || pendientes.length === 0) {
      return NextResponse.json({ procesados: 0, timestamp: ahora })
    }

    let enviados = 0

    for (const recordatorio of pendientes) {
      const evento = recordatorio.eventos_calendario as {
        titulo: string
        fecha_inicio: string
        color: string | null
        tipo_clave: string | null
      }

      // Crear notificación
      await crearNotificacion({
        empresaId: recordatorio.empresa_id,
        usuarioId: recordatorio.usuario_id,
        tipo: 'recordatorio_evento',
        titulo: `⏰ Recordatorio: ${evento.titulo}`,
        cuerpo: `Tu evento comienza pronto`,
        icono: 'Bell',
        color: evento.color || '#3B82F6',
        url: '/calendario',
        referenciaTipo: 'evento_calendario',
        referenciaId: recordatorio.evento_id,
      })

      // Marcar como enviado
      await admin
        .from('recordatorios_calendario')
        .update({ enviado: true, enviado_en: ahora })
        .eq('id', recordatorio.id)

      enviados++
    }

    return NextResponse.json({ procesados: enviados, timestamp: ahora })
  } catch (err) {
    console.error('Error en cron recordatorios-calendario:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

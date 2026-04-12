import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'
import { COLOR_NOTIFICACION } from '@/lib/colores_entidad'

/**
 * GET /api/cron/sla-vencido — Detecta conversaciones con SLA de primera respuesta vencido.
 * Ejecutado por Vercel Cron cada 5 minutos.
 *
 * Busca conversaciones donde:
 * - sla_primera_respuesta_vence_en < ahora
 * - sla_primera_respuesta_en IS NULL (no se respondió todavía)
 * - estado = 'abierta'
 * - notificar_sla_vencido está habilitado en config_inbox de la empresa
 *
 * Genera notificación tipo 'sla_vencido' al agente asignado o a admins.
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

    // Buscar conversaciones con SLA vencido que todavía no fueron respondidas
    const { data: conversaciones, error } = await admin
      .from('conversaciones')
      .select('id, empresa_id, contacto_nombre, canal, asignado_a, asignado_nombre, sla_primera_respuesta_vence_en')
      .not('sla_primera_respuesta_vence_en', 'is', null)
      .is('sla_primera_respuesta_en', null)
      .lt('sla_primera_respuesta_vence_en', ahora)
      .in('estado', ['abierta', 'pendiente'])
      .limit(100)

    if (error) {
      console.error('Error buscando SLAs vencidos:', error)
      return NextResponse.json({ error: 'Error en query' }, { status: 500 })
    }

    if (!conversaciones?.length) {
      return NextResponse.json({ ok: true, notificadas: 0 })
    }

    // Obtener config de inbox por empresa para verificar si tienen SLA habilitado
    const empresaIds = [...new Set(conversaciones.map(c => c.empresa_id))]
    const { data: configs } = await admin
      .from('config_inbox')
      .select('empresa_id, notificar_sla_vencido')
      .in('empresa_id', empresaIds)

    const configPorEmpresa = new Map(configs?.map(c => [c.empresa_id, c]) || [])

    let notificadas = 0

    for (const conv of conversaciones) {
      const config = configPorEmpresa.get(conv.empresa_id)
      if (config && !config.notificar_sla_vencido) continue

      // Calcular cuánto se pasó del SLA
      const venceEn = new Date(conv.sla_primera_respuesta_vence_en!)
      const diffMin = Math.round((Date.now() - venceEn.getTime()) / 60000)
      const tiempoTexto = diffMin < 60
        ? `${diffMin}min`
        : `${Math.floor(diffMin / 60)}h ${diffMin % 60}min`

      // Notificar al agente asignado o al primer admin
      const destinatario = conv.asignado_a
      if (!destinatario) continue

      await crearNotificacion({
        empresaId: conv.empresa_id,
        usuarioId: destinatario,
        tipo: 'sla_vencido',
        titulo: `⏰ SLA vencido hace ${tiempoTexto}`,
        cuerpo: `${conv.contacto_nombre || 'Sin nombre'} · ${conv.canal === 'whatsapp' ? 'WhatsApp' : conv.canal === 'correo' ? 'Correo' : 'Mensaje'}`,
        icono: 'AlertTriangle',
        color: COLOR_NOTIFICACION.peligro,
        url: `/inbox?conv=${conv.id}`,
        referenciaTipo: 'conversacion',
        referenciaId: conv.id,
      })

      // Limpiar el SLA vencido para no volver a notificar
      // Se marca poniendo una fecha ficticia en sla_primera_respuesta_en
      // En su lugar, usamos un approach de dedup: crearNotificacion ya verifica si existe una no-leída
      notificadas++
    }

    return NextResponse.json({ ok: true, notificadas, total: conversaciones.length })
  } catch (err) {
    console.error('Error en cron SLA vencido:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/cron/enviar-programados — Cron que envía correos programados.
 * Ejecutado por Vercel Cron cada minuto.
 * Busca correos en tabla correos_programados con estado 'pendiente' y enviar_en <= ahora.
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

    // Buscar correos pendientes que ya pasaron su hora
    const { data: pendientes } = await admin
      .from('correos_programados')
      .select('*')
      .eq('estado', 'pendiente')
      .lte('enviar_en', ahora)
      .order('enviar_en', { ascending: true })
      .limit(10)

    if (!pendientes || pendientes.length === 0) {
      return NextResponse.json({ enviados: 0, timestamp: ahora })
    }

    let enviados = 0

    for (const programado of pendientes) {
      try {
        // Llamar al endpoint de envío
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        if (!baseUrl) throw new Error('NEXT_PUBLIC_APP_URL no configurada')

        const res = await fetch(`${baseUrl}/api/inbox/correo/enviar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Usar service role para autenticar como el usuario que programó
            'x-programado-por': programado.creado_por,
            'x-empresa-id': programado.empresa_id,
          },
          body: JSON.stringify({
            conversacion_id: programado.conversacion_id,
            canal_id: programado.canal_id,
            correo_para: programado.correo_para,
            correo_cc: programado.correo_cc,
            correo_cco: programado.correo_cco,
            correo_asunto: programado.correo_asunto,
            texto: programado.texto,
            html: programado.html,
            correo_in_reply_to: programado.correo_in_reply_to,
            correo_references: programado.correo_references,
            adjuntos_ids: programado.adjuntos_ids,
            tipo: 'nuevo',
          }),
        })

        if (res.ok) {
          await admin
            .from('correos_programados')
            .update({ estado: 'enviado', enviado_en: new Date().toISOString() })
            .eq('id', programado.id)
          enviados++
        } else {
          const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }))
          await admin
            .from('correos_programados')
            .update({ estado: 'error', error: errorData.error || 'Error al enviar' })
            .eq('id', programado.id)
        }
      } catch (err) {
        await admin
          .from('correos_programados')
          .update({ estado: 'error', error: (err as Error).message })
          .eq('id', programado.id)
      }
    }

    return NextResponse.json({ enviados, total: pendientes.length, timestamp: ahora })
  } catch (err) {
    console.error('Error en cron enviar-programados:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

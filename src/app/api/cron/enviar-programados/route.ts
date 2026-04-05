import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/cron/enviar-programados — Cron que envía correos y WhatsApp programados.
 * Ejecutado por Vercel Cron cada hora (límite Hobby).
 * 1. Busca correos en tabla correos_programados con estado 'pendiente' y enviar_en <= ahora.
 * 2. Busca mensajes en tabla whatsapp_programados con estado 'pendiente' y enviar_en <= ahora.
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

    let correoEnviados = 0
    const correoTotal = pendientes?.length || 0

    if (pendientes && pendientes.length > 0) {
      for (const programado of pendientes) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL
          if (!baseUrl) throw new Error('NEXT_PUBLIC_APP_URL no configurada')

          const res = await fetch(`${baseUrl}/api/inbox/correo/enviar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
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
            correoEnviados++
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
    }

    // ─── 2. WhatsApp programados ───
    const { data: waPendientes } = await admin
      .from('whatsapp_programados')
      .select('*')
      .eq('estado', 'pendiente')
      .lte('enviar_en', ahora)
      .order('enviar_en', { ascending: true })
      .limit(10)

    let waEnviados = 0
    const waTotal = waPendientes?.length || 0

    if (waPendientes && waPendientes.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      if (!baseUrl) {
        console.error('NEXT_PUBLIC_APP_URL no configurada para WhatsApp programados')
      } else {
        for (const programado of waPendientes) {
          try {
            // Mapear tipo_contenido de Flux a tipo del endpoint de envío
            const mapaTipo: Record<string, string> = {
              texto: 'texto',
              imagen: 'imagen',
              video: 'video',
              audio: 'audio',
              documento: 'documento',
              plantilla: 'plantilla',
            }

            const res = await fetch(`${baseUrl}/api/inbox/whatsapp/enviar`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-programado-por': programado.creado_por,
                'x-empresa-id': programado.empresa_id,
              },
              body: JSON.stringify({
                canal_id: programado.canal_id,
                conversacion_id: programado.conversacion_id,
                tipo: mapaTipo[programado.tipo_contenido] || 'texto',
                texto: programado.texto,
                media_url: programado.media_url,
                media_filename: programado.media_nombre,
                plantilla_nombre_api: programado.plantilla_nombre,
                plantilla_idioma: programado.plantilla_idioma,
                plantilla_componentes: programado.plantilla_componentes,
              }),
            })

            if (res.ok) {
              const resData = await res.json().catch(() => ({}))
              await admin
                .from('whatsapp_programados')
                .update({
                  estado: 'enviado',
                  enviado_en: new Date().toISOString(),
                  wa_message_id: resData.wa_message_id || null,
                })
                .eq('id', programado.id)
              waEnviados++
            } else {
              const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }))
              await admin
                .from('whatsapp_programados')
                .update({ estado: 'error', error: errorData.error || 'Error al enviar' })
                .eq('id', programado.id)
            }
          } catch (err) {
            await admin
              .from('whatsapp_programados')
              .update({ estado: 'error', error: (err as Error).message })
              .eq('id', programado.id)
          }
        }
      }
    }

    return NextResponse.json({
      correo: { enviados: correoEnviados, total: correoTotal },
      whatsapp: { enviados: waEnviados, total: waTotal },
      timestamp: ahora,
    })
  } catch (err) {
    console.error('Error en cron enviar-programados:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

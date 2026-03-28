import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { enviarReaccionWhatsApp, type ConfigCuentaWhatsApp } from '@/lib/whatsapp'

/**
 * POST /api/inbox/whatsapp/reaccion — Enviar reacción emoji a un mensaje.
 * Body: { conversacion_id, mensaje_id, emoji }
 * Si emoji es "" se quita la reacción.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { conversacion_id, mensaje_id, emoji } = await request.json()
    if (!conversacion_id || !mensaje_id) {
      return NextResponse.json({ error: 'conversacion_id y mensaje_id requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener conversación
    const { data: conversacion } = await admin
      .from('conversaciones')
      .select('identificador_externo, canal_id')
      .eq('id', conversacion_id)
      .single()

    if (!conversacion?.identificador_externo) {
      return NextResponse.json({ error: 'Sin número' }, { status: 400 })
    }

    // Obtener wa_message_id del mensaje
    const { data: mensaje } = await admin
      .from('mensajes')
      .select('wa_message_id')
      .eq('id', mensaje_id)
      .single()

    if (!mensaje?.wa_message_id) {
      return NextResponse.json({ error: 'Mensaje sin ID de WhatsApp' }, { status: 400 })
    }

    // Obtener config del canal
    const { data: canal } = await admin
      .from('canales_inbox')
      .select('config_conexion')
      .eq('id', conversacion.canal_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
    await enviarReaccionWhatsApp(config, conversacion.identificador_externo, mensaje.wa_message_id, emoji || '')

    // Guardar reacción en BD
    const userId = user.id
    const { data: msgActual } = await admin
      .from('mensajes')
      .select('reacciones')
      .eq('id', mensaje_id)
      .single()

    const reacciones = (msgActual?.reacciones || {}) as Record<string, string[]>

    if (emoji) {
      // Agregar reacción (quitar previas del mismo usuario)
      for (const key of Object.keys(reacciones)) {
        reacciones[key] = reacciones[key].filter(uid => uid !== userId)
        if (reacciones[key].length === 0) delete reacciones[key]
      }
      if (!reacciones[emoji]) reacciones[emoji] = []
      reacciones[emoji].push(userId)
    } else {
      // Quitar todas las reacciones de este usuario
      for (const key of Object.keys(reacciones)) {
        reacciones[key] = reacciones[key].filter(uid => uid !== userId)
        if (reacciones[key].length === 0) delete reacciones[key]
      }
    }

    await admin
      .from('mensajes')
      .update({ reacciones })
      .eq('id', mensaje_id)

    return NextResponse.json({ ok: true, reacciones })
  } catch (err) {
    console.error('Error al enviar reacción:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

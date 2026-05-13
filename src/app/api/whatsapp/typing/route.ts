import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { enviarTypingWhatsApp, type ConfigCuentaWhatsApp } from '@/lib/whatsapp'

/**
 * POST /api/whatsapp/typing — Enviar indicador "escribiendo..." al cliente.
 * Body: { conversacion_id }
 *
 * La API oficial de Meta exige que el typing se mande como update de status
 * de un mensaje ENTRANTE específico. Resolvemos el último mensaje entrante
 * de la conversación con wa_message_id válido y lo usamos como ancla.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_whatsapp', 'enviar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const { conversacion_id } = await request.json()
    if (!conversacion_id) return NextResponse.json({ error: 'conversacion_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    const { data: conversacion } = await admin
      .from('conversaciones')
      .select('canal_id')
      .eq('id', conversacion_id)
      .single()

    if (!conversacion?.canal_id) {
      return NextResponse.json({ error: 'Conversación inválida' }, { status: 400 })
    }

    // Buscar el último mensaje entrante con wa_message_id (Meta solo acepta
    // typing como update sobre un mensaje específico). Si no hay ninguno
    // reciente, devolvemos ok sin hacer nada — el typing es decorativo.
    const { data: ultimoEntrante } = await admin
      .from('mensajes')
      .select('wa_message_id')
      .eq('conversacion_id', conversacion_id)
      .eq('es_entrante', true)
      .not('wa_message_id', 'is', null)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!ultimoEntrante?.wa_message_id) {
      return NextResponse.json({ ok: true, motivo: 'sin mensaje entrante reciente' })
    }

    const { data: canal } = await admin
      .from('canales_whatsapp')
      .select('config_conexion')
      .eq('id', conversacion.canal_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
    await enviarTypingWhatsApp(config, ultimoEntrante.wa_message_id)

    return NextResponse.json({ ok: true })
  } catch {
    // No fallar silenciosamente — el typing no es crítico
    return NextResponse.json({ ok: true })
  }
}

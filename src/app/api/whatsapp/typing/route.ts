import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { enviarTypingWhatsApp, type ConfigCuentaWhatsApp } from '@/lib/whatsapp'

/**
 * POST /api/whatsapp/typing — Enviar indicador "escribiendo..." al cliente.
 * Body: { conversacion_id }
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { conversacion_id } = await request.json()
    if (!conversacion_id) return NextResponse.json({ error: 'conversacion_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    const { data: conversacion } = await admin
      .from('conversaciones')
      .select('identificador_externo, canal_id')
      .eq('id', conversacion_id)
      .single()

    if (!conversacion?.identificador_externo) {
      return NextResponse.json({ error: 'Sin número' }, { status: 400 })
    }

    const { data: canal } = await admin
      .from('canales_inbox')
      .select('config_conexion')
      .eq('id', conversacion.canal_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
    await enviarTypingWhatsApp(config, conversacion.identificador_externo)

    return NextResponse.json({ ok: true })
  } catch {
    // No fallar silenciosamente — el typing no es crítico
    return NextResponse.json({ ok: true })
  }
}

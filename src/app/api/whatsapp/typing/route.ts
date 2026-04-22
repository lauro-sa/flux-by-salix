import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { enviarTypingWhatsApp, type ConfigCuentaWhatsApp } from '@/lib/whatsapp'

/**
 * POST /api/whatsapp/typing — Enviar indicador "escribiendo..." al cliente.
 * Body: { conversacion_id }
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
      .select('identificador_externo, canal_id')
      .eq('id', conversacion_id)
      .single()

    if (!conversacion?.identificador_externo) {
      return NextResponse.json({ error: 'Sin número' }, { status: 400 })
    }

    const { data: canal } = await admin
      .from('canales_whatsapp')
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

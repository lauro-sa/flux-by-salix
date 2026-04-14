import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerCalidadNumero, type ConfigCuentaWhatsApp } from '@/lib/whatsapp'

/**
 * GET /api/whatsapp/calidad — Obtener calidad del número de WhatsApp.
 * Devuelve: rating (GREEN/YELLOW/RED), tier, status.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const canalId = request.nextUrl.searchParams.get('canal_id')
    if (!canalId) return NextResponse.json({ error: 'canal_id es requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    const { data: canal } = await admin
      .from('canales_inbox')
      .select('id, config_conexion')
      .eq('id', canalId)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
    const calidad = await obtenerCalidadNumero(config)

    // Cachear resultado en config del canal
    await admin
      .from('canales_inbox')
      .update({
        config_conexion: {
          ...(canal.config_conexion as Record<string, unknown>),
          calidadActual: {
            rating: calidad.quality_rating,
            tier: calidad.messaging_limit_tier,
            status: calidad.status,
            actualizadoEn: new Date().toISOString(),
          },
        },
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', canalId)

    return NextResponse.json({ calidad })
  } catch (err) {
    console.error('Error al obtener calidad:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

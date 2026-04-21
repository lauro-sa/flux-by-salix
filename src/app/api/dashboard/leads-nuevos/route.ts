import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/dashboard/leads-nuevos
 * Contactos provisorios creados recientemente (típicamente por el agente IA de
 * WhatsApp) que están pendientes de confirmar/atender.
 * Filtros: últimos 7 días, es_provisorio=true, origen relacionado a canales
 * (whatsapp, whatsapp_ia, chatbot). Limita a 10 para el widget.
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Total provisorios recientes (para el contador del widget)
    const { count: total } = await admin
      .from('contactos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .eq('es_provisorio', true)
      .gte('creado_en', hace7Dias)

    // Lista compacta
    const { data: leads } = await admin
      .from('contactos')
      .select('id, nombre, apellido, telefono, whatsapp, origen, creado_en')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .eq('es_provisorio', true)
      .gte('creado_en', hace7Dias)
      .order('creado_en', { ascending: false })
      .limit(5)

    return NextResponse.json({
      leads: leads || [],
      total: total || 0,
    })
  } catch (err) {
    console.error('Error en GET /api/dashboard/leads-nuevos:', err)
    return NextResponse.json({ error: 'Error al cargar leads nuevos' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/chatbot — Obtener configuración del chatbot de la empresa.
 * PUT /api/inbox/chatbot — Guardar configuración del chatbot.
 */

export async function GET() {
  try {
    const guard = await requerirPermisoAPI('config_correo', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()
    const { data } = await admin
      .from('config_chatbot')
      .select('*')
      .eq('empresa_id', empresaId)
      .single()

    return NextResponse.json({ config: data || null })
  } catch (err) {
    console.error('Error al obtener config chatbot:', err)
    return NextResponse.json({ config: null })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('config_chatbot')
      .upsert({
        empresa_id: empresaId,
        ...body,
        actualizado_en: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Si se desactivó el chatbot globalmente, desactivar en todas las conversaciones
    // para que al reactivarlo no mande mensajes inesperados a conversaciones viejas
    if (body.activo === false) {
      await admin
        .from('conversaciones')
        .update({
          chatbot_activo: false,
          chatbot_pausado_hasta: null,
          chatbot_pausado_motivo: 'sistema',
          chatbot_pausado_en: new Date().toISOString(),
          chatbot_pausado_por: null,
        })
        .eq('empresa_id', empresaId)
        .eq('chatbot_activo', true)
    }

    return NextResponse.json({ config: data })
  } catch (err) {
    console.error('Error al guardar config chatbot:', err)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}

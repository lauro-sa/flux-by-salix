import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/inbox/internos/[id]/lecturas — Marcar mensajes como leídos en un canal.
 * Body: { mensaje_ids?: string[] }
 * Si no se envían IDs, marca todos los mensajes del canal como leídos.
 * También actualiza ultimo_leido_en en canal_interno_miembros.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: canalId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json().catch(() => ({}))

    // Obtener la conversación del canal interno
    const { data: conv } = await admin
      .from('conversaciones')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('canal_interno_id', canalId)
      .eq('tipo_canal', 'interno')
      .maybeSingle()

    if (!conv) return NextResponse.json({ ok: true, marcados: 0 })

    let mensajeIds: string[] = body.mensaje_ids || []

    // Si no se enviaron IDs, obtener todos los mensajes sin lectura del usuario
    if (mensajeIds.length === 0) {
      const { data: mensajesSinLeer } = await admin
        .from('mensajes')
        .select('id')
        .eq('conversacion_id', conv.id)
        .eq('empresa_id', empresaId)
        .is('eliminado_en', null)
        .limit(500)

      if (mensajesSinLeer) {
        mensajeIds = mensajesSinLeer.map(m => m.id)
      }
    }

    if (mensajeIds.length === 0) return NextResponse.json({ ok: true, marcados: 0 })

    // Upsert lecturas (ignorar conflictos si ya existen)
    const lecturas = mensajeIds.map(mid => ({
      mensaje_id: mid,
      usuario_id: user.id,
      leido_en: new Date().toISOString(),
    }))

    await admin
      .from('mensaje_lecturas')
      .upsert(lecturas, { onConflict: 'mensaje_id,usuario_id' })

    // Actualizar ultimo_leido_en en canal_interno_miembros
    await admin
      .from('canal_interno_miembros')
      .update({ ultimo_leido_en: new Date().toISOString() })
      .eq('canal_id', canalId)
      .eq('usuario_id', user.id)

    return NextResponse.json({ ok: true, marcados: mensajeIds.length })
  } catch (err) {
    console.error('Error al marcar lecturas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

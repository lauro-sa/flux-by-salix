import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * POST /api/inbox/conversaciones/[id]/silenciar — Silenciar conversación para el usuario actual.
 * Inserta en conversacion_silencios.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Upsert para evitar duplicados
    const { data, error } = await admin
      .from('conversacion_silencios')
      .upsert(
        {
          empresa_id: empresaId,
          conversacion_id: id,
          usuario_id: user.id,
        },
        { onConflict: 'conversacion_id,usuario_id' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ silencio: data }, { status: 201 })
  } catch (err) {
    console.error('Error al silenciar conversación:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/conversaciones/[id]/silenciar — Quitar silencio para el usuario actual.
 * Elimina de conversacion_silencios.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { error } = await admin
      .from('conversacion_silencios')
      .delete()
      .eq('conversacion_id', id)
      .eq('usuario_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al quitar silencio:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/inbox/conversaciones/[id]/pins — Verificar si el usuario tiene fijada esta conversación.
 * Acepta ?usuario_id=xxx para que admins consulten por otro usuario.
 */
export async function GET(
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

    // Permitir consultar por otro usuario (para admins)
    const usuarioId = request.nextUrl.searchParams.get('usuario_id') || user.id

    const { data, error } = await admin
      .from('conversacion_pins')
      .select('id, conversacion_id, usuario_id, creado_en')
      .eq('conversacion_id', id)
      .eq('usuario_id', usuarioId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ fijada: !!data, pin: data })
  } catch (err) {
    console.error('Error al consultar pin:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/inbox/conversaciones/[id]/pins — Fijar conversación.
 * Body opcional: { usuario_id?: string } para que admins fijen para otro usuario.
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
    const body = await request.json().catch(() => ({}))
    const usuarioId = body.usuario_id || user.id

    // Upsert para evitar duplicados
    const { data, error } = await admin
      .from('conversacion_pins')
      .upsert(
        {
          empresa_id: empresaId,
          conversacion_id: id,
          usuario_id: usuarioId,
        },
        { onConflict: 'conversacion_id,usuario_id' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ pin: data }, { status: 201 })
  } catch (err) {
    console.error('Error al fijar conversación:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/conversaciones/[id]/pins — Desfijar conversación.
 * Query param opcional: ?usuario_id=xxx para que admins desfijen para otro usuario.
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
    const usuarioId = request.nextUrl.searchParams.get('usuario_id') || user.id

    const { error } = await admin
      .from('conversacion_pins')
      .delete()
      .eq('conversacion_id', id)
      .eq('usuario_id', usuarioId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al desfijar conversación:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

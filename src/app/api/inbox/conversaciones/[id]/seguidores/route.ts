import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/inbox/conversaciones/[id]/seguidores — Listar seguidores de la conversación.
 * Hace join con perfiles para obtener nombre y avatar.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('conversacion_seguidores')
      .select(`
        id, conversacion_id, usuario_id, creado_en,
        perfil:perfiles!usuario_id(id, nombre, apellido, avatar_url)
      `)
      .eq('conversacion_id', id)
      .eq('empresa_id', empresaId)

    if (error) throw error

    return NextResponse.json({ seguidores: data || [] })
  } catch (err) {
    console.error('Error al listar seguidores:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/inbox/conversaciones/[id]/seguidores — Seguir conversación (usuario actual).
 * Inserta en conversacion_seguidores.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Upsert para evitar duplicados
    const { data, error } = await admin
      .from('conversacion_seguidores')
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

    return NextResponse.json({ seguidor: data }, { status: 201 })
  } catch (err) {
    console.error('Error al seguir conversación:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/conversaciones/[id]/seguidores — Dejar de seguir conversación (usuario actual).
 * Elimina de conversacion_seguidores.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { error } = await admin
      .from('conversacion_seguidores')
      .delete()
      .eq('conversacion_id', id)
      .eq('usuario_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al dejar de seguir:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

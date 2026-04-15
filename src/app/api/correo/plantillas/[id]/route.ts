import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/correo/plantillas/[id] — Actualizar plantilla de correo.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('plantillas_correo')
      .update({ ...body, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plantilla: data })
  } catch (err) {
    console.error('Error al actualizar plantilla de correo:', err)
    return NextResponse.json({ error: 'Error al actualizar plantilla de correo' }, { status: 500 })
  }
}

/**
 * DELETE /api/correo/plantillas/[id] — Eliminar plantilla de correo.
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
      .from('plantillas_correo')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar plantilla de correo:', err)
    return NextResponse.json({ error: 'Error al eliminar plantilla de correo' }, { status: 500 })
  }
}

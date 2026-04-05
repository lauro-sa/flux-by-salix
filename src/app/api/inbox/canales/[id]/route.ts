import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/inbox/canales/[id] — Actualizar un canal.
 */
export async function PATCH(
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

    const body = await request.json()
    const camposPermitidos = ['nombre', 'activo', 'config_conexion', 'estado_conexion', 'ultimo_error', 'modulos_disponibles', 'es_principal']
    const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() }

    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) cambios[campo] = body[campo]
    }

    const admin = crearClienteAdmin()

    // Si se marca como principal, desmarcar el anterior
    if (body.es_principal === true) {
      await admin
        .from('canales_inbox')
        .update({ es_principal: false })
        .eq('empresa_id', empresaId)
        .eq('tipo', 'correo')
        .eq('es_principal', true)
        .neq('id', id)
    }

    const { data, error } = await admin
      .from('canales_inbox')
      .update(cambios)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ canal: data })
  } catch (err) {
    console.error('Error al actualizar canal:', err)
    return NextResponse.json({ error: 'Error al actualizar canal' }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/canales/[id] — Eliminar un canal.
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
      .from('canales_inbox')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar canal:', err)
    return NextResponse.json({ error: 'Error al eliminar canal' }, { status: 500 })
  }
}

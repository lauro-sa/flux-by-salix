import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/inbox/internos/[id] — Editar canal/grupo interno.
 * Solo admins del canal (rol='admin' en canal_interno_miembros).
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

    const admin = crearClienteAdmin()

    // Verificar que el canal existe y pertenece a la empresa
    const { data: canal } = await admin
      .from('canales_internos')
      .select('id, tipo, creado_por')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    // Verificar que el usuario es admin del canal
    const { data: miembro } = await admin
      .from('canal_interno_miembros')
      .select('rol')
      .eq('canal_id', id)
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (miembro?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden editar el canal' }, { status: 403 })
    }

    const body = await request.json()
    const camposPermitidos = ['nombre', 'descripcion', 'icono', 'color']
    const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() }

    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) cambios[campo] = body[campo]
    }

    const { data, error } = await admin
      .from('canales_internos')
      .update(cambios)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ canal: data })
  } catch (err) {
    console.error('Error al editar canal interno:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/internos/[id] — Archivar canal/grupo interno.
 * Canales: solo admins. Grupos: solo el creador.
 * Los DMs no se pueden eliminar.
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

    const { data: canal } = await admin
      .from('canales_internos')
      .select('id, tipo, creado_por')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    // Verificar permisos según tipo
    const { data: miembro } = await admin
      .from('canal_interno_miembros')
      .select('rol')
      .eq('canal_id', id)
      .eq('usuario_id', user.id)
      .maybeSingle()

    const puedeEliminar =
      canal.tipo === 'directo' || // DMs: cualquier participante puede archivar
      (canal.tipo === 'grupo' && canal.creado_por === user.id) ||
      (['publico', 'privado'].includes(canal.tipo) && miembro?.rol === 'admin')

    if (!puedeEliminar) {
      return NextResponse.json({ error: 'Sin permiso para eliminar este canal' }, { status: 403 })
    }

    // Soft delete (archivar)
    await admin
      .from('canales_internos')
      .update({ archivado: true, actualizado_en: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar canal interno:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

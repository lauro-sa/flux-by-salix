import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

type Contexto = { params: Promise<{ id: string }> }

/**
 * PATCH /api/recorrido/[id] — Restaurar recorrido desde papelera.
 */
export async function PATCH(request: NextRequest, { params }: Contexto) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()

    if (body.en_papelera === false) {
      const admin = crearClienteAdmin()
      const { error } = await admin
        .from('recorridos')
        .update({ en_papelera: false, papelera_en: null })
        .eq('id', id)
        .eq('empresa_id', empresaId)

      if (error) return NextResponse.json({ error: 'Error al restaurar recorrido' }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Operación no soportada' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/recorrido/[id] — Eliminar recorrido (two-phase).
 * Primera vez: soft delete (en_papelera = true).
 * Si ya está en papelera: hard delete definitivo (cascade borra paradas).
 */
export async function DELETE(_request: NextRequest, { params }: Contexto) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'eliminar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para eliminar recorridos' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Verificar que el recorrido existe y su estado de papelera
    const { data: recorrido } = await admin
      .from('recorridos')
      .select('id, en_papelera')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!recorrido) return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })

    if (recorrido.en_papelera) {
      // Ya en papelera → eliminar definitivamente (cascade borra paradas)
      const { error } = await admin
        .from('recorridos')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId)

      if (error) return NextResponse.json({ error: 'Error al eliminar recorrido definitivamente' }, { status: 500 })
      return NextResponse.json({ ok: true, accion: 'eliminado_definitivo' })
    }

    // Primera vez → soft delete
    const { error } = await admin
      .from('recorridos')
      .update({
        en_papelera: true,
        papelera_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: 'Error al eliminar recorrido' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

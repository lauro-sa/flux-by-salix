import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET/PUT/DELETE /api/inbox/agente-ia/base-conocimiento/[id]
 * CRUD individual para una entrada de la base de conocimiento.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('config_correo', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('base_conocimiento_ia')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json({ entrada: data })
  } catch (err) {
    console.error('Error al obtener entrada:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('base_conocimiento_ia')
      .update({
        ...body,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ entrada: data })
  } catch (err) {
    console.error('Error al actualizar entrada:', err)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()
    const { error } = await admin
      .from('base_conocimiento_ia')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar entrada:', err)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}

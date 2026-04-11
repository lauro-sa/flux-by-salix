import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/inbox/mensajes/[id] — Editar texto de un mensaje (solo notas internas).
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

    const { texto } = await request.json()
    if (!texto?.trim()) {
      return NextResponse.json({ error: 'El texto no puede estar vacío' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el mensaje es nota interna y pertenece a la empresa
    const { data: mensaje } = await admin
      .from('mensajes')
      .select('id, es_nota_interna, remitente_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!mensaje) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })
    }

    if (!mensaje.es_nota_interna) {
      return NextResponse.json({ error: 'Solo se pueden editar notas internas' }, { status: 403 })
    }

    // Actualizar texto
    const { data, error } = await admin
      .from('mensajes')
      .update({
        texto: texto.trim(),
        editado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, adjuntos:mensaje_adjuntos(*)')
      .single()

    if (error) throw error
    return NextResponse.json({ mensaje: data })
  } catch (err) {
    console.error('Error al editar mensaje:', err)
    return NextResponse.json({ error: 'Error al editar mensaje' }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/mensajes/[id] — Eliminar un mensaje (solo notas internas, soft delete).
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

    // Verificar que el mensaje es nota interna
    const { data: mensaje } = await admin
      .from('mensajes')
      .select('id, es_nota_interna')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!mensaje) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })
    }

    if (!mensaje.es_nota_interna) {
      return NextResponse.json({ error: 'Solo se pueden eliminar notas internas' }, { status: 403 })
    }

    // Soft delete
    const { error } = await admin
      .from('mensajes')
      .update({ eliminado_en: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar mensaje:', err)
    return NextResponse.json({ error: 'Error al eliminar mensaje' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/inbox/internos/[id]/silenciar — Toggle silenciar canal para el usuario actual.
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

    // Verificar que el canal pertenece a la empresa
    const { data: canal } = await admin
      .from('canales_internos')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    // Obtener estado actual de silenciado
    const { data: miembro } = await admin
      .from('canal_interno_miembros')
      .select('silenciado')
      .eq('canal_id', id)
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (!miembro) {
      return NextResponse.json({ error: 'No sos miembro de este canal' }, { status: 404 })
    }

    const nuevoEstado = !miembro.silenciado

    await admin
      .from('canal_interno_miembros')
      .update({ silenciado: nuevoEstado })
      .eq('canal_id', id)
      .eq('usuario_id', user.id)

    return NextResponse.json({ silenciado: nuevoEstado })
  } catch (err) {
    console.error('Error al silenciar canal:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

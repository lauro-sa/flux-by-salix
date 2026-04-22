import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
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
    const guard = await requerirPermisoAPI('inbox_interno', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

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

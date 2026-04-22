import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/inbox/internos/[id]/conversacion — Asegurar que existe una conversación
 * para este canal interno. Si no existe, la crea.
 * Retorna la conversación (existente o nueva).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: canalInternoId } = await params
    const guard = await requerirPermisoAPI('inbox_interno', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    // Verificar que el canal interno existe y pertenece a la empresa
    const { data: canal } = await admin
      .from('canales_internos')
      .select('id, nombre, tipo')
      .eq('id', canalInternoId)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!canal) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    // Buscar conversación existente para este canal interno
    const { data: convExistente } = await admin
      .from('conversaciones')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('canal_interno_id', canalInternoId)
      .eq('tipo_canal', 'interno')
      .maybeSingle()

    if (convExistente) {
      return NextResponse.json({ conversacion: convExistente })
    }

    // Crear nueva conversación vinculada al canal interno
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .maybeSingle()
    const nombreRemitente = `${perfil?.nombre || ''} ${perfil?.apellido || ''}`.trim()
    const { data: nuevaConv, error } = await admin
      .from('conversaciones')
      .insert({
        empresa_id: empresaId,
        tipo_canal: 'interno',
        canal_interno_id: canalInternoId,
        contacto_nombre: canal.nombre,
        asunto: canal.nombre,
        estado: 'abierta',
        asignado_a: user.id,
        asignado_a_nombre: nombreRemitente,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ conversacion: nuevaConv }, { status: 201 })
  } catch (err) {
    console.error('Error al asegurar conversación interna:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

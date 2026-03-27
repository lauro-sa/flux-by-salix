import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/conversaciones/[id] — Detalle de una conversación.
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
      .from('conversaciones')
      .select(`
        *,
        canal:canales_inbox!canal_id(id, nombre, tipo, proveedor, estado_conexion)
      `)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ conversacion: data })
  } catch (err) {
    console.error('Error al obtener conversación:', err)
    return NextResponse.json({ error: 'Error al obtener conversación' }, { status: 500 })
  }
}

/**
 * PATCH /api/inbox/conversaciones/[id] — Actualizar conversación.
 * Se usa para: cambiar estado, asignar agente, cambiar prioridad, vincular contacto.
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
    const camposPermitidos = [
      'estado', 'prioridad', 'asignado_a', 'asignado_a_nombre',
      'contacto_id', 'contacto_nombre', 'asunto', 'etiquetas',
    ]
    const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() }

    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) {
        cambios[campo] = body[campo]
      }
    }

    // Si se cierra la conversación
    if (body.estado === 'resuelta') {
      cambios.cerrado_en = new Date().toISOString()
      cambios.cerrado_por = user.id
    }

    const admin = crearClienteAdmin()

    // Registrar asignación si cambió el agente
    if (body.asignado_a !== undefined) {
      await admin.from('asignaciones_inbox').insert({
        empresa_id: empresaId,
        conversacion_id: id,
        usuario_id: body.asignado_a,
        usuario_nombre: body.asignado_a_nombre || null,
        tipo: body.tipo_asignacion || 'manual',
        asignado_por: user.id,
        asignado_por_nombre: `${user.user_metadata?.nombre || ''} ${user.user_metadata?.apellido || ''}`.trim(),
        notas: body.notas_asignacion || null,
      })
    }

    const { data, error } = await admin
      .from('conversaciones')
      .update(cambios)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ conversacion: data })
  } catch (err) {
    console.error('Error al actualizar conversación:', err)
    return NextResponse.json({ error: 'Error al actualizar conversación' }, { status: 500 })
  }
}

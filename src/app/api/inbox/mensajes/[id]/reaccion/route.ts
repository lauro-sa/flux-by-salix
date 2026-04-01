import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/inbox/mensajes/[id]/reaccion — Toggle reacción en un mensaje.
 * Body: { emoji: string }
 * Si el usuario ya reaccionó con ese emoji, lo quita. Si no, lo agrega.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mensajeId } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { emoji } = body
    if (!emoji || typeof emoji !== 'string') {
      return NextResponse.json({ error: 'emoji es requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener mensaje actual
    const { data: mensaje } = await admin
      .from('mensajes')
      .select('id, reacciones, empresa_id')
      .eq('id', mensajeId)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!mensaje) return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })

    // Toggle reacción
    const reacciones = (mensaje.reacciones || {}) as Record<string, string[]>
    const usuarios = reacciones[emoji] || []
    const yaReacciono = usuarios.includes(user.id)

    if (yaReacciono) {
      // Quitar reacción
      reacciones[emoji] = usuarios.filter(uid => uid !== user.id)
      if (reacciones[emoji].length === 0) delete reacciones[emoji]
    } else {
      // Agregar reacción
      reacciones[emoji] = [...usuarios, user.id]
    }

    // Guardar
    const { error } = await admin
      .from('mensajes')
      .update({ reacciones })
      .eq('id', mensajeId)

    if (error) throw error

    return NextResponse.json({ reacciones, accion: yaReacciono ? 'quitada' : 'agregada' })
  } catch (err) {
    console.error('Error al reaccionar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

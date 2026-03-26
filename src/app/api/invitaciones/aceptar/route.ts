import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/invitaciones/aceptar — Aceptar una invitación.
 * Valida el token, crea el miembro con activo=false,
 * y marca la invitación como usada.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Debés iniciar sesión primero' }, { status: 401 })
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token es obligatorio' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Buscar y validar invitación
    const { data: invitacion } = await admin
      .from('invitaciones')
      .select('*, empresas(nombre, slug)')
      .eq('token', token)
      .single()

    if (!invitacion) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
    }

    if (invitacion.usado) {
      return NextResponse.json({ error: 'Esta invitación ya fue utilizada' }, { status: 410 })
    }

    if (new Date(invitacion.expira_en) < new Date()) {
      return NextResponse.json({ error: 'Esta invitación expiró' }, { status: 410 })
    }

    // Verificar que no sea ya miembro
    const { data: miembroExistente } = await admin
      .from('miembros')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', invitacion.empresa_id)
      .single()

    if (miembroExistente) {
      return NextResponse.json({ error: 'Ya sos miembro de esta empresa' }, { status: 409 })
    }

    // Crear miembro con activo=false (espera activación del admin)
    const { error: errorMiembro } = await admin
      .from('miembros')
      .insert({
        usuario_id: user.id,
        empresa_id: invitacion.empresa_id,
        rol: invitacion.rol,
        activo: false,
      })

    if (errorMiembro) {
      return NextResponse.json({ error: 'Error al unirse a la empresa' }, { status: 500 })
    }

    // Marcar invitación como usada
    await admin
      .from('invitaciones')
      .update({ usado: true })
      .eq('id', invitacion.id)

    return NextResponse.json({
      mensaje: 'Te uniste a la empresa. Un administrador debe activar tu cuenta.',
      empresa: invitacion.empresas,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

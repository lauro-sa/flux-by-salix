import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/reset-password — Envía email de reseteo de contraseña.
 * Solo propietario o administrador puede hacerlo.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    const { miembro_id } = await request.json()

    // Obtener el usuario_id del miembro
    const { data: miembro } = await admin
      .from('miembros')
      .select('usuario_id')
      .eq('id', miembro_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    // Obtener el email del usuario
    const { data: userData } = await admin.auth.admin.getUserById(miembro.usuario_id)
    if (!userData?.user?.email) {
      return NextResponse.json({ error: 'Usuario sin correo' }, { status: 400 })
    }

    // Enviar email de reseteo
    const { error } = await admin.auth.resetPasswordForEmail(userData.user.email, {
      redirectTo: `${request.nextUrl.origin}/restablecer`,
    })

    if (error) {
      return NextResponse.json({ error: 'Error al enviar el correo' }, { status: 500 })
    }

    return NextResponse.json({ mensaje: 'Correo de reseteo enviado', correo: userData.user.email })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/forzar-password — Obliga al empleado a cambiar su contraseña.
 *
 * Cierra todas sus sesiones activas y le envía un correo de recuperación. El
 * empleado queda fuera de Flux hasta que abra el link y defina una nueva pass.
 * El admin nunca conoce la contraseña (auditoría y seguridad multi-tenant).
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId, miembro: miembroActual } = guard

    const admin = crearClienteAdmin()

    const { miembro_id } = await request.json()

    const { data: miembro } = await admin
      .from('miembros')
      .select('usuario_id, rol')
      .eq('id', miembro_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro || !miembro.usuario_id) {
      return NextResponse.json({ error: 'Miembro no encontrado o sin cuenta' }, { status: 404 })
    }

    if (miembro.rol === 'propietario' && miembroActual.rol !== 'propietario') {
      return NextResponse.json({ error: 'No se puede forzar cambio al propietario' }, { status: 403 })
    }

    const { data: userData } = await admin.auth.admin.getUserById(miembro.usuario_id)
    if (!userData?.user?.email) {
      return NextResponse.json({ error: 'Usuario sin correo asociado' }, { status: 400 })
    }

    // Cerrar todas las sesiones activas: obliga al logout inmediato.
    const { error: errSignOut } = await admin.auth.admin.signOut(miembro.usuario_id, 'global')
    if (errSignOut) {
      return NextResponse.json({ error: 'Error al cerrar sesiones' }, { status: 500 })
    }

    // Enviar correo de recuperación para que el empleado defina una pass nueva.
    const { error: errReset } = await admin.auth.resetPasswordForEmail(userData.user.email, {
      redirectTo: `${request.nextUrl.origin}/restablecer`,
    })

    if (errReset) {
      return NextResponse.json({ error: 'Error al enviar el correo de cambio' }, { status: 500 })
    }

    return NextResponse.json({
      mensaje: 'Sesiones cerradas y correo enviado',
      correo: userData.user.email,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

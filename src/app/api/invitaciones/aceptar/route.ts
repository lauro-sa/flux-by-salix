import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { vincularOCrearContactoEquipo } from '@/lib/contactos/contacto-equipo'

/**
 * POST /api/invitaciones/aceptar — Aceptar una invitación.
 * Valida el token, crea el miembro con activo=false,
 * crea/vincula un contacto tipo "equipo", y marca la invitación como usada.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()

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

    // Crear miembro — activo=true porque la invitación ya fue aprobada por el admin
    const { data: miembro, error: errorMiembro } = await admin
      .from('miembros')
      .insert({
        usuario_id: user.id,
        empresa_id: invitacion.empresa_id,
        rol: invitacion.rol,
        activo: true,
      })
      .select('id')
      .single()

    if (errorMiembro || !miembro) {
      return NextResponse.json({ error: 'Error al unirse a la empresa' }, { status: 500 })
    }

    // Crear o vincular contacto tipo "equipo" para este miembro
    await vincularOCrearContactoEquipo(admin, {
      miembroId: miembro.id,
      empresaId: invitacion.empresa_id,
      correo: invitacion.correo || user.email || '',
      nombre: user.user_metadata?.nombre_completo || user.email?.split('@')[0] || '',
      usuarioId: user.id,
    })

    // Marcar invitación como usada
    await admin
      .from('invitaciones')
      .update({ usado: true })
      .eq('id', invitacion.id)

    // Setear empresa activa en JWT para que el middleware redirija al dashboard
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { empresa_activa_id: invitacion.empresa_id },
    })

    return NextResponse.json({
      mensaje: 'Te uniste a la empresa.',
      empresa: invitacion.empresas,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

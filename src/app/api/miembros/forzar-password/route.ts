import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/forzar-password — Fuerza una nueva contraseña para un miembro.
 * Solo propietario puede hacerlo.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) {
      return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
    }

    const admin = crearClienteAdmin()

    // Propietario o administrador pueden forzar contraseñas
    const { data: miembroActual } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroActual || !['propietario', 'administrador'].includes(miembroActual.rol)) {
      return NextResponse.json({ error: 'Sin permisos para forzar contraseñas' }, { status: 403 })
    }

    const { miembro_id, nueva_password } = await request.json()

    if (!nueva_password || nueva_password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    // Obtener usuario_id del miembro
    const { data: miembro } = await admin
      .from('miembros')
      .select('usuario_id, rol')
      .eq('id', miembro_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    if (miembro.rol === 'propietario') {
      return NextResponse.json({ error: 'No se puede forzar contraseña del propietario' }, { status: 403 })
    }

    // Forzar nueva contraseña
    const { error } = await admin.auth.admin.updateUserById(miembro.usuario_id, {
      password: nueva_password,
    })

    if (error) {
      return NextResponse.json({ error: 'Error al cambiar la contraseña' }, { status: 500 })
    }

    return NextResponse.json({ mensaje: 'Contraseña actualizada' })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

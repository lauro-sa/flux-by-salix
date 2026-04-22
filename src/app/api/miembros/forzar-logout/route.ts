import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/forzar-logout — Cierra todas las sesiones de un miembro.
 * Solo propietario o administrador puede hacerlo.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId, miembro: miembroActual } = guard

    const admin = crearClienteAdmin()

    const { miembro_id } = await request.json()

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

    if (miembro.rol === 'propietario' && miembroActual.rol !== 'propietario') {
      return NextResponse.json({ error: 'No se puede cerrar sesión del propietario' }, { status: 403 })
    }

    // Cerrar todas las sesiones del usuario
    const { error } = await admin.auth.admin.signOut(miembro.usuario_id, 'global')

    if (error) {
      return NextResponse.json({ error: 'Error al cerrar sesión' }, { status: 500 })
    }

    return NextResponse.json({ mensaje: 'Sesiones cerradas' })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/forzar-logout — Cierra todas las sesiones de un miembro.
 * Solo propietario o administrador puede hacerlo.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) {
      return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
    }

    const admin = crearClienteAdmin()

    // Verificar permiso
    const { data: miembroActual } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroActual || !['propietario', 'administrador'].includes(miembroActual.rol)) {
      return NextResponse.json({ error: 'No tenés permiso' }, { status: 403 })
    }

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

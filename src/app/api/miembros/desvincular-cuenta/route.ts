import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/desvincular-cuenta — Pasa a un miembro con cuenta Flux
 * a estado "Solo fichaje": le quita el `usuario_id`, preserva todos los
 * datos del empleado (legajo, RFID, turno, fichadas, compensación, sector,
 * puesto, contacto vinculado, etc.) y elimina la cuenta `auth.users` asociada
 * si nunca fue usada (last_sign_in_at IS NULL).
 *
 * Caso de uso principal: empleados migrados desde otro software que tienen
 * una cuenta generada automáticamente pero que nunca la usaron. Al
 * desvincular, el admin puede enviarles invitación de nuevo y ellos se
 * registrarán frescos, vinculándose al mismo miembro.
 *
 * Body: { miembro_id }
 *   Opcional { forzar: true } — permite desvincular aunque ya haya iniciado
 *   sesión (caso excepcional: admin sabe que ya no va a usar la cuenta).
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const { miembro_id, forzar = false } = await request.json()
    if (!miembro_id) {
      return NextResponse.json({ error: 'miembro_id es obligatorio' }, { status: 400 })
    }

    // Buscar el miembro objetivo
    const { data: miembro } = await admin
      .from('miembros')
      .select('id, usuario_id, rol')
      .eq('id', miembro_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }
    if (!miembro.usuario_id) {
      return NextResponse.json({ error: 'Este empleado ya está en solo fichaje' }, { status: 400 })
    }
    if (miembro.rol === 'propietario') {
      return NextResponse.json({ error: 'No se puede desvincular la cuenta del propietario' }, { status: 403 })
    }
    if (miembro.usuario_id === user.id) {
      return NextResponse.json({ error: 'No podés desvincular tu propia cuenta' }, { status: 400 })
    }

    // Chequear si la cuenta fue usada (excepto si se pasa forzar: true)
    const { data: authUser } = await admin.auth.admin.getUserById(miembro.usuario_id)
    const nuncaInicioSesion = !authUser?.user?.last_sign_in_at

    if (!nuncaInicioSesion && !forzar) {
      return NextResponse.json({
        error: 'Este empleado ya inició sesión en Flux. Usá "forzar" si igual querés desvincular su cuenta.',
        requiere_forzar: true,
      }, { status: 400 })
    }

    // Verificar si el usuario tiene miembros en otras empresas — si sí, NO
    // eliminamos auth.users (está vinculado a otros lados). Solo desvinculamos
    // este miembro.
    const { data: otrosMiembros } = await admin
      .from('miembros')
      .select('id')
      .eq('usuario_id', miembro.usuario_id)
      .neq('id', miembro.id)

    const tieneOtrasEmpresas = (otrosMiembros || []).length > 0

    // 1. Desvincular usuario_id del miembro
    const { error: errMiembro } = await admin
      .from('miembros')
      .update({ usuario_id: null })
      .eq('id', miembro.id)

    if (errMiembro) {
      return NextResponse.json({ error: 'Error al desvincular el miembro' }, { status: 500 })
    }

    // 2. Si no tiene otras empresas, eliminar auth.users (cascada borra perfil)
    if (!tieneOtrasEmpresas) {
      await admin.auth.admin.deleteUser(miembro.usuario_id)
    }

    return NextResponse.json({
      mensaje: nuncaInicioSesion
        ? 'Empleado pasado a solo fichaje. Su cuenta anterior fue eliminada.'
        : 'Empleado pasado a solo fichaje.',
      cuenta_eliminada: !tieneOtrasEmpresas,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

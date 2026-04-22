import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/desvincular-cuenta — Pasa a un miembro a estado
 * "Solo fichaje" de forma NO destructiva.
 *
 * Qué hace:
 *   - Guarda el `usuario_id` actual en `usuario_id_anterior` (backup).
 *   - Setea `usuario_id = null` en miembros (le quita el acceso a la app).
 *   - Cierra todas las sesiones activas de esa cuenta auth (signOut global).
 *
 * Qué NO hace (intencional):
 *   - NO elimina la cuenta `auth.users`.
 *   - NO elimina el perfil.
 *   - NO toca el contacto vinculado, datos laborales, RFID, fichadas, etc.
 *
 * El miembro mantiene todos sus datos de empleado (legajo, sector, puesto,
 * compensación, foto kiosco, RFID, PIN, fichadas, etc.) y puede reactivarse
 * desde `/api/miembros/reactivar-cuenta` restaurando el vínculo.
 *
 * Body: { miembro_id }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const { miembro_id } = await request.json()
    if (!miembro_id) {
      return NextResponse.json({ error: 'miembro_id es obligatorio' }, { status: 400 })
    }

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

    // Guardar backup + nullear vínculo. La cuenta auth y el perfil quedan intactos.
    const { error: errMiembro } = await admin
      .from('miembros')
      .update({ usuario_id: null, usuario_id_anterior: miembro.usuario_id })
      .eq('id', miembro.id)

    if (errMiembro) {
      return NextResponse.json({ error: 'Error al desvincular el miembro' }, { status: 500 })
    }

    // Cerrar todas las sesiones activas: la próxima request del empleado dará 401.
    await admin.auth.admin.signOut(miembro.usuario_id, 'global')

    return NextResponse.json({
      mensaje: 'Empleado pasado a solo fichaje. Sus datos se preservaron y podés reactivarlo cuando quieras.',
      reactivable: true,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'

/**
 * DELETE /api/empresas/eliminar — Eliminar empresa.
 * Solo el propietario puede hacerlo: RESTRICCIONES_ADMIN bloquea a admins.
 * Elimina en cascada: miembros, invitaciones, sectores, puestos, horarios.
 */
export async function DELETE() {
  try {
    const guard = await requerirPermisoAPI('config_empresa', 'eliminar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    // Eliminar empresa (cascade elimina miembros, invitaciones, sectores, etc.)
    const { error } = await admin
      .from('empresas')
      .delete()
      .eq('id', empresaId)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    // Limpiar empresa activa del usuario
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { empresa_activa_id: null },
    })

    return NextResponse.json({ mensaje: 'Empresa eliminada' })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

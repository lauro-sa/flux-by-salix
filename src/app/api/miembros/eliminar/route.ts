import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * DELETE /api/miembros/eliminar — Elimina un miembro de la empresa.
 * Solo propietario puede hacerlo. No elimina el usuario de auth,
 * solo lo remueve de la empresa (puede pertenecer a otras).
 */
export async function DELETE(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'eliminar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId, miembro: miembroActual } = guard

    const admin = crearClienteAdmin()

    const { miembro_id } = await request.json()

    // Verificar que el miembro existe y no es el propietario
    const { data: miembro } = await admin
      .from('miembros')
      .select('id, rol, usuario_id')
      .eq('id', miembro_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    if (miembro.rol === 'propietario') {
      return NextResponse.json({ error: 'No se puede eliminar al propietario' }, { status: 403 })
    }

    // Un administrador no puede eliminar a otro administrador
    if (miembroActual.rol === 'administrador' && miembro.rol === 'administrador') {
      return NextResponse.json({ error: 'Un administrador no puede eliminar a otro administrador' }, { status: 403 })
    }

    // Eliminar relaciones dependientes
    await admin.from('miembros_sectores').delete().eq('miembro_id', miembro_id)
    await admin.from('contactos_emergencia').delete().eq('miembro_id', miembro_id)
    await admin.from('info_bancaria').delete().eq('miembro_id', miembro_id)
    await admin.from('educacion_usuario').delete().eq('miembro_id', miembro_id)
    await admin.from('documentos_usuario').delete().eq('miembro_id', miembro_id)
    await admin.from('pagos_nomina').delete().eq('miembro_id', miembro_id)

    // Eliminar el miembro
    const { error } = await admin
      .from('miembros')
      .delete()
      .eq('id', miembro_id)

    if (error) {
      return NextResponse.json({ error: 'Error al eliminar el miembro' }, { status: 500 })
    }

    return NextResponse.json({ mensaje: 'Miembro eliminado de la empresa' })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

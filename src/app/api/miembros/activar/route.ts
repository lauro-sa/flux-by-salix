import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/miembros/activar — Activar o desactivar un miembro.
 * Solo propietario o administrador de la misma empresa pueden hacerlo.
 */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    const { miembro_id, activo } = await request.json()

    if (!miembro_id || typeof activo !== 'boolean') {
      return NextResponse.json({ error: 'miembro_id y activo son obligatorios' }, { status: 400 })
    }

    // Verificar que el miembro pertenece a la misma empresa
    const { data: miembroObjetivo } = await admin
      .from('miembros')
      .select('id, usuario_id, rol')
      .eq('id', miembro_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroObjetivo) {
      return NextResponse.json({ error: 'Miembro no encontrado en esta empresa' }, { status: 404 })
    }

    // No se puede desactivar al propietario
    if (miembroObjetivo.rol === 'propietario' && !activo) {
      return NextResponse.json({ error: 'No se puede desactivar al propietario' }, { status: 403 })
    }

    // Actualizar estado
    const { error } = await admin
      .from('miembros')
      .update({ activo })
      .eq('id', miembro_id)

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar el miembro' }, { status: 500 })
    }

    return NextResponse.json({
      mensaje: activo ? 'Miembro activado' : 'Miembro desactivado',
      miembro_id,
      activo,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/miembros/activar — Activar o desactivar un miembro.
 * Solo propietario o administrador de la misma empresa pueden hacerlo.
 */
export async function PATCH(request: NextRequest) {
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

    // Verificar que el usuario actual tiene permiso
    const { data: miembroActual } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroActual || !['propietario', 'administrador'].includes(miembroActual.rol)) {
      return NextResponse.json({ error: 'No tenés permiso para esta acción' }, { status: 403 })
    }

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

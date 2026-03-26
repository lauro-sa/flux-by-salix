import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * DELETE /api/empresas/eliminar — Eliminar empresa.
 * Solo el propietario puede eliminar la empresa.
 * Elimina en cascada: miembros, invitaciones, sectores, puestos, horarios.
 */
export async function DELETE() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Solo propietario puede eliminar
    const { data: miembro } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro || miembro.rol !== 'propietario') {
      return NextResponse.json({ error: 'Solo el propietario puede eliminar la empresa' }, { status: 403 })
    }

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

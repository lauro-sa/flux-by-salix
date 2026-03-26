import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/empresas/cambiar — Cambiar empresa activa.
 * Verifica que el usuario sea miembro activo de la empresa destino,
 * actualiza app_metadata y fuerza refresh del JWT.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { empresa_id } = await request.json()

    if (!empresa_id) {
      return NextResponse.json({ error: 'empresa_id es obligatorio' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar membresía activa
    const { data: miembro } = await admin
      .from('miembros')
      .select('id, activo')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresa_id)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'No sos miembro de esa empresa' }, { status: 403 })
    }

    if (!miembro.activo) {
      return NextResponse.json({ error: 'Tu cuenta en esa empresa está pendiente de activación' }, { status: 403 })
    }

    // Actualizar empresa activa
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { empresa_activa_id: empresa_id },
    })

    return NextResponse.json({ mensaje: 'Empresa cambiada', empresa_id })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

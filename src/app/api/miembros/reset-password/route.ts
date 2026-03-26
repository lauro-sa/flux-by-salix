import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/reset-password — Envía email de reseteo de contraseña.
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

    // Obtener el usuario_id del miembro
    const { data: miembro } = await admin
      .from('miembros')
      .select('usuario_id')
      .eq('id', miembro_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    // Obtener el email del usuario
    const { data: userData } = await admin.auth.admin.getUserById(miembro.usuario_id)
    if (!userData?.user?.email) {
      return NextResponse.json({ error: 'Usuario sin correo' }, { status: 400 })
    }

    // Enviar email de reseteo
    const { error } = await admin.auth.resetPasswordForEmail(userData.user.email, {
      redirectTo: `${request.nextUrl.origin}/auth/restablecer`,
    })

    if (error) {
      return NextResponse.json({ error: 'Error al enviar el correo' }, { status: 500 })
    }

    return NextResponse.json({ mensaje: 'Correo de reseteo enviado', correo: userData.user.email })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

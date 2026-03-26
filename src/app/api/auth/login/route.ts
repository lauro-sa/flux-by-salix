import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/auth/login — Iniciar sesión.
 * Autentica con email/password, consulta membresías del usuario,
 * y setea la empresa activa si solo tiene una.
 */
export async function POST(request: NextRequest) {
  try {
    const { correo, contrasena } = await request.json()

    if (!correo || !contrasena) {
      return NextResponse.json(
        { error: 'Correo y contraseña son obligatorios' },
        { status: 400 }
      )
    }

    const supabase = await crearClienteServidor()

    // Autenticar
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    // Consultar membresías del usuario
    const admin = crearClienteAdmin()
    const { data: membresias } = await admin
      .from('miembros')
      .select('id, empresa_id, rol, activo, empresas(id, nombre, slug, logo_url)')
      .eq('usuario_id', data.user.id)

    const empresasActivas = membresias?.filter(m => m.activo) || []
    const todasMembresias = membresias || []

    // Si tiene exactamente una empresa activa, setearla automáticamente
    if (empresasActivas.length === 1) {
      await admin.auth.admin.updateUserById(data.user.id, {
        app_metadata: { empresa_activa_id: empresasActivas[0].empresa_id },
      })
    }

    return NextResponse.json({
      usuario: { id: data.user.id, correo: data.user.email },
      membresias: todasMembresias,
      empresas_activas: empresasActivas.length,
      redirigir: empresasActivas.length === 1
        ? '/dashboard'
        : empresasActivas.length > 1
          ? '/selector-empresa'
          : todasMembresias.length > 0
            ? '/esperando-activacion'
            : '/onboarding',
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

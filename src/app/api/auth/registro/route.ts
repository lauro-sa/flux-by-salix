import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/auth/registro — Crear cuenta nueva.
 * Crea el usuario en Supabase Auth y el perfil en la tabla perfiles.
 * Envía email de verificación automáticamente.
 */
export async function POST(request: NextRequest) {
  try {
    const { correo, contrasena, nombre, apellido } = await request.json()

    if (!correo || !contrasena || !nombre || !apellido) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 }
      )
    }

    if (contrasena.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    const supabase = await crearClienteServidor()

    // Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password: contrasena,
      options: {
        data: { nombre, apellido },
        emailRedirectTo: `${request.nextUrl.origin}/api/auth/callback`,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 })
    }

    // Crear perfil con el service role (bypass RLS)
    const admin = crearClienteAdmin()
    const { error: errorPerfil } = await admin
      .from('perfiles')
      .insert({
        id: data.user.id,
        nombre,
        apellido,
      })

    if (errorPerfil) {
      console.error('Error creando perfil:', errorPerfil)
      // No fallamos — el usuario se creó, el perfil se puede recrear después
    }

    return NextResponse.json({
      usuario: { id: data.user.id, correo: data.user.email },
      mensaje: 'Cuenta creada. Revisá tu correo para verificar.',
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * POST /api/auth/restablecer — Establecer nueva contraseña.
 * El usuario llega acá después de hacer clic en el link de recuperación.
 * La sesión ya fue establecida por el callback.
 */
export async function POST(request: NextRequest) {
  try {
    const { contrasena } = await request.json()

    if (!contrasena || contrasena.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    const supabase = await crearClienteServidor()

    const { error } = await supabase.auth.updateUser({
      password: contrasena,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ mensaje: 'Contraseña actualizada correctamente' })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

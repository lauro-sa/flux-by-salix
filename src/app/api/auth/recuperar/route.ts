import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * POST /api/auth/recuperar — Solicitar recuperación de contraseña.
 * Envía un email con link para restablecer la contraseña.
 * Siempre responde 200 para no revelar si el email existe.
 */
export async function POST(request: NextRequest) {
  try {
    const { correo } = await request.json()

    if (!correo) {
      return NextResponse.json({ error: 'El correo es obligatorio' }, { status: 400 })
    }

    const supabase = await crearClienteServidor()

    await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${request.nextUrl.origin}/api/auth/callback?next=/restablecer`,
    })

    // Siempre 200 — no revelar si el email existe
    return NextResponse.json({
      mensaje: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.',
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

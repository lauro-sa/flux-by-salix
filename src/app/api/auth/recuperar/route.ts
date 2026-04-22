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

    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${request.nextUrl.origin}/api/auth/callback?next=/restablecer`,
    })

    // Loguear server-side para debugging (rate limit, SMTP caído, etc.)
    // — no se propaga al cliente por seguridad (no revelar si el email existe).
    if (error) {
      console.error('[recuperar] resetPasswordForEmail error:', {
        correo,
        code: error.code,
        status: error.status,
        message: error.message,
      })
    }

    // Siempre 200 — no revelar si el email existe
    return NextResponse.json({
      mensaje: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.',
    })
  } catch (err) {
    console.error('[recuperar] excepción:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

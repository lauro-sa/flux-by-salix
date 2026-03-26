import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * GET /api/auth/callback — Callback de Supabase Auth.
 * Maneja el intercambio de código PKCE después de:
 *   - Verificación de email
 *   - Recuperación de contraseña
 * Supabase puede enviar: ?code=xxx o ?token_hash=xxx&type=recovery/signup
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next')

  const supabase = await crearClienteServidor()

  // Flujo PKCE — intercambiar código por sesión
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Determinar a dónde redirigir según el flujo
      if (next) return NextResponse.redirect(`${origin}${next}`)
      if (type === 'recovery') return NextResponse.redirect(`${origin}/restablecer`)
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Flujo con token_hash (email links)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'recovery' | 'signup' | 'email',
    })

    if (!error) {
      if (type === 'recovery') return NextResponse.redirect(`${origin}/restablecer`)
      if (type === 'signup' || type === 'email') return NextResponse.redirect(`${origin}/onboarding`)
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Error — redirigir a login
  return NextResponse.redirect(`${origin}/login?error=callback_fallido`)
}

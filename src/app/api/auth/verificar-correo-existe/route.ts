import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/auth/verificar-correo-existe — Verifica si un email ya tiene cuenta.
 * Usado por el flujo unificado de login para decidir si mostrar
 * campos de contraseña (existente) o de registro (nuevo).
 */
export async function POST(request: NextRequest) {
  try {
    const { correo } = await request.json()

    if (!correo) {
      return NextResponse.json({ error: 'Correo es obligatorio' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const correoNormalizado = correo.toLowerCase().trim()

    // Buscar en perfiles (se crea al registrarse)
    const { data: perfil } = await admin
      .from('perfiles')
      .select('id')
      .eq('correo', correoNormalizado)
      .maybeSingle()

    return NextResponse.json({ existe: !!perfil })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

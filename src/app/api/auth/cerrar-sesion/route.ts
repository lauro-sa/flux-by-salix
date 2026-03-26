import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * POST /api/auth/cerrar-sesion — Cerrar sesión.
 * Invalida la sesión actual y limpia cookies.
 */
export async function POST() {
  try {
    const supabase = await crearClienteServidor()
    await supabase.auth.signOut()
    return NextResponse.json({ mensaje: 'Sesión cerrada' })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

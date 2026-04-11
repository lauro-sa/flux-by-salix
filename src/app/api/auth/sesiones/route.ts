import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta, crearClienteAdmin } from '@/lib/supabase'

/**
 * GET /api/auth/sesiones
 * Devuelve las sesiones activas del usuario autenticado.
 * Usa función Postgres SECURITY DEFINER que consulta auth.sessions.
 */
export async function GET() {
  try {
    const { user, session: sesionActual } = await obtenerUsuarioRuta()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()
    const { data: sesiones, error } = await admin.rpc('obtener_sesiones_usuario', {
      p_user_id: user.id,
    })

    if (error) {
      console.error('[sesiones] Error obteniendo sesiones:', error.message)
      return NextResponse.json({ error: 'Error obteniendo sesiones' }, { status: 500 })
    }

    /* Detectar cuál es la sesión actual via el session_id del JWT */
    const idSesionActual = sesionActual?.access_token
      ? extraerSessionId(sesionActual.access_token)
      : null

    /* Filtrar sesiones de servidor (crons, middleware, API routes) */
    const sesionesReales = (sesiones || []).filter((s: { user_agent?: string }) => {
      const ua = (s.user_agent || '').toLowerCase()
      return ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox')
    })

    const resultado = sesionesReales.map((s: { id: string; user_agent: string; updated_at: string; created_at: string; ip: string | null }) => ({
      id: s.id,
      user_agent: s.user_agent || '',
      created_at: s.created_at,
      updated_at: s.updated_at || s.created_at,
      ip: s.ip || null,
      current: s.id === idSesionActual,
    }))

    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[sesiones] Error interno:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * Extrae el session_id del payload JWT de Supabase.
 */
function extraerSessionId(accessToken: string): string | null {
  try {
    const partes = accessToken.split('.')
    if (partes.length !== 3) return null
    const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString())
    return payload.session_id || null
  } catch {
    return null
  }
}

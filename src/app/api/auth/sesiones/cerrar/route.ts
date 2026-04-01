import { NextResponse } from 'next/server'
import { crearClienteServidor, crearClienteAdmin } from '@/lib/supabase'

/**
 * POST /api/auth/sesiones/cerrar
 * Cierra sesiones del usuario autenticado.
 * Body:
 *   { session_id: string }              — cerrar una sesión específica
 *   { todas: true }                     — cerrar TODAS (incluida la actual)
 *   { todas: true, excepto_actual: true, session_id_actual: string }
 *                                        — cerrar todas menos la actual
 */
export async function POST(request: Request) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const admin = crearClienteAdmin()

    /* Cerrar todas las sesiones */
    if (body?.todas) {
      const exceptoId = body.excepto_actual ? body.session_id_actual : null

      const { data: cantidad, error } = await admin.rpc('cerrar_todas_sesiones_usuario', {
        p_user_id: user.id,
        p_excepto_session_id: exceptoId || null,
      })

      if (error) {
        console.error('[sesiones/cerrar] Error cerrando todas:', error.message)
        return NextResponse.json({ error: 'Error cerrando sesiones' }, { status: 500 })
      }

      return NextResponse.json({ mensaje: 'Sesiones cerradas', cantidad })
    }

    /* Cerrar una sesión específica */
    const sessionId = body?.session_id

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'session_id requerido' }, { status: 400 })
    }

    const { data: eliminada, error } = await admin.rpc('cerrar_sesion_usuario', {
      p_session_id: sessionId,
      p_user_id: user.id,
    })

    if (error) {
      console.error('[sesiones/cerrar] Error cerrando sesión:', error.message)
      return NextResponse.json({ error: 'Error cerrando sesión' }, { status: 500 })
    }

    if (!eliminada) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ mensaje: 'Sesión cerrada correctamente' })
  } catch (err) {
    console.error('[sesiones/cerrar] Error interno:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

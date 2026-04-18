import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/invitaciones/cancelar — Revocar una invitación pendiente.
 *
 * Soporta dos modos:
 *   1. { correo } — cancela TODAS las invitaciones vigentes de ese correo en
 *      la empresa activa. Útil para "cancelar invitación pendiente" desde el
 *      perfil del empleado cuando no conocemos el token.
 *   2. { token } — cancela una invitación puntual.
 *
 * Para marcar la invitación como inválida reutilizamos el campo `usado` ya que
 * la app trata `usado=true` como invitación no utilizable. No creamos columna
 * nueva para mantener el esquema simple.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Solo propietario o administrador pueden cancelar
    const { data: miembroActual } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroActual || !['propietario', 'administrador'].includes(miembroActual.rol)) {
      return NextResponse.json({ error: 'No tenés permiso para cancelar invitaciones' }, { status: 403 })
    }

    const { token, correo } = await request.json()

    if (!token && !correo) {
      return NextResponse.json({ error: 'token o correo es obligatorio' }, { status: 400 })
    }

    const query = admin
      .from('invitaciones')
      .update({ usado: true })
      .eq('empresa_id', empresaId)
      .eq('usado', false)

    const { data, error } = token
      ? await query.eq('token', token).select('id')
      : await query.eq('correo', String(correo).toLowerCase().trim()).select('id')

    if (error) {
      return NextResponse.json({ error: 'Error al cancelar la invitación' }, { status: 500 })
    }

    return NextResponse.json({ canceladas: (data || []).length })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/reactivar-cuenta — Vuelve a habilitar el acceso a Flux
 * de un empleado que estaba en "Solo fichaje".
 *
 * Lee `miembros.usuario_id_anterior` (guardado al desvincular), verifica
 * que la cuenta auth siga existiendo y restaura el vínculo:
 *   - usuario_id ← usuario_id_anterior
 *   - usuario_id_anterior ← null
 *
 * El empleado puede iniciar sesión inmediatamente con sus credenciales
 * previas (mismo correo y password). No se le envía email — la cuenta ya
 * existía, solo se le restituye el acceso.
 *
 * Si la cuenta auth fue eliminada manualmente desde Supabase Studio, este
 * endpoint devuelve 410 Gone y el caller debe ofrecer "Enviar invitación".
 *
 * Body: { miembro_id }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    const { miembro_id } = await request.json()
    if (!miembro_id) {
      return NextResponse.json({ error: 'miembro_id es obligatorio' }, { status: 400 })
    }

    const { data: miembro } = await admin
      .from('miembros')
      .select('id, usuario_id, usuario_id_anterior')
      .eq('id', miembro_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }
    if (miembro.usuario_id) {
      return NextResponse.json({ error: 'Este empleado ya tiene cuenta activa' }, { status: 400 })
    }
    if (!miembro.usuario_id_anterior) {
      return NextResponse.json(
        { error: 'No hay cuenta previa para reactivar — enviá una invitación nueva.', requiere_invitacion: true },
        { status: 400 },
      )
    }

    // Confirmar que la cuenta auth siga existiendo
    const { data: authPrevio } = await admin.auth.admin.getUserById(miembro.usuario_id_anterior)
    if (!authPrevio?.user) {
      // Limpiamos la referencia rota para no volver a intentar
      await admin.from('miembros').update({ usuario_id_anterior: null }).eq('id', miembro.id)
      return NextResponse.json(
        { error: 'La cuenta previa ya no existe — enviá una invitación nueva.', requiere_invitacion: true },
        { status: 410 },
      )
    }

    // Verificar que ese usuario_id no esté ya vinculado a otro miembro de esta empresa
    const { data: conflicto } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', miembro.usuario_id_anterior)
      .maybeSingle()

    if (conflicto) {
      return NextResponse.json(
        { error: 'Esa cuenta ya está vinculada a otro empleado de la empresa.' },
        { status: 409 },
      )
    }

    const { error: errUpd } = await admin
      .from('miembros')
      .update({ usuario_id: miembro.usuario_id_anterior, usuario_id_anterior: null })
      .eq('id', miembro.id)

    if (errUpd) {
      return NextResponse.json({ error: 'Error al reactivar la cuenta' }, { status: 500 })
    }

    return NextResponse.json({
      mensaje: 'Acceso reactivado. El empleado puede iniciar sesión con sus credenciales anteriores.',
      correo: authPrevio.user.email,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

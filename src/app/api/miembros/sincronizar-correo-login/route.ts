import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/sincronizar-correo-login
 *
 * Sincroniza el email de auth.users con el correo del canal de login elegido
 * (`miembros.canal_login`). Si el body trae `canal_login`, primero actualiza
 * ese campo en miembros y después sincroniza.
 *
 * Solo propietario o administrador. Marca el email como confirmado para que
 * el usuario no necesite revalidar.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: actor } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!actor || !['propietario', 'administrador'].includes(actor.rol)) {
      return NextResponse.json({ error: 'No tenés permiso' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const miembroId: string | undefined = body.miembro_id
    const canalNuevo: 'empresa' | 'personal' | undefined =
      body.canal_login === 'empresa' || body.canal_login === 'personal' ? body.canal_login : undefined

    if (!miembroId) return NextResponse.json({ error: 'miembro_id requerido' }, { status: 400 })

    // Si vino canal_login en el body, lo actualizo antes de sincronizar
    if (canalNuevo) {
      const { error: errUpd } = await admin
        .from('miembros')
        .update({ canal_login: canalNuevo })
        .eq('id', miembroId)
        .eq('empresa_id', empresaId)
      if (errUpd) return NextResponse.json({ error: 'No se pudo actualizar el canal' }, { status: 500 })
    }

    const { data: miembro } = await admin
      .from('miembros')
      .select('usuario_id, canal_login')
      .eq('id', miembroId)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    if (!miembro.usuario_id) {
      return NextResponse.json({ error: 'El miembro aún no tiene cuenta de auth' }, { status: 400 })
    }

    const { data: perfil } = await admin
      .from('perfiles')
      .select('correo, correo_empresa')
      .eq('id', miembro.usuario_id)
      .single()

    const canal = (miembro.canal_login as 'empresa' | 'personal') || 'empresa'
    const destino = (canal === 'empresa' ? perfil?.correo_empresa : perfil?.correo)?.trim().toLowerCase() || ''

    if (!destino) {
      const etiqueta = canal === 'empresa' ? 'correo de empresa' : 'correo personal'
      return NextResponse.json(
        { error: `No hay ${etiqueta} cargado en el perfil. Cargalo antes de cambiar el canal de login.` },
        { status: 400 },
      )
    }

    // Comparar con el email actual de auth.users
    const { data: actual } = await admin.auth.admin.getUserById(miembro.usuario_id)
    const emailActual = actual?.user?.email?.trim().toLowerCase() || ''

    if (emailActual === destino) {
      return NextResponse.json({ ok: true, sincronizado: false, correo: destino, canal })
    }

    const { error: errAuth } = await admin.auth.admin.updateUserById(miembro.usuario_id, {
      email: destino,
      email_confirm: true,
    })

    if (errAuth) {
      const msg = errAuth.message || 'No se pudo actualizar el correo de login'
      const status = msg.toLowerCase().includes('already') ? 409 : 500
      return NextResponse.json({ error: msg }, { status })
    }

    return NextResponse.json({ ok: true, sincronizado: true, correo: destino, canal })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

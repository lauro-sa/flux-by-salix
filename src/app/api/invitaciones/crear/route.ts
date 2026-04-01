import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * POST /api/invitaciones/crear — Generar invitación para unirse a la empresa.
 * Solo propietario o administrador pueden invitar.
 * Genera un token único con expiración de 7 días.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) {
      return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el usuario tiene permiso para invitar
    const { data: miembroActual } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroActual || !['propietario', 'administrador'].includes(miembroActual.rol)) {
      return NextResponse.json({ error: 'No tenés permiso para invitar' }, { status: 403 })
    }

    const { correo, rol } = await request.json()

    if (!correo || !rol) {
      return NextResponse.json({ error: 'Correo y rol son obligatorios' }, { status: 400 })
    }

    // Verificar que no exista ya un miembro con ese correo en esta empresa
    const { data: usuarioExistente } = await admin.auth.admin.listUsers()
    const usuarioConCorreo = usuarioExistente.users.find(u => u.email === correo)

    if (usuarioConCorreo) {
      const { data: miembroExistente } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', usuarioConCorreo.id)
        .eq('empresa_id', empresaId)
        .single()

      if (miembroExistente) {
        return NextResponse.json({ error: 'Este usuario ya es miembro de la empresa' }, { status: 409 })
      }
    }

    // Generar token y fecha de expiración (48 horas)
    const token = crypto.randomUUID()
    const expiraEn = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // Obtener slug de la empresa para el link
    const { data: empresa } = await admin
      .from('empresas')
      .select('slug')
      .eq('id', empresaId)
      .single()

    const { data: invitacion, error } = await admin
      .from('invitaciones')
      .insert({
        token,
        empresa_id: empresaId,
        rol,
        correo,
        creado_por: user.id,
        expira_en: expiraEn,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Error al crear la invitación' }, { status: 500 })
    }

    // Construir link de invitación
    const dominio = process.env.NEXT_PUBLIC_APP_DOMAIN || 'fluxsalix.com'
    const link = empresa?.slug
      ? `https://${empresa.slug}.${dominio}/invitacion?token=${token}`
      : `${request.nextUrl.origin}/invitacion?token=${token}`

    return NextResponse.json({ invitacion, link })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/miembros/[id]/emergencia — Obtiene contacto de emergencia del miembro
 * PUT /api/miembros/[id]/emergencia — Crea o actualiza contacto de emergencia
 */

async function verificarAuth() {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return null
  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return null
  return { user, empresaId }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verificarAuth()
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: miembroId } = await params
  const admin = crearClienteAdmin()

  // Dato sensible (teléfonos personales de familiares): el miembro puede ver
  // su propio contacto de emergencia; para ver el de otros requiere usuarios:editar.
  const { data: miembroDest } = await admin
    .from('miembros')
    .select('usuario_id')
    .eq('id', miembroId)
    .eq('empresa_id', auth.empresaId)
    .maybeSingle()
  if (miembroDest?.usuario_id !== auth.user.id) {
    const datosActor = await obtenerDatosMiembro(auth.user.id, auth.empresaId)
    if (!datosActor || !verificarPermiso(datosActor, 'usuarios', 'editar')) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }
  }

  const { data, error } = await admin
    .from('contactos_emergencia')
    .select('*')
    .eq('miembro_id', miembroId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verificarAuth()
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: miembroId } = await params
  const { id: contactoId, ...datos } = await req.json()
  const admin = crearClienteAdmin()

  // El miembro puede editar su propio contacto de emergencia; para editar el
  // de otro empleado requiere usuarios:editar.
  const { data: miembroDest } = await admin
    .from('miembros')
    .select('usuario_id')
    .eq('id', miembroId)
    .eq('empresa_id', auth.empresaId)
    .maybeSingle()
  if (miembroDest?.usuario_id !== auth.user.id) {
    const datosActor = await obtenerDatosMiembro(auth.user.id, auth.empresaId)
    if (!datosActor || !verificarPermiso(datosActor, 'usuarios', 'editar')) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }
  }

  if (contactoId) {
    // Actualizar existente
    const { data, error } = await admin
      .from('contactos_emergencia')
      .update(datos)
      .eq('id', contactoId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } else {
    // Crear nuevo
    const { data, error } = await admin
      .from('contactos_emergencia')
      .insert({ miembro_id: miembroId, ...datos })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
}

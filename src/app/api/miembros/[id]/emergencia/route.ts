import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'

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

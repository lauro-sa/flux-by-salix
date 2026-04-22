import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/miembros/[id]/sector — Obtiene el sector primario del miembro
 * PUT /api/miembros/[id]/sector — Asigna sector primario al miembro
 *
 * GET: libre para miembros de la empresa (lectura del sector propio o ajeno — dato operativo).
 * PUT: requiere usuarios:editar (modificar datos de otro empleado).
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
    .from('miembros_sectores')
    .select('sector_id')
    .eq('miembro_id', miembroId)
    .eq('es_primario', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sector_id: data?.sector_id ?? null })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verificarAuth()
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Cambiar sector de un miembro = datos laborales → requiere usuarios:editar
  const datos = await obtenerDatosMiembro(auth.user.id, auth.empresaId)
  if (!datos || !verificarPermiso(datos, 'usuarios', 'editar')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id: miembroId } = await params
  const { sector_id } = await req.json()
  const admin = crearClienteAdmin()

  // Borrar asignación actual
  await admin.from('miembros_sectores').delete().eq('miembro_id', miembroId)

  // Crear nueva si hay sector
  if (sector_id) {
    const { error } = await admin.from('miembros_sectores').insert({
      miembro_id: miembroId,
      sector_id,
      es_primario: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

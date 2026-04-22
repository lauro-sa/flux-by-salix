import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'

/**
 * GET /api/miembros-sectores — Lista todas las asignaciones miembro↔sector
 * Query params opcionales: miembro_ids (comma-separated), es_primario
 * DELETE /api/miembros-sectores — Elimina asignaciones por sector_id
 */

export async function GET(req: NextRequest) {
  const guard = await requerirPermisoAPI('usuarios', 'ver')
  if ('respuesta' in guard) return guard.respuesta

  const admin = crearClienteAdmin()
  const { searchParams } = new URL(req.url)

  let query = admin.from('miembros_sectores').select('sector_id, miembro_id')

  const miembroIds = searchParams.get('miembro_ids')
  if (miembroIds) {
    query = query.in('miembro_id', miembroIds.split(','))
  }

  const esPrimario = searchParams.get('es_primario')
  if (esPrimario === 'true') {
    query = query.eq('es_primario', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function DELETE(req: NextRequest) {
  const guard = await requerirPermisoAPI('usuarios', 'editar')
  if ('respuesta' in guard) return guard.respuesta

  const admin = crearClienteAdmin()
  const { sector_id, all } = await req.json()

  if (all) {
    // Eliminar todas las asignaciones (para reset de estructura)
    await admin.from('miembros_sectores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  } else if (sector_id) {
    await admin.from('miembros_sectores').delete().eq('sector_id', sector_id)
  }

  return NextResponse.json({ ok: true })
}

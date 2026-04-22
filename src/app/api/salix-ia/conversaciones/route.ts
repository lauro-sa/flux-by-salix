/**
 * API Route: /api/salix-ia/conversaciones
 * GET — Lista las conversaciones del usuario
 */

import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const guard = await requerirPermisoAPI('contactos', 'ver_propio')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId: empresa_id } = guard

  const admin = crearClienteAdmin()
  const { data, error } = await admin
    .from('conversaciones_salix_ia')
    .select('id, titulo, canal, creado_en, actualizado_en')
    .eq('empresa_id', empresa_id)
    .eq('usuario_id', user.id)
    .order('actualizado_en', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

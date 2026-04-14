/**
 * API Route: /api/salix-ia/conversaciones
 * GET — Lista las conversaciones del usuario
 */

import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase'
import { crearClienteAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { user, respuesta401 } = await obtenerUsuarioRuta()
  if (!user) return respuesta401()

  const empresa_id = user.app_metadata?.empresa_activa_id
  if (!empresa_id) {
    return NextResponse.json({ error: 'Sin empresa asociada' }, { status: 400 })
  }

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

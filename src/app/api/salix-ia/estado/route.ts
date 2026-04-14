/**
 * API Route: GET /api/salix-ia/estado
 * Verifica si Salix IA está habilitado para el usuario actual.
 */

import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase'
import { crearClienteAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { user, respuesta401 } = await obtenerUsuarioRuta()
  if (!user) return respuesta401()

  const empresa_id = user.app_metadata?.empresa_activa_id
  if (!empresa_id) {
    return NextResponse.json({ habilitado: false })
  }

  const admin = crearClienteAdmin()

  // Verificar config de empresa
  const { data: config } = await admin
    .from('config_salix_ia')
    .select('habilitado')
    .eq('empresa_id', empresa_id)
    .single()

  if (!config?.habilitado) {
    return NextResponse.json({ habilitado: false })
  }

  // Verificar que el miembro tiene habilitado Salix IA
  const { data: miembro } = await admin
    .from('miembros')
    .select('salix_ia_habilitado')
    .eq('usuario_id', user.id)
    .eq('empresa_id', empresa_id)
    .eq('activo', true)
    .single()

  return NextResponse.json({
    habilitado: miembro?.salix_ia_habilitado ?? false,
  })
}

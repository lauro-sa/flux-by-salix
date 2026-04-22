/**
 * API Route: GET /api/salix-ia/estado
 * Verifica si Salix IA está habilitado para el usuario actual.
 */

import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const guard = await requerirPermisoAPI('contactos', 'ver_propio')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId: empresa_id } = guard

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

  // Verificar que el miembro tiene habilitado Salix IA EN LA APP (web).
  // El flag `salix_ia_whatsapp` no aplica acá — este endpoint lo consume el
  // botón flotante de la app para saber si mostrarlo.
  const { data: miembro } = await admin
    .from('miembros')
    .select('salix_ia_web')
    .eq('usuario_id', user.id)
    .eq('empresa_id', empresa_id)
    .eq('activo', true)
    .single()

  return NextResponse.json({
    habilitado: miembro?.salix_ia_web ?? false,
  })
}

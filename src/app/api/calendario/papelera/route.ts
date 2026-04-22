import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/calendario/papelera — Listar eventos del calendario en papelera.
 * Se usa en: ContenidoPapelera (client refetch).
 */
export async function GET() {
  try {
    const guard = await requerirPermisoAPI('calendario', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('eventos_calendario')
      .select('id, titulo, fecha_inicio, tipo_clave, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true)

    if (error) return NextResponse.json({ error: 'Error al listar eventos en papelera' }, { status: 500 })
    return NextResponse.json({ eventos: data || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

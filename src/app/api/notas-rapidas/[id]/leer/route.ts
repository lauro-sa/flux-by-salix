import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/notas-rapidas/[id]/leer — Marcar nota compartida como leída.
 * Actualiza leido_en para quitar el indicador de cambios (punto rojo).
 *
 * Se usa en: PanelNotas (al abrir una nota compartida).
 */

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requerirPermisoAPI('notas', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user } = guard

    const { id } = await params
    const admin = crearClienteAdmin()

    await admin
      .from('notas_rapidas_compartidas')
      .update({ leido_en: new Date().toISOString() })
      .eq('nota_id', id)
      .eq('usuario_id', user.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

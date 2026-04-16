import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/recorrido/papelera — Listar recorridos en papelera.
 * Se usa en: ContenidoPapelera (client refetch).
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('recorridos')
      .select('id, asignado_nombre, fecha, estado, papelera_en, actualizado_en, creado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true)

    if (error) return NextResponse.json({ error: 'Error al listar recorridos en papelera' }, { status: 500 })
    return NextResponse.json({ recorridos: data || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

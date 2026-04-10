import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarReciente } from '@/lib/recientes'

/**
 * GET /api/dashboard/recientes — Últimas 20 entidades visitadas/editadas/creadas por el usuario.
 * Devuelve historial ordenado por accedido_en DESC.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('historial_recientes')
      .select('id, tipo_entidad, entidad_id, titulo, subtitulo, accion, accedido_en')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .order('accedido_en', { ascending: false })
      .limit(24)

    if (error) {
      console.error('[recientes] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/recientes — Registrar una entidad como reciente desde el frontend.
 * Útil para entidades que se abren en modales sin pasar por un GET individual (ej: actividades).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { tipoEntidad, entidadId, titulo, subtitulo, accion } = body

    if (!tipoEntidad || !entidadId || !titulo) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad,
      entidadId,
      titulo,
      subtitulo,
      accion: accion || 'visto',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

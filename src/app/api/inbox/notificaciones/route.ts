import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/notificaciones — Listar notificaciones del usuario.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const solo_no_leidas = params.get('solo_no_leidas') === 'true'
    const limite = Math.min(parseInt(params.get('limite') || '50'), 100)

    const admin = crearClienteAdmin()

    let query = admin
      .from('notificaciones')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)

    if (solo_no_leidas) query = query.eq('leida', false)

    // Ejecutar ambas queries en paralelo para reducir latencia
    const [resultado, conteoNoLeidas] = await Promise.all([
      query
        .order('creada_en', { ascending: false })
        .limit(limite),
      admin
        .from('notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('usuario_id', user.id)
        .eq('leida', false),
    ])

    const { data, count, error } = resultado
    if (error) throw error

    const noLeidas = conteoNoLeidas.count

    // Enriquecer notificaciones de actividades con tipo (etiqueta + color)
    const notificacionesEnriquecidas = data || []
    const refsActividad = notificacionesEnriquecidas
      .filter(n => n.referencia_tipo === 'actividad' && n.referencia_id)
      .map(n => n.referencia_id!)

    if (refsActividad.length > 0) {
      const idsUnicos = [...new Set(refsActividad)]
      const { data: actividades } = await admin
        .from('actividades')
        .select('id, tipo_id')
        .in('id', idsUnicos)

      if (actividades && actividades.length > 0) {
        const tipoIds = [...new Set(actividades.map(a => a.tipo_id))]
        const { data: tipos } = await admin
          .from('tipos_actividad')
          .select('id, etiqueta, color')
          .in('id', tipoIds)

        const tiposPorId = new Map((tipos || []).map(t => [t.id, t]))
        const tipoPorActividad = new Map(actividades.map(a => [a.id, tiposPorId.get(a.tipo_id)]))

        for (const n of notificacionesEnriquecidas) {
          if (n.referencia_tipo === 'actividad' && n.referencia_id) {
            const tipo = tipoPorActividad.get(n.referencia_id)
            if (tipo) {
              n.tipo_etiqueta = tipo.etiqueta
              n.tipo_color = tipo.color
            }
          }
        }
      }
    }

    return NextResponse.json({
      notificaciones: notificacionesEnriquecidas,
      total: count || 0,
      no_leidas: noLeidas || 0,
    })
  } catch (err) {
    console.error('Error al obtener notificaciones:', err)
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 })
  }
}

/**
 * PATCH /api/inbox/notificaciones — Marcar notificaciones como leídas.
 * Body: { ids: string[] } o { todas: true }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    if (body.todas) {
      await admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('empresa_id', empresaId)
        .eq('usuario_id', user.id)
        .eq('leida', false)
    } else if (body.referencia_id) {
      // Marcar como leídas todas las notificaciones de una referencia (ej. conversación)
      await admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('empresa_id', empresaId)
        .eq('usuario_id', user.id)
        .eq('referencia_id', body.referencia_id)
        .eq('leida', false)
    } else if (body.ids && body.ids.length > 0) {
      await admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('empresa_id', empresaId)
        .eq('usuario_id', user.id)
        .in('id', body.ids)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al marcar notificaciones:', err)
    return NextResponse.json({ error: 'Error al marcar notificaciones' }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/notificaciones — Descartar (eliminar) notificaciones.
 * Body: { ids: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de ids' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    await admin
      .from('notificaciones')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .in('id', body.ids)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar notificaciones:', err)
    return NextResponse.json({ error: 'Error al eliminar notificaciones' }, { status: 500 })
  }
}

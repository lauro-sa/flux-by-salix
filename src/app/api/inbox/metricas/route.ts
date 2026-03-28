import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/metricas — Métricas de correo para el dashboard.
 * Params: desde (ISO date), hasta (ISO date), canal_id (opcional)
 * Retorna métricas diarias + resumen del período.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const desde = params.get('desde') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const hasta = params.get('hasta') || new Date().toISOString().split('T')[0]
    const canalId = params.get('canal_id')

    const admin = crearClienteAdmin()

    // Intentar leer de tabla materializada primero
    let query = admin
      .from('metricas_correo')
      .select('*')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true })

    if (canalId) query = query.eq('canal_id', canalId)

    const { data: metricasMat } = await query

    // Si hay métricas materializadas, usar esas
    if (metricasMat && metricasMat.length > 0) {
      const resumen = {
        correos_recibidos: metricasMat.reduce((s, m) => s + (m.correos_recibidos || 0), 0),
        correos_enviados: metricasMat.reduce((s, m) => s + (m.correos_enviados || 0), 0),
        conversaciones_nuevas: metricasMat.reduce((s, m) => s + (m.conversaciones_nuevas || 0), 0),
        conversaciones_resueltas: metricasMat.reduce((s, m) => s + (m.conversaciones_resueltas || 0), 0),
        correos_spam: metricasMat.reduce((s, m) => s + (m.correos_spam || 0), 0),
      }

      return NextResponse.json({ metricas: metricasMat, resumen })
    }

    // Fallback: calcular en tiempo real desde las tablas
    const fechaDesde = `${desde}T00:00:00Z`
    const fechaHasta = `${hasta}T23:59:59Z`

    // Contar mensajes por dirección
    let queryMsgs = admin
      .from('mensajes')
      .select('es_entrante, creado_en', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .gte('creado_en', fechaDesde)
      .lte('creado_en', fechaHasta)

    // Filtrar por canal si se especifica
    if (canalId) {
      const { data: convIds } = await admin
        .from('conversaciones')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('canal_id', canalId)
        .eq('tipo_canal', 'correo')

      if (convIds) {
        queryMsgs = queryMsgs.in('conversacion_id', convIds.map(c => c.id))
      }
    }

    const { data: mensajes } = await queryMsgs

    const recibidos = (mensajes || []).filter(m => m.es_entrante).length
    const enviados = (mensajes || []).filter(m => !m.es_entrante).length

    // Conversaciones nuevas
    let queryConvs = admin
      .from('conversaciones')
      .select('id, estado', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('tipo_canal', 'correo')
      .gte('creado_en', fechaDesde)
      .lte('creado_en', fechaHasta)

    if (canalId) queryConvs = queryConvs.eq('canal_id', canalId)

    const { data: convs } = await queryConvs

    const resumen = {
      correos_recibidos: recibidos,
      correos_enviados: enviados,
      conversaciones_nuevas: convs?.length || 0,
      conversaciones_resueltas: convs?.filter(c => c.estado === 'resuelta').length || 0,
      correos_spam: convs?.filter(c => c.estado === 'spam').length || 0,
    }

    return NextResponse.json({ metricas: [], resumen })
  } catch (err) {
    console.error('Error obteniendo métricas:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

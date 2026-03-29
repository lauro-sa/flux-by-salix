import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/agente-ia/log — Obtener logs del agente IA con filtros y métricas.
 *
 * Query params:
 * ?conversacion_id=xxx — logs de una conversación
 * ?accion=responder — filtrar por tipo de acción
 * ?desde=2024-01-01 — desde fecha
 * ?hasta=2024-01-31 — hasta fecha
 * ?pagina=1&limite=50 — paginación
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const conversacionId = searchParams.get('conversacion_id')
    const accion = searchParams.get('accion')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const pagina = parseInt(searchParams.get('pagina') || '1')
    const limite = parseInt(searchParams.get('limite') || '50')
    const offset = (pagina - 1) * limite

    const admin = crearClienteAdmin()

    // Query principal con filtros
    let query = admin
      .from('log_agente_ia')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: false })
      .range(offset, offset + limite - 1)

    if (conversacionId) query = query.eq('conversacion_id', conversacionId)
    if (accion) query = query.eq('accion', accion)
    if (desde) query = query.gte('creado_en', desde)
    if (hasta) query = query.lte('creado_en', hasta)

    const { data: logs, count, error } = await query
    if (error) throw error

    // Métricas agregadas (últimas 24h)
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: logsRecientes } = await admin
      .from('log_agente_ia')
      .select('accion, exito, tokens_entrada, tokens_salida, latencia_ms')
      .eq('empresa_id', empresaId)
      .gte('creado_en', hace24h)

    // Sentimiento promedio de conversaciones recientes
    const { data: convRecientes } = await admin
      .from('conversaciones')
      .select('sentimiento')
      .eq('empresa_id', empresaId)
      .not('sentimiento', 'is', null)
      .gte('actualizado_en', hace24h)
      .limit(100)

    const metricas = calcularMetricas(logsRecientes || [], convRecientes || [])

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      metricas,
    })
  } catch (err) {
    console.error('Error al obtener logs agente IA:', err)
    return NextResponse.json({ logs: [], total: 0, metricas: null })
  }
}

// ─── Calcular métricas a partir de los logs ───

function calcularMetricas(
  logs: {
    accion: string
    exito: boolean
    tokens_entrada: number
    tokens_salida: number
    latencia_ms: number
  }[],
  conversaciones: { sentimiento: string | null }[],
) {
  if (logs.length === 0) {
    return {
      total_acciones: 0,
      total_tokens: 0,
      latencia_promedio: 0,
      tasa_exito: 100,
      por_accion: {},
      sentimiento_promedio: '—',
    }
  }

  const totalTokens = logs.reduce((sum, l) => sum + (l.tokens_entrada || 0) + (l.tokens_salida || 0), 0)
  const latenciaPromedio = Math.round(logs.reduce((sum, l) => sum + (l.latencia_ms || 0), 0) / logs.length)
  const exitosos = logs.filter(l => l.exito).length
  const tasaExito = Math.round((exitosos / logs.length) * 100)

  const porAccion: Record<string, number> = {}
  for (const log of logs) {
    porAccion[log.accion] = (porAccion[log.accion] || 0) + 1
  }

  // Sentimiento promedio de conversaciones
  let sentimientoPromedio = '—'
  if (conversaciones.length > 0) {
    const conteo: Record<string, number> = {}
    for (const c of conversaciones) {
      if (c.sentimiento) conteo[c.sentimiento] = (conteo[c.sentimiento] || 0) + 1
    }
    // El sentimiento más frecuente
    const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1])
    if (ordenado.length > 0) sentimientoPromedio = ordenado[0][0]
  }

  return {
    total_acciones: logs.length,
    total_tokens: totalTokens,
    latencia_promedio: latenciaPromedio,
    tasa_exito: tasaExito,
    por_accion: porAccion,
    sentimiento_promedio: sentimientoPromedio,
  }
}

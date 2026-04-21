import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { formatearFechaISO } from '@/lib/formato-fecha'

/**
 * GET /api/inbox/metricas — Métricas del inbox para dashboard.
 * Params: desde, hasta, canal_id, tipo_canal ('whatsapp' | 'correo' | todos)
 * Retorna: resumen general + métricas por agente + tiempos de respuesta.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    // Cargar zona horaria de la empresa para que "hoy" y "hace 30 días" se calculen
    // en la zona local, no en UTC (que después de las 21 AR da el día siguiente).
    const { data: empMetr } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zonaMetr = (empMetr?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'

    const params = request.nextUrl.searchParams
    const desde = params.get('desde') || formatearFechaISO(new Date(Date.now() - 30 * 86400000), zonaMetr)
    const hasta = params.get('hasta') || formatearFechaISO(new Date(), zonaMetr)
    const canalId = params.get('canal_id')
    const tipoCanal = params.get('tipo_canal') // 'whatsapp', 'correo', o null para todos

    const fechaDesde = `${desde}T00:00:00Z`
    const fechaHasta = `${hasta}T23:59:59Z`

    // ─── Conversaciones del período ───
    let queryConvs = admin
      .from('conversaciones')
      .select('id, estado, asignado_a, asignado_a_nombre, sla_primera_respuesta_en, sla_primera_respuesta_cumplido, creado_en, cerrado_en')
      .eq('empresa_id', empresaId)
      .gte('creado_en', fechaDesde)
      .lte('creado_en', fechaHasta)

    if (tipoCanal) queryConvs = queryConvs.eq('tipo_canal', tipoCanal)
    if (canalId) queryConvs = queryConvs.eq('canal_id', canalId)

    const { data: convs } = await queryConvs

    // ─── Mensajes del período ───
    let queryMsgs = admin
      .from('mensajes')
      .select('es_entrante, es_nota_interna, creado_en')
      .eq('empresa_id', empresaId)
      .eq('es_nota_interna', false)
      .gte('creado_en', fechaDesde)
      .lte('creado_en', fechaHasta)

    if (tipoCanal || canalId) {
      // Filtrar por conversaciones del canal
      const idsConvs = (convs || []).map(c => c.id)
      if (idsConvs.length > 0) {
        queryMsgs = queryMsgs.in('conversacion_id', idsConvs)
      } else {
        return NextResponse.json({
          resumen: { mensajes_recibidos: 0, mensajes_enviados: 0, conversaciones_nuevas: 0, conversaciones_resueltas: 0, sla_cumplido_pct: 0, tiempo_respuesta_promedio_min: 0 },
          por_agente: [],
        })
      }
    }

    const { data: mensajes } = await queryMsgs

    const recibidos = (mensajes || []).filter(m => m.es_entrante).length
    const enviados = (mensajes || []).filter(m => !m.es_entrante).length

    const conversacionesArr = convs || []
    const nuevas = conversacionesArr.length
    const resueltas = conversacionesArr.filter(c => c.estado === 'resuelta').length

    // ─── SLA y tiempos ───
    const conSla = conversacionesArr.filter(c => c.sla_primera_respuesta_en)
    const slaCumplido = conSla.filter(c => c.sla_primera_respuesta_cumplido).length
    const slaPct = conSla.length > 0 ? Math.round((slaCumplido / conSla.length) * 100) : 0

    // Tiempo promedio de primera respuesta (minutos)
    let tiempoRespuestaPromedio = 0
    if (conSla.length > 0) {
      const tiempos = conSla.map(c => {
        const creado = new Date(c.creado_en).getTime()
        const respondido = new Date(c.sla_primera_respuesta_en).getTime()
        return (respondido - creado) / 60000 // minutos
      })
      tiempoRespuestaPromedio = Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
    }

    // Tiempo promedio de resolución (horas)
    const conResolucion = conversacionesArr.filter(c => c.cerrado_en)
    let tiempoResolucionPromedio = 0
    if (conResolucion.length > 0) {
      const tiempos = conResolucion.map(c => {
        const creado = new Date(c.creado_en).getTime()
        const cerrado = new Date(c.cerrado_en).getTime()
        return (cerrado - creado) / 3600000 // horas
      })
      tiempoResolucionPromedio = Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length * 10) / 10
    }

    // ─── Por agente ───
    const porAgente: Record<string, { nombre: string; asignadas: number; resueltas: number; sla_cumplido: number; sla_total: number }> = {}
    for (const c of conversacionesArr) {
      if (!c.asignado_a) continue
      if (!porAgente[c.asignado_a]) {
        porAgente[c.asignado_a] = {
          nombre: c.asignado_a_nombre || 'Agente',
          asignadas: 0,
          resueltas: 0,
          sla_cumplido: 0,
          sla_total: 0,
        }
      }
      const ag = porAgente[c.asignado_a]
      ag.asignadas++
      if (c.estado === 'resuelta') ag.resueltas++
      if (c.sla_primera_respuesta_en) {
        ag.sla_total++
        if (c.sla_primera_respuesta_cumplido) ag.sla_cumplido++
      }
    }

    const resumen = {
      mensajes_recibidos: recibidos,
      mensajes_enviados: enviados,
      conversaciones_nuevas: nuevas,
      conversaciones_resueltas: resueltas,
      sla_cumplido_pct: slaPct,
      tiempo_respuesta_promedio_min: tiempoRespuestaPromedio,
      tiempo_resolucion_promedio_hrs: tiempoResolucionPromedio,
    }

    return NextResponse.json({
      resumen,
      por_agente: Object.values(porAgente).sort((a, b) => b.asignadas - a.asignadas),
    })
  } catch (err) {
    console.error('Error obteniendo métricas:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

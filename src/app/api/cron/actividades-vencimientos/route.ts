import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacionesBatch } from '@/lib/notificaciones'
import { COLORES_HEX_ESTADO_ACTIVIDAD } from '@/lib/colores_entidad'

/**
 * GET /api/cron/actividades-vencimientos — Cron de vencimientos de actividades.
 * Ejecutado por Vercel Cron cada día a las 8:00 AM.
 *
 * Genera notificaciones para:
 * 1. Actividades que vencen HOY → "Tu actividad X vence hoy"
 * 2. Actividades que vencieron AYER → "La actividad X venció ayer"
 * 3. Marca como 'vencida' las actividades pendientes cuya fecha pasó
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()

    // Calcular rangos de fecha
    const ahora = new Date()
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    const hoyFin = new Date(hoyInicio); hoyFin.setDate(hoyFin.getDate() + 1)
    const ayerInicio = new Date(hoyInicio); ayerInicio.setDate(ayerInicio.getDate() - 1)

    // 1. Actividades que vencen HOY (pendientes, con asignados o creador)
    const { data: vencenHoy } = await admin
      .from('actividades')
      .select('id, titulo, empresa_id, asignados, creado_por, tipo_id')
      .gte('fecha_vencimiento', hoyInicio.toISOString())
      .lt('fecha_vencimiento', hoyFin.toISOString())
      .in('estado_clave', ['pendiente'])
      .eq('en_papelera', false)

    // 2. Actividades que vencieron AYER (pendientes)
    const { data: vencieronAyer } = await admin
      .from('actividades')
      .select('id, titulo, empresa_id, asignados, creado_por, tipo_id')
      .gte('fecha_vencimiento', ayerInicio.toISOString())
      .lt('fecha_vencimiento', hoyInicio.toISOString())
      .in('estado_clave', ['pendiente'])
      .eq('en_papelera', false)

    // 3. Marcar como 'vencida' todas las actividades pendientes con fecha pasada
    // Primero obtenemos los estados 'vencida' por empresa
    const { data: estadosVencida } = await admin
      .from('estados_actividad')
      .select('id, empresa_id, clave')
      .eq('clave', 'vencida')
      .eq('activo', true)

    const estadoVencidaPorEmpresa = new Map(
      (estadosVencida || []).map(e => [e.empresa_id, e.id])
    )

    // Actualizar estado a 'vencida' para actividades pendientes con fecha pasada
    const { data: paraMarcar } = await admin
      .from('actividades')
      .select('id, empresa_id')
      .lt('fecha_vencimiento', hoyInicio.toISOString())
      .eq('estado_clave', 'pendiente')
      .eq('en_papelera', false)

    let marcadas = 0
    if (paraMarcar && paraMarcar.length > 0) {
      // Agrupar por empresa para hacer batch updates
      const porEmpresa = new Map<string, string[]>()
      for (const act of paraMarcar) {
        const ids = porEmpresa.get(act.empresa_id) || []
        ids.push(act.id)
        porEmpresa.set(act.empresa_id, ids)
      }
      // Un update por empresa (en vez de uno por actividad)
      for (const [empresaId, ids] of porEmpresa) {
        const estadoId = estadoVencidaPorEmpresa.get(empresaId)
        if (estadoId) {
          await admin
            .from('actividades')
            .update({ estado_id: estadoId, estado_clave: 'vencida' })
            .in('id', ids)
          marcadas += ids.length
        }
      }
    }

    // 4. Actividades vencidas hace más de 1 día que siguen sin completar (recordatorio recurrente)
    const { data: vencidasPendientes } = await admin
      .from('actividades')
      .select('id, titulo, empresa_id, asignados, creado_por, fecha_vencimiento, tipo_id')
      .lt('fecha_vencimiento', ayerInicio.toISOString())
      .in('estado_clave', ['pendiente', 'vencida'])
      .eq('en_papelera', false)

    // Obtener tipos de actividad para las píldoras en notificaciones
    const todasActividades = [...(vencenHoy || []), ...(vencieronAyer || []), ...(vencidasPendientes || [])]
    const tipoIdsUnicos = [...new Set(todasActividades.map(a => a.tipo_id).filter(Boolean))]
    const tiposPorId = new Map<string, { etiqueta: string; color: string }>()
    if (tipoIdsUnicos.length > 0) {
      const { data: tipos } = await admin
        .from('tipos_actividad')
        .select('id, etiqueta, color')
        .in('id', tipoIdsUnicos)
      for (const t of tipos || []) tiposPorId.set(t.id, { etiqueta: t.etiqueta, color: t.color })
    }

    // Generar notificaciones
    const notificaciones: Parameters<typeof crearNotificacionesBatch>[0] = []

    // Helper: obtener destinatarios de una actividad (todos los asignados, o el creador como fallback)
    const obtenerDestinatarios = (act: { asignados: unknown; creado_por: string }) => {
      const lista = Array.isArray(act.asignados) ? (act.asignados as { id: string }[]).map(a => a.id) : []
      return lista.length > 0 ? lista : [act.creado_por].filter(Boolean)
    }

    // Vencen hoy
    for (const act of vencenHoy || []) {
      const tipo = tiposPorId.get(act.tipo_id)
      for (const destinatario of obtenerDestinatarios(act)) {
        notificaciones.push({
          empresaId: act.empresa_id,
          usuarioId: destinatario,
          tipo: 'actividad_pronto_vence',
          titulo: '⏰ Vence hoy',
          cuerpo: `${tipo?.etiqueta || 'Actividad'} · ${act.titulo}`,
          icono: 'Clock',
          color: tipo?.color || COLORES_HEX_ESTADO_ACTIVIDAD.pendiente,
          url: '/actividades',
          referenciaTipo: 'actividad',
          referenciaId: act.id,
        })
      }
    }

    // Vencieron ayer
    for (const act of vencieronAyer || []) {
      const tipo = tiposPorId.get(act.tipo_id)
      for (const destinatario of obtenerDestinatarios(act)) {
        notificaciones.push({
          empresaId: act.empresa_id,
          usuarioId: destinatario,
          tipo: 'actividad_vencida',
          titulo: '🚨 Venció ayer',
          cuerpo: `${tipo?.etiqueta || 'Actividad'} · ${act.titulo}`,
          icono: 'AlertCircle',
          color: tipo?.color || COLORES_HEX_ESTADO_ACTIVIDAD.vencida,
          url: '/actividades',
          referenciaTipo: 'actividad',
          referenciaId: act.id,
        })
      }
    }

    // Recordatorio recurrente de vencidas (más de 1 día)
    for (const act of vencidasPendientes || []) {
      const diasVencida = Math.floor((hoyInicio.getTime() - new Date(act.fecha_vencimiento).getTime()) / 86400000)
      const tipo = tiposPorId.get(act.tipo_id)
      for (const destinatario of obtenerDestinatarios(act)) {
        notificaciones.push({
          empresaId: act.empresa_id,
          usuarioId: destinatario,
          tipo: 'actividad_vencida',
          titulo: `🚨 Vencida hace ${diasVencida} día${diasVencida > 1 ? 's' : ''}`,
          cuerpo: `${tipo?.etiqueta || 'Actividad'} · ${act.titulo}`,
          icono: 'AlertCircle',
          color: tipo?.color || COLORES_HEX_ESTADO_ACTIVIDAD.vencida,
          url: '/actividades',
          referenciaTipo: 'actividad',
          referenciaId: act.id,
        })
      }
    }

    // ═══ Tareas de órdenes de trabajo ═══
    // Notificar tareas OT que vencen hoy o están vencidas
    const { data: tareasVencenHoy } = await admin
      .from('tareas_orden')
      .select('id, titulo, empresa_id, asignados, creado_por, orden_trabajo_id')
      .gte('fecha_vencimiento', hoyInicio.toISOString())
      .lt('fecha_vencimiento', hoyFin.toISOString())
      .eq('estado', 'pendiente')

    for (const tarea of tareasVencenHoy || []) {
      const destinatarios = (() => {
        const lista = Array.isArray(tarea.asignados) ? (tarea.asignados as { id: string }[]).map(a => a.id) : []
        return lista.length > 0 ? lista : [tarea.creado_por].filter(Boolean)
      })()
      for (const dest of destinatarios) {
        notificaciones.push({
          empresaId: tarea.empresa_id,
          usuarioId: dest,
          tipo: 'actividad_pronto_vence',
          titulo: '⏰ Tarea OT vence hoy',
          cuerpo: tarea.titulo,
          icono: 'Clock',
          color: COLORES_HEX_ESTADO_ACTIVIDAD.pendiente,
          url: `/ordenes/${tarea.orden_trabajo_id}`,
          referenciaTipo: 'tarea_orden',
          referenciaId: tarea.id,
        })
      }
    }

    const { data: tareasVencidas } = await admin
      .from('tareas_orden')
      .select('id, titulo, empresa_id, asignados, creado_por, orden_trabajo_id, fecha_vencimiento')
      .lt('fecha_vencimiento', hoyInicio.toISOString())
      .eq('estado', 'pendiente')

    for (const tarea of tareasVencidas || []) {
      const diasVencida = Math.floor((hoyInicio.getTime() - new Date(tarea.fecha_vencimiento).getTime()) / 86400000)
      const destinatarios = (() => {
        const lista = Array.isArray(tarea.asignados) ? (tarea.asignados as { id: string }[]).map(a => a.id) : []
        return lista.length > 0 ? lista : [tarea.creado_por].filter(Boolean)
      })()
      for (const dest of destinatarios) {
        notificaciones.push({
          empresaId: tarea.empresa_id,
          usuarioId: dest,
          tipo: 'actividad_vencida',
          titulo: `🚨 Tarea OT vencida hace ${diasVencida} día${diasVencida > 1 ? 's' : ''}`,
          cuerpo: tarea.titulo,
          icono: 'AlertCircle',
          color: COLORES_HEX_ESTADO_ACTIVIDAD.vencida,
          url: `/ordenes/${tarea.orden_trabajo_id}`,
          referenciaTipo: 'tarea_orden',
          referenciaId: tarea.id,
        })
      }
    }

    // Insertar notificaciones en batch
    await crearNotificacionesBatch(notificaciones)

    return NextResponse.json({
      vencen_hoy: (vencenHoy || []).length,
      vencieron_ayer: (vencieronAyer || []).length,
      vencidas_recordatorio: (vencidasPendientes || []).length,
      marcadas_vencida: marcadas,
      tareas_ot_vencen_hoy: (tareasVencenHoy || []).length,
      tareas_ot_vencidas: (tareasVencidas || []).length,
      notificaciones_enviadas: notificaciones.length,
      timestamp: ahora.toISOString(),
    })
  } catch (err) {
    console.error('Error en cron vencimientos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

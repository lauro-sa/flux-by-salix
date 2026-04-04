import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacionesBatch } from '@/lib/notificaciones'

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

    // 1. Actividades que vencen HOY (pendientes, con asignado o creador)
    const { data: vencenHoy } = await admin
      .from('actividades')
      .select('id, titulo, empresa_id, asignado_a, creado_por')
      .gte('fecha_vencimiento', hoyInicio.toISOString())
      .lt('fecha_vencimiento', hoyFin.toISOString())
      .in('estado_clave', ['pendiente'])
      .eq('en_papelera', false)

    // 2. Actividades que vencieron AYER (pendientes)
    const { data: vencieronAyer } = await admin
      .from('actividades')
      .select('id, titulo, empresa_id, asignado_a, creado_por')
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

    // Generar notificaciones
    const notificaciones: Parameters<typeof crearNotificacionesBatch>[0] = []

    // Vencen hoy
    for (const act of vencenHoy || []) {
      const destinatario = act.asignado_a || act.creado_por
      if (destinatario) {
        notificaciones.push({
          empresaId: act.empresa_id,
          usuarioId: destinatario,
          tipo: 'actividad_pronto_vence',
          titulo: '⏰ Vence hoy',
          cuerpo: `Actividad · ${act.titulo}`,
          icono: 'Clock',
          color: '#f5a623',
          url: '/actividades',
          referenciaTipo: 'actividad',
          referenciaId: act.id,
        })
      }
    }

    // Vencieron ayer
    for (const act of vencieronAyer || []) {
      const destinatario = act.asignado_a || act.creado_por
      if (destinatario) {
        notificaciones.push({
          empresaId: act.empresa_id,
          usuarioId: destinatario,
          tipo: 'actividad_vencida',
          titulo: '🚨 Vencida',
          cuerpo: `Actividad · ${act.titulo}`,
          icono: 'AlertCircle',
          color: '#e5484d',
          url: '/actividades',
          referenciaTipo: 'actividad',
          referenciaId: act.id,
        })
      }
    }

    // Insertar notificaciones en batch
    await crearNotificacionesBatch(notificaciones)

    return NextResponse.json({
      vencen_hoy: (vencenHoy || []).length,
      vencieron_ayer: (vencieronAyer || []).length,
      marcadas_vencida: marcadas,
      notificaciones_enviadas: notificaciones.length,
      timestamp: ahora.toISOString(),
    })
  } catch (err) {
    console.error('Error en cron vencimientos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

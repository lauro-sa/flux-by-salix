import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacionesBatch } from '@/lib/notificaciones'

/**
 * GET /api/cron/recordatorios — Cron que revisa recordatorios vencidos.
 * Ejecutado por Vercel Cron cada 5 minutos.
 *
 * Busca recordatorios activos cuya fecha+hora ya pasaron y crea notificaciones.
 * Si el recordatorio es recurrente, calcula la próxima fecha y actualiza.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()
    const ahora = new Date()
    const hoyISO = ahora.toISOString().split('T')[0]
    // Formato HH:MM en UTC para comparación consistente (sin depender de locale)
    const horaActual = `${String(ahora.getUTCHours()).padStart(2, '0')}:${String(ahora.getUTCMinutes()).padStart(2, '0')}`

    // Buscar recordatorios que ya vencieron:
    // 1. Fecha pasada (cualquier hora)
    // 2. Fecha de hoy con hora <= ahora
    // 3. Fecha de hoy sin hora (todo el día) — se notifica temprano
    const { data: vencidos } = await admin
      .from('recordatorios')
      .select('*')
      .eq('completado', false)
      .lte('fecha', hoyISO)
      .order('fecha', { ascending: true })
      .limit(200)

    if (!vencidos || vencidos.length === 0) {
      return NextResponse.json({ procesados: 0, timestamp: ahora.toISOString() })
    }

    // Filtrar: si tiene hora, solo notificar si la hora ya pasó
    const paraNotificar = vencidos.filter((r) => {
      if (r.fecha < hoyISO) return true // Fecha pasada → siempre notificar
      if (!r.hora) return true // Hoy sin hora → notificar
      return r.hora <= horaActual // Hoy con hora → solo si ya pasó
    })

    if (paraNotificar.length === 0) {
      return NextResponse.json({ procesados: 0, timestamp: ahora.toISOString() })
    }

    // Crear notificaciones
    const notificaciones = paraNotificar.map((r) => ({
      empresaId: r.empresa_id as string,
      usuarioId: r.asignado_a as string,
      tipo: 'recordatorio',
      titulo: `🔔 ${r.titulo as string}`,
      cuerpo: r.descripcion ? `Actividad · ${r.descripcion as string}` : undefined,
      icono: 'AlarmClock',
      color: 'var(--texto-marca)',
      url: undefined,
      referenciaTipo: 'recordatorio',
      referenciaId: r.id as string,
    }))

    await crearNotificacionesBatch(notificaciones)

    // Procesar recurrentes: calcular próxima fecha y actualizar
    // No recurrentes: marcar como completados
    let completados = 0
    let reprogramados = 0

    for (const r of paraNotificar) {
      if (r.repetir === 'ninguno') {
        // Marcar como completado
        await admin
          .from('recordatorios')
          .update({ completado: true, completado_en: ahora.toISOString() })
          .eq('id', r.id)
        completados++
      } else {
        // Calcular próxima fecha
        const proximaFecha = calcularProximaFecha(r.fecha, r.repetir, r.recurrencia)
        if (proximaFecha) {
          await admin
            .from('recordatorios')
            .update({ fecha: proximaFecha })
            .eq('id', r.id)
          reprogramados++
        } else {
          await admin
            .from('recordatorios')
            .update({ completado: true, completado_en: ahora.toISOString() })
            .eq('id', r.id)
          completados++
        }
      }
    }

    return NextResponse.json({
      procesados: paraNotificar.length,
      notificaciones_creadas: notificaciones.length,
      completados,
      reprogramados,
      timestamp: ahora.toISOString(),
    })
  } catch (err) {
    console.error('Error en cron recordatorios:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * Calcula la próxima fecha de un recordatorio recurrente.
 */
function calcularProximaFecha(
  fechaActual: string,
  repetir: string,
  _recurrencia?: unknown,
): string | null {
  const fecha = new Date(fechaActual + 'T12:00:00')
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0)

  switch (repetir) {
    case 'diario':
      fecha.setDate(fecha.getDate() + 1)
      break
    case 'semanal':
      fecha.setDate(fecha.getDate() + 7)
      break
    case 'mensual':
      fecha.setMonth(fecha.getMonth() + 1)
      break
    case 'anual':
      fecha.setFullYear(fecha.getFullYear() + 1)
      break
    default:
      return null
  }

  // Si la fecha calculada aún está en el pasado, avanzar hasta el futuro
  while (fecha < hoy) {
    switch (repetir) {
      case 'diario':
        fecha.setDate(fecha.getDate() + 1)
        break
      case 'semanal':
        fecha.setDate(fecha.getDate() + 7)
        break
      case 'mensual':
        fecha.setMonth(fecha.getMonth() + 1)
        break
      case 'anual':
        fecha.setFullYear(fecha.getFullYear() + 1)
        break
    }
  }

  return fecha.toISOString().split('T')[0]
}

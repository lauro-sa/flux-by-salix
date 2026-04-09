import { NextResponse } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/asistencias/recordatorio — Recordatorio de fichaje.
 * Se ejecuta cada 15 min entre 6-22h (configurable en vercel.json).
 * Envía notificación a miembros que:
 * - Están a 15 min de su hora de entrada y no ficharon
 * - Están a 30 min de su hora de salida y no ficharon salida
 */
export async function GET() {
  try {
    const admin = crearClienteAdmin()
    const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

    // Obtener empresas con zona horaria
    const { data: empresas } = await admin.from('empresas').select('id, zona_horaria')

    let notificacionesEnviadas = 0

    for (const empresa of (empresas || [])) {
      const empresaId = (empresa as Record<string, unknown>).id as string
      const zona = ((empresa as Record<string, unknown>).zona_horaria as string) || 'America/Argentina/Buenos_Aires'

      // Calcular hora y fecha en la zona horaria de la empresa
      const ahora = new Date()
      const horaLocal = ahora.toLocaleTimeString('en-GB', { timeZone: zona, hour12: false })
      const [hh, mm] = horaLocal.split(':').map(Number)
      const minutosAhora = hh * 60 + mm
      const fechaHoy = ahora.toLocaleDateString('en-CA', { timeZone: zona })
      const diaLocal = new Date(fechaHoy + 'T12:00:00')
      const diaHoy = diasSemana[diaLocal.getDay()]

      // Obtener turnos
      const { data: turnos } = await admin
        .from('turnos_laborales')
        .select('id, flexible, dias, tolerancia_min')
        .eq('empresa_id', empresaId)

      const turnoDefault = (turnos || []).find((t: Record<string, unknown>) => t.es_default) || (turnos || [])[0]
      if (!turnoDefault) continue

      // Miembros activos
      const { data: miembros } = await admin
        .from('miembros')
        .select('id, usuario_id, turno_id')
        .eq('empresa_id', empresaId)
        .eq('activo', true)

      if (!miembros || miembros.length === 0) continue

      // Asistencias de hoy
      const { data: asistHoy } = await admin
        .from('asistencias')
        .select('miembro_id, estado, hora_salida')
        .eq('empresa_id', empresaId)
        .eq('fecha', fechaHoy)

      const asistMap = new Map((asistHoy || []).map((a: Record<string, unknown>) => [a.miembro_id, a]))
      const turnoMap = new Map((turnos || []).map((t: Record<string, unknown>) => [t.id, t]))

      for (const miembro of miembros) {
        const m = miembro as Record<string, unknown>
        const turno = (m.turno_id ? turnoMap.get(m.turno_id) : turnoDefault) as Record<string, unknown> | undefined
        if (!turno || turno.flexible) continue

        const dias = turno.dias as Record<string, { activo: boolean; desde: string; hasta: string }> | null
        const diaConfig = dias?.[diaHoy]
        if (!diaConfig?.activo) continue

        const [hDesde, mDesde] = diaConfig.desde.split(':').map(Number)
        const [hHasta, mHasta] = diaConfig.hasta.split(':').map(Number)
        const minutosEntrada = hDesde * 60 + mDesde
        const minutosSalida = hHasta * 60 + mHasta

        const asist = asistMap.get(m.id) as Record<string, unknown> | undefined

        // Recordatorio de ENTRADA: 15 min antes de hora entrada, no fichó
        if (!asist) {
          const diffEntrada = minutosEntrada - minutosAhora
          if (diffEntrada >= 0 && diffEntrada <= 15) {
            // Crear notificación
            await admin.from('notificaciones').insert({
              empresa_id: empresaId,
              usuario_id: m.usuario_id,
              tipo: 'sistema',
              titulo: 'Recordatorio de fichaje',
              cuerpo: `Recordá fichar tu entrada. Tu horario empieza a las ${diaConfig.desde}.`,
              leida: false,
            })
            notificacionesEnviadas++
          }
        }

        // Recordatorio de SALIDA: 30 min antes de hora salida, fichó entrada pero no salida
        if (asist && !asist.hora_salida && asist.estado !== 'cerrado' && asist.estado !== 'auto_cerrado' && asist.estado !== 'ausente') {
          const diffSalida = minutosSalida - minutosAhora
          if (diffSalida >= 0 && diffSalida <= 30) {
            await admin.from('notificaciones').insert({
              empresa_id: empresaId,
              usuario_id: m.usuario_id,
              tipo: 'sistema',
              titulo: 'Recordatorio de salida',
              cuerpo: `Tu turno termina a las ${diaConfig.hasta}. Recordá fichar tu salida.`,
              leida: false,
            })
            notificacionesEnviadas++
          }
        }
      }
    }

    return NextResponse.json({ ok: true, notificaciones: notificacionesEnviadas })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

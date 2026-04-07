import { NextResponse, NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/asistencias/cron — Ejecutar tareas programadas de asistencias.
 * Body: { tarea: 'auto_checkout' | 'marcar_ausentes' }
 *
 * Diseñado para llamarse desde Vercel Cron o manualmente.
 * Header de autorización: CRON_SECRET para proteger el endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autorización (Vercel Cron envía el header, o usar secret)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { tarea } = body

    const admin = crearClienteAdmin()

    if (tarea === 'auto_checkout') {
      return await autoCheckout(admin)
    }

    if (tarea === 'marcar_ausentes') {
      return await marcarAusentes(admin)
    }

    return NextResponse.json({ error: `Tarea desconocida: ${tarea}` }, { status: 400 })
  } catch (err) {
    console.error('Error en cron asistencias:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * Auto-checkout: cierra turnos abiertos que superaron el tiempo máximo.
 * Se ejecuta a las 03:00 AM.
 */
async function autoCheckout(admin: ReturnType<typeof crearClienteAdmin>) {
  // Obtener todas las configs de empresas con auto_checkout habilitado
  const { data: configs } = await admin
    .from('config_asistencias')
    .select('empresa_id, auto_checkout_max_horas')
    .eq('auto_checkout_habilitado', true)

  let totalCerrados = 0

  for (const config of (configs || [])) {
    const maxMs = (config.auto_checkout_max_horas || 12) * 60 * 60 * 1000
    const cutoff = new Date(Date.now() - maxMs).toISOString()

    // Buscar turnos abiertos que superaron el límite
    const { data: abiertos } = await admin
      .from('asistencias')
      .select('id, hora_entrada')
      .eq('empresa_id', config.empresa_id)
      .in('estado', ['activo', 'almuerzo', 'particular'])
      .lte('hora_entrada', cutoff)

    if (!abiertos || abiertos.length === 0) continue

    for (const turno of abiertos) {
      const t = turno as Record<string, unknown>
      const entradaMs = new Date(t.hora_entrada as string).getTime()
      const salidaCalculada = new Date(entradaMs + maxMs).toISOString()

      await admin
        .from('asistencias')
        .update({
          hora_salida: salidaCalculada,
          estado: 'auto_cerrado',
          cierre_automatico: true,
          notas: `Cierre automático — turno superó ${config.auto_checkout_max_horas}h sin registrar salida`,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', t.id)

      totalCerrados++
    }
  }

  // También cerrar turnos sin config (default 12h)
  const cutoffDefault = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const configEmpresaIds = new Set((configs || []).map(c => c.empresa_id))

  const { data: abiertosSinConfig } = await admin
    .from('asistencias')
    .select('id, empresa_id, hora_entrada')
    .in('estado', ['activo', 'almuerzo', 'particular'])
    .lte('hora_entrada', cutoffDefault)

  for (const turno of (abiertosSinConfig || [])) {
    const t = turno as Record<string, unknown>
    if (configEmpresaIds.has(t.empresa_id as string)) continue // ya procesado

    const entradaMs = new Date(t.hora_entrada as string).getTime()
    const salidaCalculada = new Date(entradaMs + 12 * 60 * 60 * 1000).toISOString()

    await admin
      .from('asistencias')
      .update({
        hora_salida: salidaCalculada,
        estado: 'auto_cerrado',
        cierre_automatico: true,
        notas: 'Cierre automático — turno superó 12h sin registrar salida',
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', t.id)

    totalCerrados++
  }

  return NextResponse.json({ ok: true, tarea: 'auto_checkout', cerrados: totalCerrados })
}

/**
 * Marcar ausentes: crea registro de ausencia para quien no fichó en día laboral.
 * Se ejecuta a las 00:00 (medianoche).
 */
async function marcarAusentes(admin: ReturnType<typeof crearClienteAdmin>) {
  // Fecha de ayer
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  const fechaAyer = ayer.toISOString().split('T')[0]

  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const diaAyer = diasSemana[ayer.getDay()]

  // Obtener todas las empresas con sus turnos
  const { data: empresas } = await admin
    .from('empresas')
    .select('id')

  let totalAusencias = 0

  for (const empresa of (empresas || [])) {
    const empresaId = (empresa as Record<string, unknown>).id as string

    // Obtener turnos de la empresa
    const { data: turnos } = await admin
      .from('turnos_laborales')
      .select('id, flexible, dias')
      .eq('empresa_id', empresaId)

    // Obtener turno default
    const turnoDefault = (turnos || []).find((t: Record<string, unknown>) => t.es_default) || (turnos || [])[0]

    // Obtener miembros activos
    const { data: miembros } = await admin
      .from('miembros')
      .select('id, turno_id')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    if (!miembros || miembros.length === 0) continue

    // Obtener turnos de sectores para resolver herencia
    const { data: memSectores } = await admin
      .from('miembros_sectores')
      .select('miembro_id, sector:sectores(turno_id)')
      .eq('es_primario', true)

    const sectorTurnoMap = new Map((memSectores || []).map((ms: Record<string, unknown>) => {
      const sector = ms.sector as Record<string, unknown> | null
      return [ms.miembro_id, sector?.turno_id || null]
    }))

    const turnoMap = new Map((turnos || []).map((t: Record<string, unknown>) => [t.id, t]))

    // Obtener asistencias de ayer
    const { data: asistAyer } = await admin
      .from('asistencias')
      .select('miembro_id')
      .eq('empresa_id', empresaId)
      .eq('fecha', fechaAyer)

    const conRegistro = new Set((asistAyer || []).map((a: Record<string, unknown>) => a.miembro_id))

    // Verificar cada miembro
    const ausencias: Record<string, unknown>[] = []

    for (const miembro of miembros) {
      const m = miembro as Record<string, unknown>
      if (conRegistro.has(m.id)) continue // ya fichó

      // Resolver turno: miembro → sector → default
      let turnoId = m.turno_id as string | null
      if (!turnoId) turnoId = sectorTurnoMap.get(m.id) as string | null
      const turno = turnoId ? turnoMap.get(turnoId) : turnoDefault

      if (!turno) continue

      const t = turno as Record<string, unknown>
      if (t.flexible) continue // flexible no genera ausencia

      const dias = t.dias as Record<string, { activo: boolean }> | null
      if (!dias || !dias[diaAyer]?.activo) continue // no era día laboral

      ausencias.push({
        empresa_id: empresaId,
        miembro_id: m.id,
        fecha: fechaAyer,
        estado: 'ausente',
        tipo: 'ausencia',
        metodo_registro: 'sistema',
        notas: 'Marcado automático — no registró asistencia en día laboral',
      })
    }

    if (ausencias.length > 0) {
      await admin.from('asistencias').insert(ausencias)
      totalAusencias += ausencias.length
    }
  }

  return NextResponse.json({ ok: true, tarea: 'marcar_ausentes', ausencias: totalAusencias, fecha: fechaAyer })
}

/**
 * GET /api/asistencias/cron — Vercel Cron handler.
 * vercel.json configura los schedules.
 */
export async function GET(request: NextRequest) {
  // Vercel Cron llama con GET + query param
  const tarea = request.nextUrl.searchParams.get('tarea') || 'auto_checkout'

  const nuevoRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ tarea }),
    headers: { ...Object.fromEntries(request.headers), 'content-type': 'application/json' },
  })

  return POST(nuevoRequest)
}

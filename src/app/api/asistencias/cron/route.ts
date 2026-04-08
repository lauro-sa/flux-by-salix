import { NextResponse, NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import Holidays from 'date-holidays'

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

    if (tarea === 'rellenar_ausentes') {
      const desde = body.desde // YYYY-MM-DD obligatorio
      if (!desde) {
        return NextResponse.json({ error: 'Falta parámetro "desde" (YYYY-MM-DD)' }, { status: 400 })
      }
      return await rellenarAusentes(admin, desde)
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
    .select('id, pais')

  let totalAusencias = 0
  let totalFeriados = 0

  for (const empresa of (empresas || [])) {
    const empresaId = (empresa as Record<string, unknown>).id as string
    const paisEmpresa = ((empresa as Record<string, unknown>).pais as string) || 'AR'

    // Detectar si ayer fue feriado
    const hd = new Holidays(paisEmpresa)
    const feriadosAyer = hd.isHoliday(new Date(fechaAyer + 'T12:00:00'))
    const esFeriado = Array.isArray(feriadosAyer) && feriadosAyer.some(f => f.type === 'public')
    const nombreFeriado = esFeriado ? feriadosAyer.find(f => f.type === 'public')?.name || 'Feriado' : null

    // Obtener turnos de la empresa
    const { data: turnos } = await admin
      .from('turnos_laborales')
      .select('id, flexible, dias, es_default')
      .eq('empresa_id', empresaId)

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

    const registros: Record<string, unknown>[] = []

    for (const miembro of miembros) {
      const m = miembro as Record<string, unknown>
      if (conRegistro.has(m.id)) continue

      // Resolver turno: miembro → sector → default
      let turnoId = m.turno_id as string | null
      if (!turnoId) turnoId = sectorTurnoMap.get(m.id) as string | null
      const turno = turnoId ? turnoMap.get(turnoId) : turnoDefault

      if (!turno) continue
      const t = turno as Record<string, unknown>
      if (t.flexible) continue

      const dias = t.dias as Record<string, { activo: boolean }> | null
      if (!dias || !dias[diaAyer]?.activo) continue

      if (esFeriado) {
        registros.push({
          empresa_id: empresaId,
          miembro_id: m.id,
          fecha: fechaAyer,
          estado: 'feriado',
          tipo: 'feriado',
          metodo_registro: 'sistema',
          notas: nombreFeriado,
        })
        totalFeriados++
      } else {
        registros.push({
          empresa_id: empresaId,
          miembro_id: m.id,
          fecha: fechaAyer,
          estado: 'ausente',
          tipo: 'ausencia',
          metodo_registro: 'sistema',
          notas: 'Marcado automático — no registró asistencia en día laboral',
        })
        totalAusencias++
      }
    }

    if (registros.length > 0) {
      await admin.from('asistencias').insert(registros)
    }
  }

  return NextResponse.json({ ok: true, tarea: 'marcar_ausentes', ausencias: totalAusencias, feriados: totalFeriados, fecha: fechaAyer })
}

/**
 * Rellenar ausentes retroactivamente desde una fecha hasta ayer.
 * Itera día por día y aplica la misma lógica de marcarAusentes.
 */
async function rellenarAusentes(admin: ReturnType<typeof crearClienteAdmin>, desde: string) {
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

  // Calcular rango de fechas: desde → ayer
  const fechaInicio = new Date(desde + 'T12:00:00Z')
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  const fechaFin = new Date(ayer.toISOString().split('T')[0] + 'T12:00:00Z')

  if (fechaInicio > fechaFin) {
    return NextResponse.json({ error: 'La fecha "desde" es posterior a ayer' }, { status: 400 })
  }

  // Generar array de fechas
  const fechas: string[] = []
  const cursor = new Date(fechaInicio)
  while (cursor <= fechaFin) {
    fechas.push(cursor.toISOString().split('T')[0])
    cursor.setDate(cursor.getDate() + 1)
  }

  // Obtener todas las empresas
  const { data: empresas } = await admin.from('empresas').select('id, pais')

  let totalAusencias = 0
  let totalFeriados = 0

  for (const empresa of (empresas || [])) {
    const empresaId = (empresa as Record<string, unknown>).id as string
    const paisEmpresa = ((empresa as Record<string, unknown>).pais as string) || 'AR'

    // Construir set de feriados públicos para todo el rango
    const hd = new Holidays(paisEmpresa)
    const anios = new Set(fechas.map(f => parseInt(f.split('-')[0])))
    const feriadosMap = new Map<string, string>()
    for (const anio of anios) {
      for (const h of hd.getHolidays(anio)) {
        if (h.type === 'public') {
          const fechaFer = h.date.split(' ')[0]
          feriadosMap.set(fechaFer, h.name)
        }
      }
    }

    // Obtener turnos
    const { data: turnos } = await admin
      .from('turnos_laborales')
      .select('id, flexible, dias, es_default')
      .eq('empresa_id', empresaId)

    const turnoDefault = (turnos || []).find((t: Record<string, unknown>) => t.es_default) || (turnos || [])[0]
    const turnoMap = new Map((turnos || []).map((t: Record<string, unknown>) => [t.id, t]))

    // Obtener miembros activos
    const { data: miembros } = await admin
      .from('miembros')
      .select('id, turno_id')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    if (!miembros || miembros.length === 0) continue

    // Sectores → turno
    const { data: memSectores } = await admin
      .from('miembros_sectores')
      .select('miembro_id, sector:sectores(turno_id)')
      .eq('es_primario', true)

    const sectorTurnoMap = new Map((memSectores || []).map((ms: Record<string, unknown>) => {
      const sector = ms.sector as Record<string, unknown> | null
      return [ms.miembro_id, sector?.turno_id || null]
    }))

    // Obtener TODAS las asistencias del rango de una vez
    const { data: asistRango } = await admin
      .from('asistencias')
      .select('miembro_id, fecha')
      .eq('empresa_id', empresaId)
      .gte('fecha', fechas[0])
      .lte('fecha', fechas[fechas.length - 1])

    const registrosExistentes = new Set(
      (asistRango || []).map((a: Record<string, unknown>) => `${a.miembro_id}|${a.fecha}`)
    )

    const registros: Record<string, unknown>[] = []

    for (const fecha of fechas) {
      const d = new Date(fecha + 'T12:00:00Z')
      const diaSemana = diasSemana[d.getDay()]
      const esFeriado = feriadosMap.has(fecha)
      const nombreFeriado = feriadosMap.get(fecha)

      for (const miembro of miembros) {
        const m = miembro as Record<string, unknown>
        if (registrosExistentes.has(`${m.id}|${fecha}`)) continue

        // Resolver turno
        let turnoId = m.turno_id as string | null
        if (!turnoId) turnoId = sectorTurnoMap.get(m.id) as string | null
        const turno = turnoId ? turnoMap.get(turnoId) : turnoDefault

        if (!turno) continue
        const t = turno as Record<string, unknown>
        if (t.flexible) continue

        const dias = t.dias as Record<string, { activo: boolean }> | null
        if (!dias || !dias[diaSemana]?.activo) continue

        if (esFeriado) {
          registros.push({
            empresa_id: empresaId,
            miembro_id: m.id,
            fecha,
            estado: 'feriado',
            tipo: 'feriado',
            metodo_registro: 'sistema',
            notas: nombreFeriado,
          })
          totalFeriados++
        } else {
          registros.push({
            empresa_id: empresaId,
            miembro_id: m.id,
            fecha,
            estado: 'ausente',
            tipo: 'ausencia',
            metodo_registro: 'sistema',
            notas: 'Relleno retroactivo — no registró asistencia en día laboral',
          })
          totalAusencias++
        }
      }
    }

    // Insertar en lotes de 500
    for (let i = 0; i < registros.length; i += 500) {
      const lote = registros.slice(i, i + 500)
      await admin.from('asistencias').insert(lote)
    }
  }

  return NextResponse.json({
    ok: true,
    tarea: 'rellenar_ausentes',
    ausencias: totalAusencias,
    feriados: totalFeriados,
    rango: { desde: fechas[0], hasta: fechas[fechas.length - 1] },
    dias_procesados: fechas.length,
  })
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

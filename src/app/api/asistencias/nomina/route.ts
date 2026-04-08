import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import Holidays from 'date-holidays'

/**
 * GET /api/asistencias/nomina — Calcular nómina para un período.
 * Query params: desde, hasta (YYYY-MM-DD), empleados (csv), dias (csv)
 *
 * Calcula por cada miembro: días trabajados, ausencias, horas con desglose,
 * feriados, y monto a pagar. Las ausencias se calculan por diferencia entre
 * días laborales del turno y días con registro (no depende del cron).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')
    const empleadosFiltro = params.get('empleados')?.split(',').filter(Boolean) || null
    const diasFiltro = params.get('dias')?.split(',').filter(Boolean) || null
    if (!desde || !hasta) return NextResponse.json({ error: 'Parámetros desde y hasta requeridos' }, { status: 400 })

    const admin = crearClienteAdmin()

    // ─── Datos de la empresa ───
    const { data: empresaData } = await admin
      .from('empresas')
      .select('nombre, pais')
      .eq('id', empresaId)
      .single()

    const nombreEmpresa = (empresaData?.nombre as string) || ''
    const paisEmpresa = (empresaData?.pais as string) || 'AR'

    // ─── Feriados del país ───
    const hd = new Holidays(paisEmpresa)
    const anioDesde = parseInt(desde.split('-')[0])
    const anioHasta = parseInt(hasta.split('-')[0])
    const feriadosSet = new Set<string>()
    const feriadosNombres = new Map<string, string>()

    for (let anio = anioDesde; anio <= anioHasta; anio++) {
      for (const h of hd.getHolidays(anio)) {
        if (h.type === 'public') {
          const fechaStr = h.date.split(' ')[0]
          feriadosSet.add(fechaStr)
          feriadosNombres.set(fechaStr, h.name)
        }
      }
    }

    // ─── Config de asistencias ───
    const { data: configAsist } = await admin
      .from('config_asistencias')
      .select('descontar_almuerzo, duracion_almuerzo_min')
      .eq('empresa_id', empresaId)
      .single()

    const descontarAlmuerzo = (configAsist?.descontar_almuerzo as boolean) ?? true
    const duracionAlmuerzoMin = (configAsist?.duracion_almuerzo_min as number) ?? 60

    // ─── Turnos laborales ───
    const { data: turnosData } = await admin
      .from('turnos_laborales')
      .select('id, es_default, flexible, dias')
      .eq('empresa_id', empresaId)

    const turnoMap = new Map((turnosData || []).map((t: Record<string, unknown>) => [t.id, t]))
    const turnoDefault = (turnosData || []).find((t: Record<string, unknown>) => t.es_default) || (turnosData || [])[0]

    // ─── Turnos por sector (para herencia) ───
    const { data: memSectores } = await admin
      .from('miembros_sectores')
      .select('miembro_id, sector:sectores(turno_id)')
      .eq('es_primario', true)

    const sectorTurnoMap = new Map((memSectores || []).map((ms: Record<string, unknown>) => {
      const sector = ms.sector as Record<string, unknown> | null
      return [ms.miembro_id, sector?.turno_id || null]
    }))

    // ─── Miembros con datos de compensación ───
    let queryMiembros = admin
      .from('miembros')
      .select('id, usuario_id, turno_id, compensacion_tipo, compensacion_monto, compensacion_frecuencia, dias_trabajo')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    if (empleadosFiltro) queryMiembros = queryMiembros.in('id', empleadosFiltro)

    const { data: miembrosData } = await queryMiembros

    const { data: perfilesData } = await admin
      .from('perfiles')
      .select('id, nombre, apellido, correo_empresa, correo')

    const perfilMap = new Map((perfilesData || []).map((p: Record<string, unknown>) => [p.id, p]))

    // ─── Asistencias del período ───
    const { data: asistencias } = await admin
      .from('asistencias')
      .select('miembro_id, fecha, estado, tipo, hora_entrada, hora_salida, inicio_almuerzo, fin_almuerzo, salida_particular, vuelta_particular')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)

    const diasSet = diasFiltro ? new Set(diasFiltro) : null

    // Agrupar asistencias por miembro
    const asistPorMiembro = new Map<string, Record<string, unknown>[]>()
    for (const a of (asistencias || [])) {
      const r = a as Record<string, unknown>
      if (diasSet && !diasSet.has(r.fecha as string)) continue
      const mid = r.miembro_id as string
      if (!asistPorMiembro.has(mid)) asistPorMiembro.set(mid, [])
      asistPorMiembro.get(mid)!.push(r)
    }

    // ─── Helper: generar todas las fechas del período ───
    const diasSemanaStr = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

    function calcularDiasLaborales(
      turno: Record<string, unknown> | undefined,
    ): { total: number; fechas: string[]; feriados: string[] } {
      const diasConfig = (turno?.dias || {}) as Record<string, { activo: boolean }>
      const fechasLab: string[] = []
      const feriadosEnPeriodo: string[] = []

      // Si hay filtro de días, solo esos
      if (diasSet) {
        for (const f of diasSet) {
          if (feriadosSet.has(f)) {
            feriadosEnPeriodo.push(f)
            continue
          }
          const d = new Date(f + 'T12:00:00')
          const diaNombre = diasSemanaStr[d.getDay()]
          if (diasConfig[diaNombre]?.activo !== false) {
            fechasLab.push(f)
          }
        }
      } else {
        const d = new Date(desde + 'T12:00:00')
        const fin = new Date(hasta + 'T12:00:00')
        while (d <= fin) {
          const f = d.toISOString().split('T')[0]
          if (feriadosSet.has(f)) {
            feriadosEnPeriodo.push(f)
          } else {
            const diaNombre = diasSemanaStr[d.getDay()]
            if (diasConfig[diaNombre]?.activo !== false) {
              fechasLab.push(f)
            }
          }
          d.setDate(d.getDate() + 1)
        }
      }

      return { total: fechasLab.length, fechas: fechasLab, feriados: feriadosEnPeriodo }
    }

    // ─── Calcular por cada miembro ───
    const resultados = (miembrosData || []).map((miembro) => {
      const m = miembro as Record<string, unknown>
      const perfil = perfilMap.get(m.usuario_id) as Record<string, unknown> | undefined
      const nombre = perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Sin nombre'
      const correo = (perfil?.correo_empresa as string) || (perfil?.correo as string) || ''

      // Resolver turno: miembro → sector → default
      let turnoId = m.turno_id as string | null
      if (!turnoId) turnoId = sectorTurnoMap.get(m.id) as string | null
      const turno = turnoId ? turnoMap.get(turnoId) : turnoDefault

      // Calcular días laborales según el turno de este empleado
      const diasLab = calcularDiasLaborales(turno as Record<string, unknown> | undefined)
      const diasLaborales = diasLab.total
      const fechasLaborales = new Set(diasLab.fechas)
      const diasFeriadoCount = diasLab.feriados.length

      const registros = asistPorMiembro.get(m.id as string) || []

      // Días con registro de presencia (estado != ausente)
      const fechasConPresencia = new Set(
        registros.filter(r => r.estado !== 'ausente').map(r => r.fecha as string)
      )

      // Días trabajados = registros de presencia que caen en día laboral
      const diasTrabajados = [...fechasConPresencia].filter(f => fechasLaborales.has(f)).length

      // Ausencias = días laborales sin ningún registro de presencia
      // Esto funciona independientemente de si el cron corrió o no
      const diasAusentes = Math.max(0, diasLaborales - diasTrabajados)

      const diasTardanza = registros.filter(r => r.tipo === 'tardanza').length

      // ─── Calcular horas con desglose detallado ───
      let minutosBrutos = 0
      let minutosAlmuerzo = 0
      let minutosParticular = 0
      let diasConAlmuerzo = 0
      let diasConSalidaParticular = 0

      for (const r of registros) {
        if (!r.hora_entrada || r.estado === 'ausente') continue
        const entrada = new Date(r.hora_entrada as string).getTime()
        const salida = r.hora_salida ? new Date(r.hora_salida as string).getTime() : 0
        if (!salida) continue

        const minBrutos = Math.round((salida - entrada) / 60000)
        minutosBrutos += Math.max(0, minBrutos)

        if (r.inicio_almuerzo && r.fin_almuerzo) {
          const minAlm = Math.round((new Date(r.fin_almuerzo as string).getTime() - new Date(r.inicio_almuerzo as string).getTime()) / 60000)
          minutosAlmuerzo += Math.max(0, minAlm)
          diasConAlmuerzo++
        }

        if (r.salida_particular && r.vuelta_particular) {
          const minPart = Math.round((new Date(r.vuelta_particular as string).getTime() - new Date(r.salida_particular as string).getTime()) / 60000)
          minutosParticular += Math.max(0, minPart)
          diasConSalidaParticular++
        }
      }

      const minutosDescontados = (descontarAlmuerzo ? minutosAlmuerzo : 0) + minutosParticular
      const minutosNetos = Math.max(0, minutosBrutos - minutosDescontados)
      const horasBrutas = Math.round((minutosBrutos / 60) * 100) / 100
      const horasNetas = Math.round((minutosNetos / 60) * 100) / 100
      const horasAlmuerzo = Math.round((minutosAlmuerzo / 60) * 100) / 100
      const horasParticular = Math.round((minutosParticular / 60) * 100) / 100
      const horasTotales = horasNetas

      const promedioDiario = diasTrabajados > 0
        ? Math.round((minutosNetos / diasTrabajados / 60) * 100) / 100
        : 0

      // ─── Calcular monto a pagar ───
      const compTipo = (m.compensacion_tipo as string) || 'fijo'
      const compMonto = parseFloat(m.compensacion_monto as string) || 0
      const compFrecuencia = (m.compensacion_frecuencia as string) || 'mensual'
      const diasEsperados = (m.dias_trabajo as number) || 5

      let montoPagar = 0
      let montoDetalle = ''

      if (compTipo === 'fijo') {
        if (compFrecuencia === 'mensual') {
          const diasMes = 22
          montoPagar = (compMonto / diasMes) * diasTrabajados
          montoDetalle = `$${compMonto.toLocaleString('es-AR')} mensual × ${diasTrabajados}/${diasMes} días`
        } else if (compFrecuencia === 'quincenal') {
          const diasQuincena = 11
          montoPagar = (compMonto / diasQuincena) * diasTrabajados
          montoDetalle = `$${compMonto.toLocaleString('es-AR')} quincenal × ${diasTrabajados}/${diasQuincena} días`
        } else if (compFrecuencia === 'semanal') {
          const diasSemana = diasEsperados
          montoPagar = (compMonto / diasSemana) * diasTrabajados
          montoDetalle = `$${compMonto.toLocaleString('es-AR')} semanal × ${diasTrabajados}/${diasSemana} días`
        }
      } else if (compTipo === 'por_dia') {
        montoPagar = compMonto * diasTrabajados
        montoDetalle = `$${compMonto.toLocaleString('es-AR')} × ${diasTrabajados} días`
      } else if (compTipo === 'por_hora') {
        montoPagar = compMonto * horasTotales
        montoDetalle = `$${compMonto.toLocaleString('es-AR')} × ${horasTotales}h`
      }

      return {
        miembro_id: m.id,
        nombre,
        correo,
        compensacion_tipo: compTipo,
        compensacion_monto: compMonto,
        compensacion_frecuencia: compFrecuencia,
        dias_laborales: diasLaborales,
        dias_trabajados: diasTrabajados,
        dias_ausentes: diasAusentes,
        dias_tardanza: diasTardanza,
        dias_feriados: diasFeriadoCount,
        // Horas detalladas
        horas_brutas: horasBrutas,
        horas_netas: horasNetas,
        horas_almuerzo: horasAlmuerzo,
        horas_particular: horasParticular,
        horas_totales: horasTotales,
        promedio_horas_diario: promedioDiario,
        dias_con_almuerzo: diasConAlmuerzo,
        dias_con_salida_particular: diasConSalidaParticular,
        descuenta_almuerzo: descontarAlmuerzo,
        duracion_almuerzo_config: duracionAlmuerzoMin,
        // Pago
        monto_pagar: Math.round(montoPagar * 100) / 100,
        monto_detalle: montoDetalle,
      }
    })

    return NextResponse.json({
      desde, hasta,
      dias_laborales: resultados[0]?.dias_laborales || 0,
      nombre_empresa: nombreEmpresa,
      feriados_periodo: diasLab_feriadosResumen(feriadosNombres, desde, hasta),
      resultados: resultados.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** Resumen de feriados que caen en el período (para info) */
function diasLab_feriadosResumen(
  nombres: Map<string, string>,
  desde: string,
  hasta: string,
): { fecha: string; nombre: string }[] {
  const resultado: { fecha: string; nombre: string }[] = []
  for (const [fecha, nombre] of nombres) {
    if (fecha >= desde && fecha <= hasta) {
      resultado.push({ fecha, nombre })
    }
  }
  return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

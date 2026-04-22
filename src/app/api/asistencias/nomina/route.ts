import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { resolverCorreoNotif, resolverTelefonoNotif } from '@/lib/miembros/canal-notif'
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
    // Requiere ver_todos de asistencias: la nómina expone sueldos del equipo.
    // Sin este guard, cualquier empleado autenticado podía ver los montos.
    const guard = await requerirPermisoAPI('asistencias', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

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
      .select('descontar_almuerzo, duracion_almuerzo_min, umbral_jornada_completa_pct, umbral_media_jornada_pct, modo_pago_parcial')
      .eq('empresa_id', empresaId)
      .single()

    const descontarAlmuerzo = (configAsist?.descontar_almuerzo as boolean) ?? true
    const duracionAlmuerzoMin = (configAsist?.duracion_almuerzo_min as number) ?? 60
    const umbralCompletaPct = (configAsist?.umbral_jornada_completa_pct as number) ?? 75
    const umbralMediaPct = (configAsist?.umbral_media_jornada_pct as number) ?? 25
    const modoPagoParcial = (configAsist?.modo_pago_parcial as 'no_paga' | 'media_jornada' | 'proporcional') ?? 'no_paga'

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

    // ─── Miembros con datos de compensación + canales de notificación ───
    let queryMiembros = admin
      .from('miembros')
      .select('id, usuario_id, turno_id, compensacion_tipo, compensacion_monto, compensacion_frecuencia, dias_trabajo, canal_notif_correo, canal_notif_telefono, puesto_nombre, unido_en, foto_kiosco_url, numero_empleado')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    if (empleadosFiltro) queryMiembros = queryMiembros.in('id', empleadosFiltro)

    const { data: miembrosData } = await queryMiembros

    const { data: perfilesData } = await admin
      .from('perfiles')
      .select('id, nombre, apellido, correo_empresa, correo, telefono, telefono_empresa, documento_tipo, documento_numero')

    const perfilMap = new Map((perfilesData || []).map((p: Record<string, unknown>) => [p.id, p]))

    // Fallback para empleados sin cuenta Flux: nombre desde contacto equipo
    const miembrosIds = (miembrosData || []).map((m: Record<string, unknown>) => m.id as string)
    const { data: contactosEquipo } = miembrosIds.length > 0
      ? await admin
          .from('contactos')
          .select('miembro_id, nombre, apellido')
          .in('miembro_id', miembrosIds)
          .eq('en_papelera', false)
      : { data: [] as Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null }> }
    const contactoMapNomina = new Map(
      (contactosEquipo || []).filter(c => c.miembro_id).map(c => [c.miembro_id as string, c])
    )

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

    /** Genera las fechas del período separadas en laborales y feriados según el turno */
    function calcularDiasDelPeriodo(
      turno: Record<string, unknown> | undefined,
    ): { fechasLaborales: string[]; fechasFeriado: string[] } {
      const diasConfig = (turno?.dias || {}) as Record<string, { activo: boolean }>
      const fechasLab: string[] = []
      const fechasFer: string[] = []

      const fechas = diasSet ? Array.from(diasSet) : (() => {
        const arr: string[] = []
        const d = new Date(desde + 'T12:00:00')
        const fin = new Date(hasta + 'T12:00:00')
        while (d <= fin) {
          arr.push(d.toISOString().split('T')[0])
          d.setDate(d.getDate() + 1)
        }
        return arr
      })()

      for (const f of fechas) {
        const d = new Date(f + 'T12:00:00')
        const diaNombre = diasSemanaStr[d.getDay()]
        const esActivo = diasConfig[diaNombre]?.activo !== false

        if (feriadosSet.has(f) && esActivo) {
          // Es feriado en día laboral — no cuenta como laboral, pero se suma aparte
          fechasFer.push(f)
        } else if (!feriadosSet.has(f) && esActivo) {
          fechasLab.push(f)
        }
      }

      return { fechasLaborales: fechasLab, fechasFeriado: fechasFer }
    }

    // ─── Adelantos: cuotas pendientes por miembro ───
    // Cuotas del período: pendientes Y descontadas (para mostrar desglose completo)
    const { data: cuotasDelPeriodoData } = await admin
      .from('adelantos_cuotas')
      .select('miembro_id, monto_cuota, adelanto_id, numero_cuota, estado, fecha_programada')
      .eq('empresa_id', empresaId)
      .in('estado', ['pendiente', 'descontada'])
      .gte('fecha_programada', desde)
      .lte('fecha_programada', hasta)

    // Agrupar cuotas por miembro (solo pendientes afectan el monto neto)
    const cuotasPorMiembro = new Map<string, { monto: number; cantidad: number; detalle: Record<string, unknown>[] }>()
    for (const c of (cuotasDelPeriodoData || []) as Record<string, unknown>[]) {
      const mid = c.miembro_id as string
      if (!cuotasPorMiembro.has(mid)) cuotasPorMiembro.set(mid, { monto: 0, cantidad: 0, detalle: [] })
      const entry = cuotasPorMiembro.get(mid)!
      // Todas las cuotas del período se descuentan (pendientes y ya descontadas)
      entry.monto += parseFloat(c.monto_cuota as string)
      entry.cantidad++
      entry.detalle.push(c)
    }

    // ─── Saldo anterior: pagos del período anterior por miembro ───
    // Busca si en el período anterior se pagó de más o de menos
    const { data: pagosAnterioresData } = await admin
      .from('pagos_nomina')
      .select('miembro_id, monto_sugerido, monto_abonado, fecha_inicio_periodo, fecha_fin_periodo')
      .eq('empresa_id', empresaId)
      .eq('eliminado', false)
      .lt('fecha_fin_periodo', desde)
      .order('fecha_fin_periodo', { ascending: false })

    // Para cada miembro, tomar el último pago anterior y calcular diferencia
    const saldoAnteriorPorMiembro = new Map<string, number>()
    const miembrosYaProcesados = new Set<string>()
    for (const p of (pagosAnterioresData || []) as Record<string, unknown>[]) {
      const mid = p.miembro_id as string
      if (miembrosYaProcesados.has(mid)) continue
      miembrosYaProcesados.add(mid)
      const sugerido = parseFloat(p.monto_sugerido as string) || 0
      const abonado = parseFloat(p.monto_abonado as string) || 0
      const diferencia = abonado - sugerido // positivo = pagó de más (a favor), negativo = debe
      if (diferencia !== 0) saldoAnteriorPorMiembro.set(mid, diferencia)
    }

    // ─── Calcular por cada miembro ───
    const resultados = (miembrosData || []).map((miembro) => {
      const m = miembro as Record<string, unknown>
      const perfil = perfilMap.get(m.usuario_id) as Record<string, unknown> | undefined
      const contactoEquipo = contactoMapNomina.get(m.id as string)
      const nombre = perfil && (perfil.nombre || perfil.apellido)
        ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim()
        : contactoEquipo && (contactoEquipo.nombre || contactoEquipo.apellido)
          ? `${contactoEquipo.nombre || ''} ${contactoEquipo.apellido || ''}`.trim()
          : 'Sin nombre'
      // Resolver correo/teléfono según canal elegido del miembro (sin fallback).
      // Si el canal elegido está vacío, el campo va vacío — la UI avisa y los
      // endpoints de envío devuelven error explícito al intentar enviar.
      const correo = resolverCorreoNotif({
        correo: perfil?.correo as string | null,
        correo_empresa: perfil?.correo_empresa as string | null,
        canal_notif_correo: m.canal_notif_correo as 'empresa' | 'personal' | null,
      }) || ''
      const telefono = resolverTelefonoNotif({
        telefono: perfil?.telefono as string | null,
        telefono_empresa: perfil?.telefono_empresa as string | null,
        canal_notif_telefono: m.canal_notif_telefono as 'empresa' | 'personal' | null,
      }) || ''
      const canalCorreo = (m.canal_notif_correo as string) || 'empresa'
      const canalTelefono = (m.canal_notif_telefono as string) || 'empresa'

      // Resolver turno: miembro → sector → default
      let turnoId = m.turno_id as string | null
      if (!turnoId) turnoId = sectorTurnoMap.get(m.id) as string | null
      const turno = turnoId ? turnoMap.get(turnoId) : turnoDefault

      // Calcular días laborales y feriados según el turno de este empleado
      const diasPeriodo = calcularDiasDelPeriodo(turno as Record<string, unknown> | undefined)
      const fechasLaboralesSet = new Set(diasPeriodo.fechasLaborales)
      const fechasFeriadoSet = new Set(diasPeriodo.fechasFeriado)

      const registros = asistPorMiembro.get(m.id as string) || []

      // Presencia real = tiene hora_entrada (exclye ausentes, feriados sin fichaje, auto_cerrado sin entrada)
      const fechasConPresencia = new Set(
        registros.filter(r => r.hora_entrada != null).map(r => r.fecha as string)
      )

      // Días trabajados en días laborales normales
      const diasTrabajadosNormales = [...fechasConPresencia].filter(f => fechasLaboralesSet.has(f)).length

      // Días trabajados en feriado (vino a trabajar un feriado)
      const diasTrabajadosEnFeriado = [...fechasConPresencia].filter(f => fechasFeriadoSet.has(f)).length

      // Total de días laborales (feriados no cuentan como laborales)
      const diasLaborales = diasPeriodo.fechasLaborales.length

      // Total trabajados = normales + feriados
      const diasTrabajados = diasTrabajadosNormales + diasTrabajadosEnFeriado

      // Ausencias = días laborales donde no fichó (feriados no generan ausencia)
      const diasAusentes = Math.max(0, diasLaborales - diasTrabajadosNormales)

      // Feriados en el período (solo los que caen en días activos del turno)
      const diasFeriadoCount = diasPeriodo.fechasFeriado.length

      // Feriados no trabajados (para empleados fijos, estos se pagan igual)
      const feriadosNOTrabajados = diasFeriadoCount - diasTrabajadosEnFeriado

      const diasTardanza = registros.filter(r => r.tipo === 'tardanza').length

      // ─── Minutos esperados por día del turno (para clasificar jornada) ───
      // turno.dias: {lunes: {activo, desde: "09:00", hasta: "18:00"}, ...}
      const turnoObj = turno as Record<string, unknown> | undefined
      const diasConfigTurno = (turnoObj?.dias || {}) as Record<string, { activo?: boolean; desde?: string; hasta?: string }>
      const minutosDeHora = (hhmm?: string): number => {
        if (!hhmm) return 0
        const [hh, mm] = hhmm.split(':').map(Number)
        return (hh || 0) * 60 + (mm || 0)
      }
      const minutosEsperadosDia = (fechaISO: string): number => {
        const d = new Date(fechaISO + 'T12:00:00')
        const cfg = diasConfigTurno[diasSemanaStr[d.getDay()]]
        if (!cfg || cfg.activo === false || !cfg.desde || !cfg.hasta) return 0
        const bruto = Math.max(0, minutosDeHora(cfg.hasta) - minutosDeHora(cfg.desde))
        return Math.max(0, bruto - (descontarAlmuerzo ? duracionAlmuerzoMin : 0))
      }

      // ─── Calcular horas con desglose detallado + clasificar cada día ───
      let minutosBrutos = 0
      let minutosAlmuerzo = 0
      let minutosParticular = 0
      let diasConAlmuerzo = 0
      let diasConSalidaParticular = 0

      // Clasificación por día para personal jornalero y para mostrar en UI
      let diasJornadaCompleta = 0
      let diasMediaJornada = 0
      let diasPresenteParcial = 0
      // Factor acumulado de jornadas (para pago por_dia). Suma 1 por completa,
      // 0.5 por media, y según modo_pago_parcial para parciales.
      let factorJornadasTotal = 0

      // Clasificación concreta por fecha (para armar dias_detalle al final)
      const clasificacionPorFecha = new Map<string, 'completa' | 'media' | 'parcial'>()

      for (const r of registros) {
        if (!r.hora_entrada || r.estado === 'ausente') continue
        const entrada = new Date(r.hora_entrada as string).getTime()
        const salida = r.hora_salida ? new Date(r.hora_salida as string).getTime() : 0

        // Si no tiene salida todavía, saltamos los cálculos de minutos
        // pero no clasificamos el día (no sabemos aún cuánto trabajó)
        if (!salida) continue

        const minBrutos = Math.round((salida - entrada) / 60000)
        minutosBrutos += Math.max(0, minBrutos)

        let minAlmDia = 0
        if (r.inicio_almuerzo && r.fin_almuerzo) {
          minAlmDia = Math.round((new Date(r.fin_almuerzo as string).getTime() - new Date(r.inicio_almuerzo as string).getTime()) / 60000)
          minAlmDia = Math.max(0, minAlmDia)
          minutosAlmuerzo += minAlmDia
          diasConAlmuerzo++
        }

        let minPartDia = 0
        if (r.salida_particular && r.vuelta_particular) {
          minPartDia = Math.round((new Date(r.vuelta_particular as string).getTime() - new Date(r.salida_particular as string).getTime()) / 60000)
          minPartDia = Math.max(0, minPartDia)
          minutosParticular += minPartDia
          diasConSalidaParticular++
        }

        // Minutos netos del día (lo mismo que se descuenta en el total)
        const minNetosDia = Math.max(0, minBrutos - (descontarAlmuerzo ? minAlmDia : 0) - minPartDia)

        // Clasificar según porcentaje respecto a los minutos esperados del turno
        const esperadosDia = minutosEsperadosDia(r.fecha as string)
        if (esperadosDia > 0 && minNetosDia > 0) {
          const pct = (minNetosDia / esperadosDia) * 100
          if (pct >= umbralCompletaPct) {
            diasJornadaCompleta++
            factorJornadasTotal += 1
            clasificacionPorFecha.set(r.fecha as string, 'completa')
          } else if (pct >= umbralMediaPct) {
            diasMediaJornada++
            factorJornadasTotal += 0.5
            clasificacionPorFecha.set(r.fecha as string, 'media')
          } else {
            diasPresenteParcial++
            // El factor de pago de un parcial depende de la política elegida
            if (modoPagoParcial === 'media_jornada') {
              factorJornadasTotal += 0.5
            } else if (modoPagoParcial === 'proporcional') {
              factorJornadasTotal += pct / 100
            }
            // 'no_paga' → factor 0 (no suma)
            clasificacionPorFecha.set(r.fecha as string, 'parcial')
          }
        } else if (minNetosDia > 0) {
          // Sin turno configurado para ese día (o día no laboral como feriado):
          // contamos como completa para no penalizar (misma lógica previa).
          diasJornadaCompleta++
          factorJornadasTotal += 1
          clasificacionPorFecha.set(r.fecha as string, 'completa')
        }
      }

      // Detalle día a día del período — para el mini-calendario de la UI.
      // Incluye TODAS las fechas (laborales, feriados y no laborales).
      const todasLasFechas: string[] = diasSet
        ? Array.from(diasSet).sort()
        : (() => {
            const arr: string[] = []
            const d = new Date(desde + 'T12:00:00')
            const fin = new Date(hasta + 'T12:00:00')
            while (d <= fin) {
              arr.push(d.toISOString().split('T')[0])
              d.setDate(d.getDate() + 1)
            }
            return arr
          })()

      const dias_detalle = todasLasFechas.map((f) => {
        const cls = clasificacionPorFecha.get(f)
        const esLaboral = fechasLaboralesSet.has(f)
        const esFeriado = fechasFeriadoSet.has(f)

        let clasificacion: 'completa' | 'media' | 'parcial' | 'ausente' | 'feriado' | 'feriado_trabajado' | 'no_laboral'
        if (cls && esFeriado) clasificacion = 'feriado_trabajado'
        else if (cls) clasificacion = cls
        else if (esFeriado) clasificacion = 'feriado'
        else if (esLaboral) clasificacion = 'ausente'
        else clasificacion = 'no_laboral'

        return { fecha: f, clasificacion }
      })

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
        // Sueldo fijo: se paga el monto completo según frecuencia.
        // Si el empleador quiere descontar por ausencias, lo ajusta manualmente al pagar.
        montoPagar = compMonto

        if (compFrecuencia === 'mensual') {
          montoDetalle = `Sueldo fijo mensual`
        } else if (compFrecuencia === 'quincenal') {
          montoDetalle = `Sueldo fijo quincenal`
        } else if (compFrecuencia === 'semanal') {
          montoDetalle = `Sueldo fijo semanal`
        }
      } else if (compTipo === 'por_dia') {
        // Por día: se paga según la clasificación de cada jornada (completa=1, media=0.5,
        // parcial=según modoPagoParcial). El total se expresa como "jornales equivalentes".
        const jornalesEquivalentes = Math.round(factorJornadasTotal * 100) / 100
        montoPagar = compMonto * jornalesEquivalentes
        const partes: string[] = []
        if (diasJornadaCompleta > 0) partes.push(`${diasJornadaCompleta} completa${diasJornadaCompleta === 1 ? '' : 's'}`)
        if (diasMediaJornada > 0) partes.push(`${diasMediaJornada} media${diasMediaJornada === 1 ? '' : 's'}`)
        if (diasPresenteParcial > 0) partes.push(`${diasPresenteParcial} parcial${diasPresenteParcial === 1 ? '' : 'es'}`)
        const detalleDias = partes.length > 0 ? partes.join(' + ') : `${diasTrabajados} días`
        montoDetalle = `$${compMonto.toLocaleString('es-AR')} × ${jornalesEquivalentes} (${detalleDias})`
      } else if (compTipo === 'por_hora') {
        // Por hora: solo horas efectivamente trabajadas
        montoPagar = compMonto * horasTotales
        montoDetalle = `$${compMonto.toLocaleString('es-AR')} × ${horasTotales}h`
      }

      // Datos de identidad/identificación del empleado (para el cabezal del detalle)
      const puesto = (m.puesto_nombre as string | null) || null
      const fechaIngreso = (m.unido_en as string | null) || null
      // numero_empleado es integer en DB — lo pasamos como string para la UI
      const numeroEmpleado = m.numero_empleado != null ? String(m.numero_empleado) : null
      const fotoUrl = (m.foto_kiosco_url as string | null) || null
      // Documento viene del perfil (si tiene cuenta Flux)
      const docTipo = perfil?.documento_tipo as string | null | undefined
      const docNumero = perfil?.documento_numero as string | null | undefined
      const documento = docNumero ? { tipo: docTipo || 'DOC', numero: docNumero } : null

      return {
        miembro_id: m.id,
        nombre,
        correo,
        telefono,
        canal_notif_correo: canalCorreo,
        canal_notif_telefono: canalTelefono,
        puesto,
        fecha_ingreso: fechaIngreso,
        numero_empleado: numeroEmpleado,
        foto_url: fotoUrl,
        documento,
        compensacion_tipo: compTipo,
        compensacion_monto: compMonto,
        compensacion_frecuencia: compFrecuencia,
        dias_laborales: diasLaborales,
        dias_trabajados: diasTrabajados,
        dias_ausentes: diasAusentes,
        dias_tardanza: diasTardanza,
        dias_feriados: diasFeriadoCount,
        dias_trabajados_feriado: diasTrabajadosEnFeriado,
        // Clasificación por jornada (para jornaleros)
        dias_jornada_completa: diasJornadaCompleta,
        dias_media_jornada: diasMediaJornada,
        dias_presente_parcial: diasPresenteParcial,
        jornales_equivalentes: Math.round(factorJornadasTotal * 100) / 100,
        // Detalle día a día para calendarios/vistas UI
        dias_detalle,
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
        // Pago (bruto)
        monto_pagar: Math.round(montoPagar * 100) / 100,
        monto_detalle: montoDetalle,
        // Adelantos
        descuento_adelanto: Math.round((cuotasPorMiembro.get(m.id as string)?.monto || 0) * 100) / 100,
        cuotas_adelanto: cuotasPorMiembro.get(m.id as string)?.cantidad || 0,
        // Saldo anterior (positivo = a favor del empleado, negativo = le deben descontar)
        saldo_anterior: Math.round((saldoAnteriorPorMiembro.get(m.id as string) || 0) * 100) / 100,
        monto_neto: Math.round((
          montoPagar
          - (cuotasPorMiembro.get(m.id as string)?.monto || 0)
          - (saldoAnteriorPorMiembro.get(m.id as string) || 0) // restar si pagó de más antes
        ) * 100) / 100,
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

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { resolverDatosContactoMiembro } from '@/lib/miembros/datos-contacto'
import { cargarEtiquetasMiembros } from '@/lib/miembros/etiquetas'
import { cargarIdentidadMiembros } from '@/lib/miembros/identidad'
import { formatearFechaISO } from '@/lib/formato-fecha'
import {
  parsearCondicion,
  evaluarCondicion,
  calcularMontoConcepto,
  esUltimaLiquidacionDelMes,
  calcularBasicoMensual,
} from '@/lib/nominas/motor-calculo'
import type {
  ContratoLaboral,
  ConceptoNomina,
  ConceptoAplicadoCalculado,
  MetricasAsistencia,
} from '@/tipos/nominas'
import Holidays from 'date-holidays'

/**
 * GET /api/nominas — Calcular nómina para un período.
 * Query params: desde, hasta (YYYY-MM-DD), empleados (csv), dias (csv)
 *
 * Calcula por cada miembro: días trabajados, ausencias, horas con desglose,
 * feriados, y monto a pagar. Las ausencias se calculan por diferencia entre
 * días laborales del turno y días con registro (no depende del cron).
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Nómina es un módulo propio (ya no depende de asistencias).
    //   ver_todos  → sueldos del equipo completo.
    //   ver_propio → solo el recibo del miembro autenticado.
    const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
    if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')
    let empleadosFiltro = params.get('empleados')?.split(',').filter(Boolean) || null
    const diasFiltro = params.get('dias')?.split(',').filter(Boolean) || null
    if (!desde || !hasta) return NextResponse.json({ error: 'Parámetros desde y hasta requeridos' }, { status: 400 })

    const admin = crearClienteAdmin()

    // ─── Datos de la empresa ───
    const { data: empresaData } = await admin
      .from('empresas')
      .select('nombre, pais, zona_horaria')
      .eq('id', empresaId)
      .single()

    const nombreEmpresa = (empresaData?.nombre as string) || ''
    const paisEmpresa = (empresaData?.pais as string) || 'AR'
    // Zona horaria de la empresa (default Buenos Aires). El server de
    // Vercel corre en UTC, así que cualquier "hoy" calculado debe
    // pasar por esta zona — sino días futuros del período en curso
    // se cuentan mal como ausentes pasadas.
    const zonaHorariaEmpresa = (empresaData?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const hoyISO = formatearFechaISO(new Date(), zonaHorariaEmpresa)

    // ─── Feriados y días no laborables ───
    // Distinguimos DOS conjuntos porque la legislación argentina los
    // trata distinto y eso impacta directamente en los conceptos de
    // "pago doble por trabajar en feriado":
    //
    //   • `feriadosSet` (nacional / puente / empresa / regional):
    //     son días de descanso obligatorio pagado. Si el empleado va a
    //     trabajar, corresponde pago doble. La librería `date-holidays`
    //     solo devuelve estos con `type === 'public'`.
    //
    //   • `diasNoLaborablesSet` (no_laborable):
    //     el empleador decide si abre. Si abre y el empleado va, se
    //     paga normal (no doble). Si no abre, no hay ausencia. Para el
    //     cálculo de "días laborales del período", estos días se tratan
    //     como días que simplemente no estaban planificados —ni laboral
    //     ni feriado.
    const hd = new Holidays(paisEmpresa)
    const anioDesde = parseInt(desde.split('-')[0])
    const anioHasta = parseInt(hasta.split('-')[0])
    const feriadosSet = new Set<string>()
    const diasNoLaborablesSet = new Set<string>()
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

    // Feriados configurados por la empresa (tabla `feriados`).
    // Cargamos un rango amplio (todo el año del período) porque el
    // cálculo mensual puede evaluar días del mes fuera de [desde,
    // hasta] cuando el período es la última liquidación del mes.
    // Mapeamos el `tipo` para meter cada fila en el set correcto.
    const { data: feriadosEmpresa } = await admin
      .from('feriados')
      .select('fecha, nombre, tipo')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .gte('fecha', `${anioDesde}-01-01`)
      .lte('fecha', `${anioHasta}-12-31`)
    if (feriadosEmpresa) {
      for (const f of feriadosEmpresa) {
        const fechaStr = f.fecha as string
        const tipo = (f.tipo as string) || 'nacional'
        if (tipo === 'no_laborable') {
          diasNoLaborablesSet.add(fechaStr)
        } else {
          // nacional | puente | empresa | regional → pago doble
          feriadosSet.add(fechaStr)
          feriadosNombres.set(fechaStr, f.nombre as string)
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

    // ver_propio: forzar que la nómina devuelva solo al miembro autenticado.
    // Si el cliente pasa `empleados` en el filtro, lo intersectamos con su id.
    if (vis.soloPropio) {
      const { data: miembroPropio } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      const idPropio = miembroPropio?.id as string | undefined
      if (!idPropio) {
        return NextResponse.json({ desde, hasta, dias_laborales: 0, nombre_empresa: nombreEmpresa, feriados_periodo: [], resultados: [] })
      }
      empleadosFiltro = empleadosFiltro
        ? empleadosFiltro.filter(id => id === idPropio)
        : [idPropio]
      if (empleadosFiltro.length === 0) {
        return NextResponse.json({ desde, hasta, dias_laborales: 0, nombre_empresa: nombreEmpresa, feriados_periodo: [], resultados: [] })
      }
    }

    // ─── Setting de visibilidad de empleados terminados ───
    // Default false: si el contrato del miembro terminó antes del período,
    // no aparece en el listado. Si la empresa activa el setting, sí aparece
    // (en gris con $0 — la UI lo decide).
    const { data: configNomina } = await admin
      .from('configuracion_nomina_empresa')
      .select('mostrar_empleados_terminados')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    const mostrarTerminados = !!configNomina?.mostrar_empleados_terminados

    // ─── Miembros con datos de compensación + canales de notificación ───
    let queryMiembros = admin
      .from('miembros')
      .select('id, usuario_id, turno_id, compensacion_tipo, compensacion_monto, compensacion_frecuencia, dias_trabajo, canal_notif_correo, canal_notif_telefono, puesto_id, unido_en, foto_kiosco_url, numero_empleado')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    if (empleadosFiltro) queryMiembros = queryMiembros.in('id', empleadosFiltro)

    const { data: miembrosDataRaw } = await queryMiembros

    // ─── Filtrar empleados con contrato terminado antes del período ───
    // Cargamos el último contrato (por fecha_inicio desc) de cada miembro y,
    // si no está vigente y `fecha_fin < desde`, lo consideramos "terminado
    // antes". Lo excluimos del listado salvo que el setting esté en true.
    const miembroIds = (miembrosDataRaw || []).map((m: Record<string, unknown>) => m.id as string)
    let miembrosTerminadosAntes = new Set<string>()
    if (miembroIds.length > 0) {
      const { data: contratosRaw } = await admin
        .from('contratos_laborales')
        .select('miembro_id, vigente, fecha_fin, fecha_inicio')
        .eq('empresa_id', empresaId)
        .in('miembro_id', miembroIds)
        .order('fecha_inicio', { ascending: false })
      const ultimoPorMiembro = new Map<string, { vigente: boolean; fecha_fin: string | null }>()
      for (const c of (contratosRaw || []) as Array<{ miembro_id: string; vigente: boolean; fecha_fin: string | null }>) {
        if (!ultimoPorMiembro.has(c.miembro_id)) {
          ultimoPorMiembro.set(c.miembro_id, { vigente: c.vigente, fecha_fin: c.fecha_fin })
        }
      }
      for (const [mid, c] of ultimoPorMiembro) {
        if (!c.vigente && c.fecha_fin && c.fecha_fin < desde) {
          miembrosTerminadosAntes.add(mid)
        }
      }
    }
    const miembrosData = mostrarTerminados
      ? miembrosDataRaw
      : (miembrosDataRaw || []).filter((m: Record<string, unknown>) =>
          !miembrosTerminadosAntes.has(m.id as string),
        )

    // ─── Contratos vigentes + conceptos aplicables ───
    // Cargamos en dos pasos:
    //   1) El contrato vigente de cada miembro (con fecha_inicio para
    //      evaluar condiciones tipo "antigüedad ≥ N años").
    //   2) Los conceptos asignados (activos) a esos contratos, con el
    //      detalle completo del catálogo (modo_calculo, condicion_jsonb,
    //      tipo, etc) para que el motor pueda evaluarlos.
    // Se aplican luego en el loop por miembro, sumando haberes y
    // restando descuentos sobre el monto base.
    const contratoVigentePorMiembro = new Map<string, ContratoLaboral>()
    const conceptosPorMiembro = new Map<string, Array<{ valor_override: number | string | null; concepto: ConceptoNomina }>>()
    const miembrosFinalesIds = (miembrosData || []).map((m: Record<string, unknown>) => m.id as string)

    if (miembrosFinalesIds.length > 0) {
      const { data: contratosVigentes } = await admin
        .from('contratos_laborales')
        .select('*')
        .eq('empresa_id', empresaId)
        .in('miembro_id', miembrosFinalesIds)
        .eq('vigente', true)

      for (const c of (contratosVigentes ?? []) as ContratoLaboral[]) {
        contratoVigentePorMiembro.set(c.miembro_id, c)
      }

      const contratoIds = (contratosVigentes ?? []).map(c => (c as ContratoLaboral).id)
      if (contratoIds.length > 0) {
        const { data: asignaciones } = await admin
          .from('conceptos_contrato')
          .select('contrato_id, valor_override, concepto:conceptos_nomina(*)')
          .eq('empresa_id', empresaId)
          .in('contrato_id', contratoIds)
          .eq('activo', true)

        const contratoIdAMiembro = new Map<string, string>()
        for (const [mid, c] of contratoVigentePorMiembro) contratoIdAMiembro.set(c.id, mid)

        // El join `concepto:conceptos_nomina(*)` lo tipa Supabase como
        // array por defecto, pero la relación es many-to-one — viene
        // siempre un solo objeto. Casteamos vía unknown para evitar el
        // error de TypeScript sin que el código tenga que envolver en
        // arrays innecesarios.
        type FilaAsignacion = {
          contrato_id: string
          valor_override: number | string | null
          concepto: ConceptoNomina
        }
        for (const a of ((asignaciones ?? []) as unknown as FilaAsignacion[])) {
          const miembroId = contratoIdAMiembro.get(a.contrato_id)
          if (!miembroId || !a.concepto) continue
          if (!conceptosPorMiembro.has(miembroId)) conceptosPorMiembro.set(miembroId, [])
          conceptosPorMiembro.get(miembroId)!.push({
            valor_override: a.valor_override,
            concepto: a.concepto,
          })
        }
      }
    }

    // Identidad consolidada (perfil para miembros con cuenta Flux, contacto-equipo
    // para los cargados a mano). Reemplaza las dos queries previas a `perfiles` y
    // `contactos`. Ver src/lib/miembros/identidad.ts.
    const identidades = await cargarIdentidadMiembros(
      admin,
      (miembrosData || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        usuario_id: (m.usuario_id as string | null) ?? null,
      })),
      empresaId,
    )

    // Etiquetas de puesto/sector (vía FK puesto_id + miembros_sectores)
    const etiquetasNomina = await cargarEtiquetasMiembros(
      admin,
      (miembrosData || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        puesto_id: (m.puesto_id as string | null) ?? null,
      })),
    )

    // ─── Asistencias del período ───
    const { data: asistencias } = await admin
      .from('asistencias')
      .select('miembro_id, fecha, estado, tipo, hora_entrada, hora_salida, inicio_almuerzo, fin_almuerzo, salida_particular, vuelta_particular')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)

    // ─── Asistencias del MES entero (para conceptos mensuales) ───
    //
    // Los conceptos `periodicidad='mensual'` evalúan su condición sobre
    // el mes completo, no sobre el período del recibo. Por ejemplo,
    // Presentismo "sin ausencias" considera el mes entero — si el
    // empleado faltó en Q1 pero cobra Q2, el premio no aplica.
    //
    // Carga: solo si hay al menos un concepto mensual activo asignado
    // a algún miembro del listado, y solo cuando el período del recibo
    // sea la última liquidación del mes (sino no se va a aplicar igual).
    // El rango del mes se toma del `hasta`.
    const [yHasta, mHasta] = hasta.split('-').map(Number)
    const primerDiaMes = `${yHasta}-${String(mHasta).padStart(2, '0')}-01`
    const ultimoDiaMesNum = new Date(yHasta, mHasta, 0).getDate()
    const ultimoDiaMes = `${yHasta}-${String(mHasta).padStart(2, '0')}-${String(ultimoDiaMesNum).padStart(2, '0')}`
    const periodoEsUltimaDelMes = esUltimaLiquidacionDelMes(desde, hasta)
    // Cargamos solo si el período actual ES la última del mes y abarca
    // un rango menor al mes (es decir, hay días del mes fuera del período).
    const necesitaAsistenciasMes = periodoEsUltimaDelMes && (desde > primerDiaMes || hasta < ultimoDiaMes)
    let asistenciasMes: Record<string, unknown>[] | null = null
    if (necesitaAsistenciasMes) {
      const { data } = await admin
        .from('asistencias')
        .select('miembro_id, fecha, estado, tipo, hora_entrada')
        .eq('empresa_id', empresaId)
        .gte('fecha', primerDiaMes)
        .lte('fecha', ultimoDiaMes)
      asistenciasMes = data || []
    }
    const asistenciasMesPorMiembro = new Map<string, Record<string, unknown>[]>()
    for (const a of asistenciasMes ?? []) {
      const r = a as Record<string, unknown>
      const mid = r.miembro_id as string
      if (!asistenciasMesPorMiembro.has(mid)) asistenciasMesPorMiembro.set(mid, [])
      asistenciasMesPorMiembro.get(mid)!.push(r)
    }

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

    /** Genera las fechas del período separadas en laborales y feriados según el turno.
     *
     *  Reglas:
     *   - Día activo del turno + feriado (pago doble) → `fechasFeriado`.
     *   - Día activo del turno + sin feriado y sin no_laborable → `fechasLaborales`.
     *   - Día no_laborable: NUNCA cuenta como laboral ni como feriado. El
     *     empleador puede o no abrir; si abre y el empleado va se procesa
     *     como día trabajado normal (no genera doble pago), pero si no va
     *     no genera ausencia.
     *   - Día no activo del turno (ej: domingo no laborable según turno):
     *     se descarta.
     */
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
        if (!esActivo) continue

        // Día no_laborable: queda fuera del esquema de laboral/feriado.
        // Si el empleado vino igual, se cuenta vía `fechasConPresencia`
        // como día trabajado normal sin generar doble pago.
        if (diasNoLaborablesSet.has(f)) continue

        if (feriadosSet.has(f)) {
          fechasFer.push(f)
        } else {
          fechasLab.push(f)
        }
      }

      return { fechasLaborales: fechasLab, fechasFeriado: fechasFer }
    }

    // ─── Ajustes del período: cuotas (adelanto/descuento/bono) ───
    // Joineamos con adelantos_nomina para arrastrar el `tipo`, que
    // decide si la cuota RESTA al neto (adelanto/descuento) o lo SUMA
    // (bono). Filtramos pendientes y descontadas para mostrar el
    // desglose completo del período.
    const { data: cuotasDelPeriodoData } = await admin
      .from('adelantos_cuotas')
      .select('miembro_id, monto_cuota, adelanto_id, numero_cuota, estado, fecha_programada, adelanto:adelantos_nomina!inner(tipo)')
      .eq('empresa_id', empresaId)
      .in('estado', ['pendiente', 'descontada'])
      .gte('fecha_programada', desde)
      .lte('fecha_programada', hasta)

    // Agrupamos por miembro separando descuentos (adelanto + descuento)
    // de bonos. Si llega una cuota sin tipo (legacy), se asume
    // 'adelanto' por compatibilidad — comportamiento histórico.
    const cuotasPorMiembro = new Map<string, { monto: number; cantidad: number; detalle: Record<string, unknown>[] }>()
    const bonosPorMiembro = new Map<string, { monto: number; cantidad: number; detalle: Record<string, unknown>[] }>()
    for (const c of (cuotasDelPeriodoData || []) as Record<string, unknown>[]) {
      const mid = c.miembro_id as string
      const adelantoRaw = c.adelanto as { tipo?: 'adelanto' | 'descuento' | 'bono' } | null | undefined
      const tipo = adelantoRaw?.tipo ?? 'adelanto'
      const monto = parseFloat(c.monto_cuota as string)
      if (tipo === 'bono') {
        if (!bonosPorMiembro.has(mid)) bonosPorMiembro.set(mid, { monto: 0, cantidad: 0, detalle: [] })
        const entry = bonosPorMiembro.get(mid)!
        entry.monto += monto
        entry.cantidad++
        entry.detalle.push(c)
      } else {
        if (!cuotasPorMiembro.has(mid)) cuotasPorMiembro.set(mid, { monto: 0, cantidad: 0, detalle: [] })
        const entry = cuotasPorMiembro.get(mid)!
        entry.monto += monto
        entry.cantidad++
        entry.detalle.push(c)
      }
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
      // Reconstruimos los shapes de perfil / contactoEquipo a partir de la
      // identidad consolidada para mantener intacto el contrato de
      // `resolverDatosContactoMiembro` (que necesita saber la fuente para
      // aplicar la lógica de canal personal vs empresa).
      const identidad = identidades.get(m.id as string)
      const datosContacto = resolverDatosContactoMiembro({
        miembro: {
          canal_notif_correo: m.canal_notif_correo as 'empresa' | 'personal' | null,
          canal_notif_telefono: m.canal_notif_telefono as 'empresa' | 'personal' | null,
        },
        perfil: identidad?.fuente === 'perfil'
          ? {
              nombre: identidad.nombre,
              apellido: identidad.apellido,
              correo: identidad.correo,
              correo_empresa: identidad.correo_empresa,
              telefono: identidad.telefono,
              telefono_empresa: identidad.telefono_empresa,
              documento_tipo: identidad.documento_tipo,
              documento_numero: identidad.documento_numero,
            }
          : null,
        contactoEquipo: identidad?.fuente === 'contacto_equipo'
          ? {
              nombre: identidad.nombre,
              apellido: identidad.apellido,
              correo: identidad.correo,
              telefono: identidad.telefono,
              tipo_identificacion: identidad.documento_tipo,
              numero_identificacion: identidad.documento_numero,
            }
          : null,
      })
      const nombre = datosContacto.nombre_completo || 'Sin nombre'
      const correo = datosContacto.correo || ''
      const telefono = datosContacto.telefono || ''
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

      // Ausencias = días laborales PASADOS donde no fichó.
      // Los días futuros del período (todavía no llegaron) NO son
      // ausentes — son pendientes. Sin este filtro, una liquidación
      // del mes en curso al día 15 mostraba los lun-vie del 16 al 31
      // como ausentes, dando un conteo absurdo.
      const fechasLaboralesPasadas = diasPeriodo.fechasLaborales.filter(f => f <= hoyISO)
      const diasTrabajadosPasados = [...fechasConPresencia]
        .filter(f => fechasLaboralesSet.has(f) && f <= hoyISO).length
      const diasAusentes = Math.max(0, fechasLaboralesPasadas.length - diasTrabajadosPasados)

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
      // Minutos netos efectivamente trabajados por fecha. Lo usa el
      // mini-calendario de la UI para mostrar "8h 30m" en el tooltip
      // del día sin tener que recalcular en el cliente.
      const minutosNetosPorFecha = new Map<string, number>()

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
        if (minNetosDia > 0) minutosNetosPorFecha.set(r.fecha as string, minNetosDia)

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

        const min = minutosNetosPorFecha.get(f)
        const horas_netas = min !== undefined ? min / 60 : null
        return { fecha: f, clasificacion, horas_netas }
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
      // Fuente de verdad: el contrato laboral vigente. La columna
      // legacy `miembros.compensacion_*` queda como fallback solo
      // cuando el empleado no tiene contrato cargado todavía. Esto
      // arregla el caso clásico: contrato renovado con monto nuevo
      // pero `miembros.compensacion_monto` sin actualizar — la UI
      // mostraba el viejo y el cálculo era incorrecto.
      const contratoCompMiembro = contratoVigentePorMiembro.get(m.id as string) ?? null
      let compTipo: string
      let compMonto: number
      let compFrecuencia: string
      if (contratoCompMiembro) {
        // Modalidad del contrato → tipo de compensación de la UI:
        //   por_hora → 'por_hora'
        //   por_dia  → 'por_dia'
        //   fijo_*   → 'fijo' (mensual/quincenal/semanal)
        const mod = contratoCompMiembro.modalidad_calculo
        compTipo = mod === 'por_hora' ? 'por_hora'
          : mod === 'por_dia' ? 'por_dia'
          : 'fijo'
        compMonto = Number(contratoCompMiembro.monto_base) || 0
        compFrecuencia = contratoCompMiembro.frecuencia_pago || 'mensual'
      } else {
        compTipo = (m.compensacion_tipo as string) || 'fijo'
        compMonto = parseFloat(m.compensacion_monto as string) || 0
        compFrecuencia = (m.compensacion_frecuencia as string) || 'mensual'
      }
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

      // ─── Aplicar conceptos del contrato (haberes y descuentos) ───
      //
      // Cada concepto declara su `periodicidad`:
      //   - 'por_periodo': se aplica en cada liquidación con métricas del período.
      //   - 'mensual': solo aplica en la última liquidación del mes; se evalúa
      //     la condición sobre el MES completo y el monto se calcula sobre
      //     el básico MENSUAL del empleado. Esto evita que un Presentismo
      //     10% se cobre dos veces si la frecuencia es quincenal.
      //   - 'unico': reservado.
      //
      // Régimen: agnóstico — un contrato informal puede tener Presentismo
      // y Antigüedad igual que uno en relación de dependencia.
      const conceptosAplicados: ConceptoAplicadoCalculado[] = []
      let totalHaberes = 0
      let totalDescuentosConceptos = 0
      // Reusamos el lookup que hicimos arriba para resolver compensación.
      const contratoVigenteMiembro = contratoCompMiembro
      const conceptosDelMiembro = conceptosPorMiembro.get(m.id as string) ?? []

      if (conceptosDelMiembro.length > 0) {
        // ─── Métricas del PERÍODO (para conceptos por_periodo) ───
        const metricasPeriodo: MetricasAsistencia = {
          dias_periodo: todasLasFechas.length,
          dias_trabajados: diasTrabajados,
          dias_ausentes: diasAusentes,
          tardanzas: diasTardanza,
          horas_netas: horasNetas,
          // Días que el empleado fichó en un feriado (alimenta la
          // condición "trabajo_feriado" del motor).
          dias_feriados_trabajados: diasTrabajadosEnFeriado,
        }

        // ─── Métricas del MES (para conceptos mensuales) ───
        // Si el período cubre el mes entero, las métricas mensuales son
        // las del período. Si no, las calculamos sobre las asistencias
        // del mes que cargamos al principio.
        let metricasMes: MetricasAsistencia = metricasPeriodo
        let basicoMensual = montoPagar
        if (contratoVigenteMiembro && periodoEsUltimaDelMes) {
          // Días laborales del mes según el turno del empleado
          const fechasMesArr: string[] = []
          const d = new Date(primerDiaMes + 'T12:00:00')
          const finMes = new Date(ultimoDiaMes + 'T12:00:00')
          while (d <= finMes) {
            fechasMesArr.push(d.toISOString().split('T')[0])
            d.setDate(d.getDate() + 1)
          }
          let diasLaboralesMes = 0
          for (const f of fechasMesArr) {
            const dt = new Date(f + 'T12:00:00')
            const diaNombre = diasSemanaStr[dt.getDay()]
            const turnoObjMes = turno as Record<string, unknown> | undefined
            const cfg = (turnoObjMes?.dias as Record<string, { activo?: boolean }> | undefined)?.[diaNombre]
            const esActivo = cfg?.activo !== false
            // Mismo criterio que calcularDiasDelPeriodo: día activo del
            // turno y NO feriado y NO no_laborable.
            if (esActivo && !feriadosSet.has(f) && !diasNoLaborablesSet.has(f)) {
              diasLaboralesMes++
            }
          }
          // Métricas reales del mes (asistencias del mes si las cargamos, sino del período)
          const asistMes = necesitaAsistenciasMes
            ? (asistenciasMesPorMiembro.get(m.id as string) ?? [])
            : registros
          const diasTrabajadosMes = new Set(
            asistMes.filter(r => r.hora_entrada != null).map(r => r.fecha as string),
          ).size
          const diasAusentesMes = asistMes.filter(r => r.estado === 'ausente').length
          const tardanzasMes = asistMes.filter(r => r.tipo === 'tardanza').length
          // Feriados del mes que el empleado vino a trabajar (fichó entrada).
          const diasFeriadosTrabajadosMes = asistMes
            .filter(r => r.hora_entrada != null && feriadosSet.has(r.fecha as string))
            .length
          metricasMes = {
            dias_periodo: fechasMesArr.length,
            dias_trabajados: diasTrabajadosMes,
            dias_ausentes: Math.max(0, diasLaboralesMes - diasTrabajadosMes),
            tardanzas: tardanzasMes,
            horas_netas: horasNetas, // del período (heurística — el mes completo no se calcula por costo)
            dias_feriados_trabajados: diasFeriadosTrabajadosMes,
          }
          // Suplementar: si dias_ausentes calculado por asistencias es mayor, usarlo
          if (diasAusentesMes > metricasMes.dias_ausentes) {
            metricasMes = { ...metricasMes, dias_ausentes: diasAusentesMes }
          }
          basicoMensual = calcularBasicoMensual(
            contratoVigenteMiembro.modalidad_calculo,
            Number(contratoVigenteMiembro.monto_base),
            diasLaboralesMes,
          )
        }

        for (const cc of conceptosDelMiembro) {
          const c = cc.concepto
          if (!c.activo) continue
          if (!c.automatico) continue

          // Decidir si este concepto aplica AHORA según su periodicidad
          if (c.periodicidad === 'mensual' && !periodoEsUltimaDelMes) {
            // El concepto vendrá en la última liquidación del mes — no aquí.
            continue
          }
          if (c.periodicidad === 'unico') {
            // Reservado: se implementa con tabla de "ya aplicado por contrato".
            continue
          }

          // Métricas y base según periodicidad
          const esMensual = c.periodicidad === 'mensual'
          const metricas = esMensual ? metricasMes : metricasPeriodo
          const baseCalculo = esMensual ? basicoMensual : montoPagar

          const valorBase = cc.valor_override !== null && cc.valor_override !== undefined
            ? Number(cc.valor_override)
            : (c.valor !== null && c.valor !== undefined ? Number(c.valor) : null)

          const condicion = parsearCondicion(c.condicion_jsonb as Record<string, unknown> | null)
          const evaluacion = evaluarCondicion(condicion, metricas, contratoVigenteMiembro, hasta)
          if (!evaluacion.cumple) continue

          const montoConcepto = calcularMontoConcepto(c.modo_calculo, valorBase, baseCalculo, metricas)
          const detalleConPeriodicidad = esMensual
            ? `${evaluacion.detalle ?? ''}${evaluacion.detalle ? ' · ' : ''}calculado sobre el básico mensual`.trim()
            : evaluacion.detalle

          conceptosAplicados.push({
            concepto_id: c.id,
            nombre: c.nombre,
            tipo: c.tipo,
            modo_calculo: c.modo_calculo,
            valor: valorBase,
            monto: Math.round(montoConcepto * 100) / 100,
            automatico: c.automatico,
            detalle: detalleConPeriodicidad,
          })
          if (c.tipo === 'haber') totalHaberes += montoConcepto
          else totalDescuentosConceptos += montoConcepto
        }
        totalHaberes = Math.round(totalHaberes * 100) / 100
        totalDescuentosConceptos = Math.round(totalDescuentosConceptos * 100) / 100
      }

      // Datos de identidad/identificación del empleado (para el cabezal del detalle)
      const puesto = etiquetasNomina.get(m.id as string)?.puesto ?? null
      const fechaIngreso = (m.unido_en as string | null) || null
      // numero_empleado es integer en DB — lo pasamos como string para la UI
      const numeroEmpleado = m.numero_empleado != null ? String(m.numero_empleado) : null
      const fotoUrl = (m.foto_kiosco_url as string | null) || null
      // Documento solo se guarda en perfiles. Empleados sin cuenta Flux no tienen.
      const documento = datosContacto.documento_numero
        ? { tipo: datosContacto.documento_tipo || 'DOC', numero: datosContacto.documento_numero }
        : null

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
        // Pago — bruto base (sueldo según modalidad, sin conceptos extra)
        monto_pagar: Math.round(montoPagar * 100) / 100,
        monto_detalle: montoDetalle,
        // Conceptos aplicados al contrato. La UI los desglosa en
        // secciones HABERES / DESCUENTOS junto con adelantos/saldo.
        conceptos_aplicados: conceptosAplicados,
        total_haberes: totalHaberes,
        total_descuentos_conceptos: totalDescuentosConceptos,
        // Adelantos / descuentos del período (RESTAN del neto)
        descuento_adelanto: Math.round((cuotasPorMiembro.get(m.id as string)?.monto || 0) * 100) / 100,
        cuotas_adelanto: cuotasPorMiembro.get(m.id as string)?.cantidad || 0,
        // Bonos del período (SUMAN al neto)
        bonos_periodo: Math.round((bonosPorMiembro.get(m.id as string)?.monto || 0) * 100) / 100,
        cuotas_bonos: bonosPorMiembro.get(m.id as string)?.cantidad || 0,
        // Saldo anterior (positivo = a favor del empleado, negativo = le deben descontar)
        saldo_anterior: Math.round((saldoAnteriorPorMiembro.get(m.id as string) || 0) * 100) / 100,
        // Neto = bruto + haberes + bonos - descuentos conceptos - adelantos - saldo
        monto_neto: Math.round((
          montoPagar
          + totalHaberes
          + (bonosPorMiembro.get(m.id as string)?.monto || 0)
          - totalDescuentosConceptos
          - (cuotasPorMiembro.get(m.id as string)?.monto || 0)
          - (saldoAnteriorPorMiembro.get(m.id as string) || 0)
        ) * 100) / 100,
        // Flag para que la UI muestre en gris los empleados terminados.
        // Solo aparece como true cuando el setting `mostrar_empleados_terminados`
        // está activo y el último contrato del miembro terminó antes del período.
        contrato_terminado_antes: miembrosTerminadosAntes.has(m.id as string),
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

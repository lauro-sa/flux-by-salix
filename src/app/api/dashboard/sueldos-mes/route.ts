import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/logger'
import { cargarEtiquetasMiembros } from '@/lib/miembros/etiquetas'
import { obtenerComponentesFecha } from '@/lib/formato-fecha'

/**
 * GET /api/dashboard/sueldos-mes?mes=YYYY-MM
 *
 * Resumen de nómina del mes navegable, agrupado por miembro.
 *
 * Cada miembro puede tener múltiples pagos en el mes según su frecuencia
 * (semanal: 4-5 pagos, quincenal: 2, mensual: 1, eventual: variable).
 *
 * Toma los `pagos_nomina` cuyo `fecha_fin_periodo` cae en el mes solicitado
 * y los agrupa por miembro, mostrando totales y detalle de cada pago.
 *
 * Permiso: `nomina:ver_todos`.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const datosMiembro = await obtenerDatosMiembro(user.id, empresaId)
    if (!datosMiembro) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })

    if (!verificarPermiso(datosMiembro, 'nomina', 'ver_todos')) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const params = request.nextUrl.searchParams
    const mes = params.get('mes')
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: 'Parámetro mes (YYYY-MM) requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Rango del mes solicitado
    const [anioStr, mesStr] = mes.split('-')
    const inicioMes = `${anioStr}-${mesStr}-01`
    const ultimoDia = new Date(parseInt(anioStr), parseInt(mesStr), 0).getDate()
    const finMes = `${anioStr}-${mesStr}-${String(ultimoDia).padStart(2, '0')}`

    // Hoy en zona horaria de la empresa: necesitamos saber dónde estamos parados
    // dentro del mes para calcular "lo devengado al día" (cuánto debería estar pagado
    // a la fecha) vs "estimado del mes" (proyección al cierre).
    const { data: empresaData } = await admin
      .from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zonaHoraria = (empresaData?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const hoyComp = obtenerComponentesFecha(new Date(), zonaHoraria)
    const hoyISO = `${hoyComp.anio}-${String(hoyComp.mes).padStart(2, '0')}-${String(hoyComp.dia).padStart(2, '0')}`
    const claveHoyMes = hoyISO.slice(0, 7)
    const esMesPasado = mes < claveHoyMes
    const esMesFuturo = mes > claveHoyMes
    const esMesEnCurso = mes === claveHoyMes

    // ─── Pagos de nómina ───
    // Usamos select('*') para evitar fallos silenciosos por columnas que
    // pueden no existir (ej: fecha_pago no se inserta nunca, podría no
    // estar en la tabla). Filtramos empresa y eliminado en JS.
    const { data: pagosData, error: pagosError } = await admin
      .from('pagos_nomina')
      .select('*')

    type PagoRow = {
      id: string
      empresa_id: string
      miembro_id: string
      monto_sugerido: string | number | null
      monto_abonado: string | number | null
      concepto: string | null
      fecha_inicio_periodo: string | null
      fecha_fin_periodo: string | null
      fecha_pago: string | null
      creado_en: string | null
      dias_habiles: number | null
      dias_trabajados: number | null
      dias_ausentes: number | null
      tardanzas: number | null
      notas: string | null
      eliminado: boolean | null
    }

    /** Devuelve true si la fecha (string YYYY-MM-DD o ISO) cae en el mes */
    const fechaEnMes = (f: string | null | undefined): boolean => {
      if (!f) return false
      return f.slice(0, 7) === mes
    }
    /** Devuelve true si el período [inicio, fin] se solapa con el mes */
    const periodoSolapa = (inicio: string | null, fin: string | null): boolean => {
      if (!inicio && !fin) return false
      const ini = inicio || fin || ''
      const f = fin || inicio || ''
      return ini.slice(0, 10) <= finMes && f.slice(0, 10) >= inicioMes
    }

    // Filtramos en JS: empresa correcta, no eliminado, y fecha que toca el mes
    const todosLosPagos = (pagosData || []) as PagoRow[]
    const pagosDeMiEmpresa = todosLosPagos.filter((p) => p.empresa_id === empresaId && p.eliminado !== true)
    const pagos = pagosDeMiEmpresa.filter((p) => {
      if (fechaEnMes(p.fecha_fin_periodo)) return true
      if (fechaEnMes(p.fecha_pago)) return true
      if (periodoSolapa(p.fecha_inicio_periodo, p.fecha_fin_periodo)) return true
      if (!p.fecha_fin_periodo && !p.fecha_inicio_periodo && !p.fecha_pago && fechaEnMes(p.creado_en)) return true
      return false
    })

    // ─── Miembros: TODOS los activos con compensación + los que aparecen en pagos ───
    // Necesitamos los activos aunque no tengan pago cargado (para proyectar el
    // sugerido del mes y mostrarlos en la lista). También los que aparecen en
    // pagos del mes pero ya están dados de baja, para que sus pagos se contabilicen.
    const idsMiembrosFromPagos = Array.from(new Set(pagos.map((p) => p.miembro_id).filter(Boolean)))

    const { data: miembrosActivosData } = await admin
      .from('miembros')
      .select('id, usuario_id, rol, puesto_id, compensacion_tipo, compensacion_frecuencia, compensacion_monto')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
    const miembrosActivos = (miembrosActivosData || []) as Array<Record<string, unknown>>
    const idsActivos = new Set(miembrosActivos.map((m) => m.id as string))

    // IDs adicionales: los que aparecen en pagos del mes pero ya no están activos
    const idsAdicionales = idsMiembrosFromPagos.filter((id) => !idsActivos.has(id))
    let miembrosAdicionales: Array<Record<string, unknown>> = []
    if (idsAdicionales.length > 0) {
      const { data } = await admin
        .from('miembros')
        .select('id, usuario_id, rol, puesto_id, compensacion_tipo, compensacion_frecuencia, compensacion_monto')
        .in('id', idsAdicionales)
      miembrosAdicionales = (data || []) as Array<Record<string, unknown>>
    }

    const miembrosData = [...miembrosActivos, ...miembrosAdicionales]
    const miembroIds = miembrosData.map((m) => m.id as string)
    const etiquetasMiembros = await cargarEtiquetasMiembros(
      admin,
      miembrosData.map((m) => ({ id: m.id as string, puesto_id: (m.puesto_id as string | null) ?? null })),
    )

    // Perfiles (cuentas Flux)
    const usuarioIds = miembrosData.map((m) => m.usuario_id as string).filter(Boolean)
    const mapaPerfil = new Map<string, { nombre: string; apellido: string | null }>()
    if (usuarioIds.length > 0) {
      const { data } = await admin
        .from('perfiles')
        .select('id, nombre, apellido')
        .in('id', usuarioIds)
      for (const p of (data || []) as Array<Record<string, unknown>>) {
        mapaPerfil.set(p.id as string, {
          nombre: (p.nombre as string) || '',
          apellido: (p.apellido as string) || null,
        })
      }
    }

    // Fallback: contactos del equipo (empleados sin cuenta Flux)
    const mapaContacto = new Map<string, { nombre: string | null; apellido: string | null }>()
    if (miembroIds.length > 0) {
      const { data } = await admin
        .from('contactos')
        .select('miembro_id, nombre, apellido')
        .in('miembro_id', miembroIds)
        .eq('en_papelera', false)
      for (const c of (data || []) as Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null }>) {
        if (c.miembro_id) mapaContacto.set(c.miembro_id, { nombre: c.nombre, apellido: c.apellido })
      }
    }

    // ─── Resolver info del miembro ───
    type InfoMiembro = {
      miembro_id: string
      nombre: string
      rol: string | null
      puesto: string | null
      sector: string | null
      compensacion_tipo: string | null
      compensacion_frecuencia: string | null
      compensacion_monto: number | null
    }
    const infoMiembro = new Map<string, InfoMiembro>()
    for (const m of miembrosData) {
      const id = m.id as string
      const usuarioId = m.usuario_id as string
      const perfil = usuarioId ? mapaPerfil.get(usuarioId) : null
      const contacto = mapaContacto.get(id)

      let nombre = 'Sin nombre'
      if (perfil && (perfil.nombre || perfil.apellido)) {
        nombre = `${perfil.nombre} ${perfil.apellido || ''}`.trim()
      } else if (contacto && (contacto.nombre || contacto.apellido)) {
        nombre = `${contacto.nombre || ''} ${contacto.apellido || ''}`.trim()
      }

      const et = etiquetasMiembros.get(id)
      infoMiembro.set(id, {
        miembro_id: id,
        nombre: nombre || 'Sin nombre',
        rol: (m.rol as string) || null,
        puesto: et?.puesto ?? null,
        sector: et?.sector ?? null,
        compensacion_tipo: (m.compensacion_tipo as string) || null,
        compensacion_frecuencia: (m.compensacion_frecuencia as string) || null,
        compensacion_monto: m.compensacion_monto != null ? Number(m.compensacion_monto) : null,
      })
    }

    // ─── Agrupar pagos por miembro ───
    type EstadoPago = 'pagado' | 'parcial' | 'pendiente' | 'a_favor'
    type DetallePago = {
      pago_id: string
      concepto: string | null
      fecha_inicio_periodo: string | null
      fecha_fin_periodo: string | null
      fecha_pago: string | null
      sugerido: number
      abonado: number
      pendiente: number
      a_favor: number
      estado: EstadoPago
      dias_habiles: number | null
      dias_trabajados: number | null
      dias_ausentes: number | null
      tardanzas: number | null
      notas: string | null
    }
    type ResumenMiembro = InfoMiembro & {
      cant_pagos: number
      sugerido: number
      abonado: number
      pendiente: number
      a_favor: number
      estado: EstadoPago
      pagos: DetallePago[]
      // Proyección del mes (calculada después de procesar pagos)
      sugerido_cargado: number       // suma de sugerido de los pagos cargados (sin proyección)
      periodos_esperados: number     // cuántos pagos debería haber este mes según la frecuencia
      periodos_faltantes: number     // cuántos faltan cargar
      tiene_proyeccion: boolean      // true si el sugerido fue inflado por proyección
      // Devengado a la fecha (lo que debería estar pagado al día de hoy)
      sugerido_a_la_fecha: number    // proporcional a lo trabajado/transcurrido al día de hoy
      pendiente_a_la_fecha: number   // sugerido_a_la_fecha - abonado (mínimo 0)
    }

    const calcularEstado = (sugerido: number, abonado: number): EstadoPago => {
      const diff = sugerido - abonado
      if (diff < -0.01) return 'a_favor'
      if (diff < 0.01 && abonado > 0.01) return 'pagado'
      if (abonado > 0.01) return 'parcial'
      return 'pendiente'
    }

    // Contamos las semanas reales del mes: cada lunes que cae en el mes inicia
    // una semana laboral. Da 4 ó 5 según el calendario.
    const anioMes = parseInt(anioStr)
    const mesNum = parseInt(mesStr)
    const ultimoDiaMes = new Date(anioMes, mesNum, 0).getDate()
    let semanasDelMes = 0
    for (let d = 1; d <= ultimoDiaMes; d++) {
      if (new Date(anioMes, mesNum - 1, d).getDay() === 1) semanasDelMes++
    }
    if (semanasDelMes === 0) semanasDelMes = 4 // defensivo

    /** Cantidad de períodos de pago que toca el mes según la frecuencia. */
    const periodosDelMes = (freq: string | null): number => {
      if (freq === 'mensual') return 1
      if (freq === 'quincenal') return 2
      if (freq === 'semanal') return semanasDelMes
      if (freq === 'eventual') return 0
      return 1
    }

    const porMiembro = new Map<string, ResumenMiembro>()
    for (const p of pagos) {
      const sugerido = Number(p.monto_sugerido) || 0
      const abonado = Number(p.monto_abonado) || 0
      const diff = sugerido - abonado
      const pendiente = Math.max(0, diff)
      const aFavor = Math.max(0, -diff)

      const detalle: DetallePago = {
        pago_id: p.id,
        concepto: p.concepto,
        fecha_inicio_periodo: p.fecha_inicio_periodo,
        fecha_fin_periodo: p.fecha_fin_periodo,
        fecha_pago: p.fecha_pago,
        sugerido,
        abonado,
        pendiente,
        a_favor: aFavor,
        estado: calcularEstado(sugerido, abonado),
        dias_habiles: p.dias_habiles,
        dias_trabajados: p.dias_trabajados,
        dias_ausentes: p.dias_ausentes,
        tardanzas: p.tardanzas,
        notas: p.notas,
      }

      let r = porMiembro.get(p.miembro_id)
      if (!r) {
        const info = infoMiembro.get(p.miembro_id) || {
          miembro_id: p.miembro_id,
          nombre: 'Sin nombre',
          rol: null, puesto: null, sector: null,
          compensacion_tipo: null, compensacion_frecuencia: null, compensacion_monto: null,
        }
        r = {
          ...info,
          cant_pagos: 0,
          sugerido: 0,
          abonado: 0,
          pendiente: 0,
          a_favor: 0,
          estado: 'pendiente',
          pagos: [],
          sugerido_cargado: 0,
          periodos_esperados: 0,
          periodos_faltantes: 0,
          tiene_proyeccion: false,
          sugerido_a_la_fecha: 0,
          pendiente_a_la_fecha: 0,
        }
        porMiembro.set(p.miembro_id, r)
      }
      r.cant_pagos++
      r.sugerido += sugerido
      r.abonado += abonado
      r.pendiente += pendiente
      r.a_favor += aFavor
      r.pagos.push(detalle)
    }

    // Inicializar TODOS los miembros activos con compensación, aunque no tengan
    // pagos cargados (aparecen en la lista con sugerido proyectado).
    for (const m of miembrosActivos) {
      const id = m.id as string
      if (porMiembro.has(id)) continue
      const info = infoMiembro.get(id)
      if (!info) continue
      // Solo agregamos si tiene compensación configurada (sino no tiene sentido)
      if (info.compensacion_monto == null && !info.compensacion_frecuencia) continue
      porMiembro.set(id, {
        ...info,
        cant_pagos: 0,
        sugerido: 0,
        abonado: 0,
        pendiente: 0,
        a_favor: 0,
        estado: 'pendiente',
        pagos: [],
        sugerido_cargado: 0,
        periodos_esperados: 0,
        periodos_faltantes: 0,
        tiene_proyeccion: false,
        sugerido_a_la_fecha: 0,
        pendiente_a_la_fecha: 0,
      })
    }

    // ─── Asistencias del mes (para estimar por_dia / por_hora) ───
    // Solo necesitamos el cálculo de jornales (días con presencia) y horas
    // netas trabajadas, descontando almuerzo. La lógica más detallada
    // (jornadas completas/medias/parciales) vive en /api/asistencias/nomina;
    // para el dashboard alcanza con esta versión simple.
    const asistenciasIds = Array.from(new Set(miembrosData.map((m) => m.id as string)))
    type AsistenciaRow = {
      miembro_id: string
      fecha: string
      estado: string
      hora_entrada: string | null
      hora_salida: string | null
      inicio_almuerzo: string | null
      fin_almuerzo: string | null
    }
    let asistencias: AsistenciaRow[] = []
    if (asistenciasIds.length > 0) {
      const { data } = await admin
        .from('asistencias')
        .select('miembro_id, fecha, estado, hora_entrada, hora_salida, inicio_almuerzo, fin_almuerzo')
        .eq('empresa_id', empresaId)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes)
        .in('miembro_id', asistenciasIds)
      asistencias = (data || []) as AsistenciaRow[]
    }

    // Días ya cubiertos por pagos cargados — para no contar dos veces
    // cuando un empleado tiene una quincena cargada y la otra todavía no.
    const diasCubiertosPorMiembro = new Map<string, Set<string>>()
    for (const p of pagos) {
      if (!p.fecha_inicio_periodo || !p.fecha_fin_periodo) continue
      let cubiertos = diasCubiertosPorMiembro.get(p.miembro_id)
      if (!cubiertos) { cubiertos = new Set<string>(); diasCubiertosPorMiembro.set(p.miembro_id, cubiertos) }
      const cursor = new Date(p.fecha_inicio_periodo + 'T12:00:00')
      const fin = new Date(p.fecha_fin_periodo + 'T12:00:00')
      while (cursor <= fin) {
        cubiertos.add(cursor.toISOString().slice(0, 10))
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    // Sumar jornales (días con presencia) y horas netas por miembro,
    // ignorando los días ya facturados por pagos cargados.
    type EstimadoMiembro = { jornales: number; horas: number }
    const estimadoPorMiembro = new Map<string, EstimadoMiembro>()
    for (const a of asistencias) {
      if (!a.hora_entrada || a.estado === 'ausente') continue
      const cubiertos = diasCubiertosPorMiembro.get(a.miembro_id)
      if (cubiertos && cubiertos.has(a.fecha)) continue

      let entry = estimadoPorMiembro.get(a.miembro_id)
      if (!entry) { entry = { jornales: 0, horas: 0 }; estimadoPorMiembro.set(a.miembro_id, entry) }
      entry.jornales++

      if (a.hora_salida) {
        const entrada = new Date(a.hora_entrada).getTime()
        const salida = new Date(a.hora_salida).getTime()
        let mins = Math.max(0, Math.round((salida - entrada) / 60000))
        if (a.inicio_almuerzo && a.fin_almuerzo) {
          const ai = new Date(a.inicio_almuerzo).getTime()
          const af = new Date(a.fin_almuerzo).getTime()
          const minAlmuerzo = Math.max(0, Math.round((af - ai) / 60000))
          mins = Math.max(0, mins - minAlmuerzo)
        }
        if (mins > 0 && mins < 24 * 60) entry.horas += mins / 60
      }
    }

    // ─── Proyección del sugerido del mes ───
    // El sugerido "cargado" solo refleja los pagos ya creados en pagos_nomina.
    // Para que la deuda del mes sea realista, proyectamos cuánto debería pagarse
    // según el tipo de compensación:
    //  - fijo: monto × cantidad de períodos del mes
    //  - por_dia: monto × jornales trabajados (en días aún no cubiertos)
    //  - por_hora: monto × horas netas trabajadas (en días no cubiertos)
    //  - eventual: no se proyecta (manual)
    for (const r of porMiembro.values()) {
      r.sugerido_cargado = r.sugerido
      const totalPeriodos = periodosDelMes(r.compensacion_frecuencia)
      r.periodos_esperados = totalPeriodos
      r.periodos_faltantes = Math.max(0, totalPeriodos - r.cant_pagos)

      let sugeridoProyectado = r.sugerido
      const monto = r.compensacion_monto
      const estim = estimadoPorMiembro.get(r.miembro_id)

      if (r.compensacion_tipo === 'fijo' && monto && monto > 0 && totalPeriodos > 0) {
        // Sueldo fijo: monto × cantidad de períodos del mes.
        sugeridoProyectado = Math.max(monto * totalPeriodos, r.sugerido)
      } else if (r.compensacion_tipo === 'por_dia' && monto && monto > 0) {
        // Por día: agregar jornales en días NO cubiertos por pagos.
        const adicional = estim ? estim.jornales * monto : 0
        if (adicional > 0) {
          sugeridoProyectado = r.sugerido + adicional
        } else if (r.cant_pagos > 0 && r.periodos_faltantes > 0) {
          // Sin asistencias adicionales pero faltan períodos: extrapolar
          // con promedio de lo ya cargado (mejor que dejar en 0).
          const promedio = r.sugerido / r.cant_pagos
          sugeridoProyectado = r.sugerido + promedio * r.periodos_faltantes
        }
      } else if (r.compensacion_tipo === 'por_hora' && monto && monto > 0) {
        const adicional = estim ? estim.horas * monto : 0
        if (adicional > 0) {
          sugeridoProyectado = r.sugerido + adicional
        } else if (r.cant_pagos > 0 && r.periodos_faltantes > 0) {
          const promedio = r.sugerido / r.cant_pagos
          sugeridoProyectado = r.sugerido + promedio * r.periodos_faltantes
        }
      } else if (r.cant_pagos > 0 && r.periodos_faltantes > 0) {
        const promedio = r.sugerido / r.cant_pagos
        sugeridoProyectado = r.sugerido + promedio * r.periodos_faltantes
      }

      if (sugeridoProyectado > r.sugerido + 0.01) {
        r.tiene_proyeccion = true
        r.sugerido = Math.round(sugeridoProyectado * 100) / 100
        r.pendiente = Math.max(0, r.sugerido - r.abonado)
        r.a_favor = Math.max(0, r.abonado - r.sugerido)
      }
      r.estado = calcularEstado(r.sugerido, r.abonado)
      r.pagos.sort((a, b) => (a.fecha_fin_periodo || '').localeCompare(b.fecha_fin_periodo || ''))

      // ─── Devengado a la fecha ───
      // Lo que el empleado YA debería tener cobrado a día de hoy:
      //  - Mes pasado: todo el sugerido del mes
      //  - Mes futuro: 0
      //  - Mes en curso: prorrateamos según días o asistencias hasta hoy
      let sugeridoALaFecha = 0
      if (esMesPasado) {
        sugeridoALaFecha = r.sugerido
      } else if (esMesFuturo) {
        sugeridoALaFecha = 0
      } else {
        // Mes en curso
        if (r.compensacion_tipo === 'fijo' && monto && monto > 0 && totalPeriodos > 0) {
          // Pro-rata por días transcurridos del mes
          sugeridoALaFecha = (monto * totalPeriodos) * (hoyComp.dia / ultimoDiaMes)
        } else if ((r.compensacion_tipo === 'por_dia' || r.compensacion_tipo === 'por_hora') && monto && monto > 0) {
          // Sumar lo trabajado hasta hoy: pagos cargados + asistencias del mes en curso
          // (los pagos ya cubren días <= fecha_fin_periodo, las asistencias sin pago cubren los días siguientes)
          let trabajado = r.sugerido_cargado
          for (const a of asistencias) {
            if (a.miembro_id !== r.miembro_id) continue
            if (a.fecha > hoyISO) continue
            if (!a.hora_entrada || a.estado === 'ausente') continue
            const cubiertos = diasCubiertosPorMiembro.get(a.miembro_id)
            if (cubiertos && cubiertos.has(a.fecha)) continue
            if (r.compensacion_tipo === 'por_dia') {
              trabajado += monto
            } else if (a.hora_salida) {
              const e = new Date(a.hora_entrada).getTime()
              const s = new Date(a.hora_salida).getTime()
              let mins = Math.max(0, Math.round((s - e) / 60000))
              if (a.inicio_almuerzo && a.fin_almuerzo) {
                const minAlm = Math.max(0, Math.round((new Date(a.fin_almuerzo).getTime() - new Date(a.inicio_almuerzo).getTime()) / 60000))
                mins = Math.max(0, mins - minAlm)
              }
              if (mins > 0 && mins < 24 * 60) trabajado += (mins / 60) * monto
            }
          }
          sugeridoALaFecha = trabajado
        } else {
          // Eventual o sin tipo: lo único confiable es lo ya cargado
          sugeridoALaFecha = r.sugerido_cargado
        }
      }
      r.sugerido_a_la_fecha = Math.round(sugeridoALaFecha * 100) / 100
      r.pendiente_a_la_fecha = Math.max(0, Math.round((r.sugerido_a_la_fecha - r.abonado) * 100) / 100)
    }

    // Ordenar: pendientes/parciales primero (urgencia), después pagados, por monto desc
    const ordenEstado: Record<EstadoPago, number> = {
      pendiente: 0, parcial: 1, pagado: 2, a_favor: 3,
    }
    const miembros = Array.from(porMiembro.values()).sort((a, b) => {
      if (a.estado !== b.estado) return ordenEstado[a.estado] - ordenEstado[b.estado]
      return b.sugerido - a.sugerido
    })

    // ─── Totales del mes ───
    let sugeridoTotal = 0, abonadoTotal = 0, pendienteTotal = 0, aFavorTotal = 0
    let sugeridoALaFechaTotal = 0, pendienteALaFechaTotal = 0
    let cantPagosTotal = 0
    for (const r of miembros) {
      sugeridoTotal += r.sugerido
      abonadoTotal += r.abonado
      pendienteTotal += r.pendiente
      aFavorTotal += r.a_favor
      sugeridoALaFechaTotal += r.sugerido_a_la_fecha
      pendienteALaFechaTotal += r.pendiente_a_la_fecha
      cantPagosTotal += r.cant_pagos
    }
    const cantMiembros = miembros.length
    const cantPendientes = miembros.filter((m) => m.estado === 'pendiente' || m.estado === 'parcial').length
    const cantPagados = miembros.filter((m) => m.estado === 'pagado' || m.estado === 'a_favor').length
    // Cuántas personas tienen deuda al día de hoy (no a fin de mes)
    const cantPendientesALaFecha = miembros.filter((m) => m.pendiente_a_la_fecha > 0.01).length

    // ─── Adelantos del equipo ───
    // El estado real en BD es 'activo' | 'pagado' | 'cancelado'.
    // Filtramos por `fecha_solicitud <= último día del mes` — esa es la fecha
    // real del adelanto (la que el usuario carga en el input al darlo). Si lo
    // filtráramos por `creado_en` (timestamp de inserción) un adelanto cargado
    // hoy con fecha de mes pasado se vería corrido. Y un adelanto futuro se
    // ocultaría correctamente al navegar a un mes anterior a su solicitud.
    const { data: adelantosDataRaw } = await admin
      .from('adelantos_nomina')
      .select('id, miembro_id, monto_total, saldo_pendiente, cuotas_totales, cuotas_descontadas, estado, frecuencia_descuento, notas, fecha_solicitud, creado_en, eliminado')
      .eq('empresa_id', empresaId)
      .neq('estado', 'cancelado')
      .lte('fecha_solicitud', finMes)

    const adelantosData = (adelantosDataRaw || []).filter(
      (a: Record<string, unknown>) => a.eliminado !== true,
    )

    type AdelantoRow = {
      id: string
      miembro_id: string
      monto_total: string | number | null
      saldo_pendiente: string | number | null
      cuotas_totales: number | null
      cuotas_descontadas: number | null
      estado: string
      frecuencia_descuento: string | null
      notas: string | null
      fecha_solicitud: string | null
      creado_en: string | null
    }

    type ResumenAdelantoMiembro = {
      cant_adelantos: number
      monto_total: number
      monto_descontado: number
      monto_pendiente: number
      cuotas_pendientes: number
      adelantos: Array<{
        id: string
        descripcion: string | null
        monto_total: number
        monto_descontado: number
        monto_pendiente: number
        cuotas_totales: number | null
        cuotas_descontadas: number | null
        cuotas_pendientes: number
        estado: string
        frecuencia_descuento: string | null
        // Fecha real del adelanto (la que el usuario carga en el input,
        // puede diferir de creado_en si lo registró días después).
        fecha_solicitud: string | null
      }>
    }
    const adelantosPorMiembro = new Map<string, ResumenAdelantoMiembro>()
    let adelantosMontoTotal = 0
    let adelantosMontoPendienteTotal = 0
    const miembrosConAdelanto = new Set<string>()

    for (const a of (adelantosData || []) as AdelantoRow[]) {
      const total = Number(a.monto_total) || 0
      const pendiente = Math.max(0, Number(a.saldo_pendiente) || 0)
      const descontado = Math.max(0, total - pendiente)
      const cuotasTot = a.cuotas_totales || 0
      const cuotasDesc = a.cuotas_descontadas || 0
      const cuotasPend = Math.max(0, cuotasTot - cuotasDesc)

      // Para los KPIs del header solo contamos los activos (con saldo).
      // Los pagados se incluyen en la lista para que el usuario los vea como
      // historial del período, pero no inflan "Adelantos pendientes".
      const esActivo = a.estado === 'activo' && pendiente > 0
      if (esActivo) {
        adelantosMontoTotal += total
        adelantosMontoPendienteTotal += pendiente
        miembrosConAdelanto.add(a.miembro_id)
      }

      let r = adelantosPorMiembro.get(a.miembro_id)
      if (!r) {
        r = {
          cant_adelantos: 0,
          monto_total: 0,
          monto_descontado: 0,
          monto_pendiente: 0,
          cuotas_pendientes: 0,
          adelantos: [],
        }
        adelantosPorMiembro.set(a.miembro_id, r)
      }
      r.cant_adelantos++
      r.monto_total += total
      r.monto_descontado += descontado
      r.monto_pendiente += pendiente
      r.cuotas_pendientes += cuotasPend
      r.adelantos.push({
        id: a.id,
        descripcion: a.notas,
        monto_total: total,
        monto_descontado: descontado,
        monto_pendiente: pendiente,
        cuotas_totales: a.cuotas_totales,
        cuotas_descontadas: a.cuotas_descontadas,
        cuotas_pendientes: cuotasPend,
        estado: a.estado,
        frecuencia_descuento: a.frecuencia_descuento,
        fecha_solicitud: a.fecha_solicitud,
      })
    }

    // ─── Cuotas de adelantos descontadas en pagos del mes ───
    // (cada cuota está vinculada a un pago_nomina_id; si ese pago cae en
    //  el mes, se descontó este mes).
    const pagoIds = pagos.map((p) => p.id)
    const cuotasMesPorMiembro = new Map<string, { monto: number; cant: number }>()
    if (pagoIds.length > 0) {
      const { data: cuotasData } = await admin
        .from('adelantos_cuotas')
        .select('adelanto_id, miembro_id, monto_cuota, pago_nomina_id, estado')
        .in('pago_nomina_id', pagoIds)
        .eq('estado', 'descontada')

      for (const c of (cuotasData || []) as Array<{
        adelanto_id: string
        miembro_id: string
        monto_cuota: string | number | null
        pago_nomina_id: string | null
        estado: string
      }>) {
        const miembroId = c.miembro_id
        if (!miembroId) continue
        const monto = Number(c.monto_cuota) || 0
        let entry = cuotasMesPorMiembro.get(miembroId)
        if (!entry) { entry = { monto: 0, cant: 0 }; cuotasMesPorMiembro.set(miembroId, entry) }
        entry.monto += monto
        entry.cant++
      }
    }

    // ─── Adjuntar info de adelantos a cada miembro ───
    type MiembroExtendido = ResumenMiembro & {
      adelantos: ResumenAdelantoMiembro | null
      adelanto_descontado_mes: number
      cuotas_descontadas_mes: number
    }
    const miembrosConAdelantosInfo: MiembroExtendido[] = miembros.map((m) => {
      const cuotasMes = cuotasMesPorMiembro.get(m.miembro_id)
      return {
        ...m,
        adelantos: adelantosPorMiembro.get(m.miembro_id) || null,
        adelanto_descontado_mes: cuotasMes?.monto || 0,
        cuotas_descontadas_mes: cuotasMes?.cant || 0,
      }
    })

    // Agregar también miembros que tienen adelantos pero ningún pago en el mes
    // (no aparecen en `miembros` aún)
    for (const [miembroId, resumenAdelanto] of adelantosPorMiembro) {
      const yaIncluido = miembrosConAdelantosInfo.some((m) => m.miembro_id === miembroId)
      if (yaIncluido) continue
      const info = infoMiembro.get(miembroId)
      // Si no tenemos info del miembro, traemos los datos básicos
      let nombre = 'Sin nombre'
      let rol: string | null = null
      let puesto: string | null = null
      let sector: string | null = null
      let compTipo: string | null = null
      let compFreq: string | null = null
      let compMonto: number | null = null
      if (info) {
        nombre = info.nombre
        rol = info.rol; puesto = info.puesto; sector = info.sector
        compTipo = info.compensacion_tipo
        compFreq = info.compensacion_frecuencia
        compMonto = info.compensacion_monto
      } else {
        // Fetch puntual del miembro y su perfil/contacto
        const { data: m } = await admin
          .from('miembros')
          .select('id, usuario_id, rol, puesto_id, compensacion_tipo, compensacion_frecuencia, compensacion_monto')
          .eq('id', miembroId)
          .maybeSingle()
        if (m) {
          const etPuntual = await cargarEtiquetasMiembros(admin, [{ id: m.id as string, puesto_id: (m.puesto_id as string | null) ?? null }])
          const etInfo = etPuntual.get(m.id as string)
          rol = (m.rol as string) || null
          puesto = etInfo?.puesto ?? null
          sector = etInfo?.sector ?? null
          compTipo = (m.compensacion_tipo as string) || null
          compFreq = (m.compensacion_frecuencia as string) || null
          compMonto = m.compensacion_monto != null ? Number(m.compensacion_monto) : null
          if (m.usuario_id) {
            const { data: p } = await admin
              .from('perfiles')
              .select('nombre, apellido')
              .eq('id', m.usuario_id as string)
              .maybeSingle()
            if (p && (p.nombre || p.apellido)) {
              nombre = `${p.nombre || ''} ${p.apellido || ''}`.trim()
            }
          }
          if (nombre === 'Sin nombre') {
            const { data: c } = await admin
              .from('contactos')
              .select('nombre, apellido')
              .eq('miembro_id', miembroId)
              .eq('en_papelera', false)
              .maybeSingle()
            if (c && (c.nombre || c.apellido)) {
              nombre = `${c.nombre || ''} ${c.apellido || ''}`.trim()
            }
          }
        }
      }

      miembrosConAdelantosInfo.push({
        miembro_id: miembroId,
        nombre, rol, puesto, sector,
        compensacion_tipo: compTipo,
        compensacion_frecuencia: compFreq,
        compensacion_monto: compMonto,
        cant_pagos: 0,
        sugerido: 0, abonado: 0, pendiente: 0, a_favor: 0,
        estado: 'pendiente',
        pagos: [],
        sugerido_cargado: 0,
        periodos_esperados: 0,
        periodos_faltantes: 0,
        tiene_proyeccion: false,
        sugerido_a_la_fecha: 0,
        pendiente_a_la_fecha: 0,
        adelantos: resumenAdelanto,
        adelanto_descontado_mes: cuotasMesPorMiembro.get(miembroId)?.monto || 0,
        cuotas_descontadas_mes: cuotasMesPorMiembro.get(miembroId)?.cant || 0,
      })
    }

    // Debug
    const totalPagosTraidos = todosLosPagos.length
    const totalPagosMiEmpresa = pagosDeMiEmpresa.length
    const meses_con_pagos = Array.from(
      new Set(
        pagosDeMiEmpresa
          .map((p) => p.fecha_fin_periodo || p.fecha_pago || p.creado_en)
          .filter((f): f is string => !!f)
          .map((f) => f.slice(0, 7)),
      ),
    ).sort().reverse()
    const debugMuestra = pagosDeMiEmpresa.slice(0, 5).map((p) => ({
      empresa_id: p.empresa_id,
      fecha_fin_periodo: p.fecha_fin_periodo,
      monto_sugerido: p.monto_sugerido,
      eliminado: p.eliminado,
      coincide_empresa: p.empresa_id === empresaId,
    }))

    return NextResponse.json({
      mes,
      // Estimado del mes (proyección al cierre)
      sugerido_total: sugeridoTotal,
      // Devengado al día de hoy (lo que ya debería estar pagado)
      sugerido_a_la_fecha_total: Math.round(sugeridoALaFechaTotal * 100) / 100,
      pendiente_a_la_fecha_total: Math.round(pendienteALaFechaTotal * 100) / 100,
      cant_pendientes_a_la_fecha: cantPendientesALaFecha,
      // Estado real
      abonado_total: abonadoTotal,
      pendiente_total: pendienteTotal,
      a_favor_total: aFavorTotal,
      // Contadores
      cant_miembros: cantMiembros,
      cant_pendientes: cantPendientes,
      cant_pagados: cantPagados,
      cant_pagos_total: cantPagosTotal,
      // Contexto temporal
      es_mes_pasado: esMesPasado,
      es_mes_futuro: esMesFuturo,
      es_mes_en_curso: esMesEnCurso,
      // Adelantos
      adelantos_activos_personas: miembrosConAdelanto.size,
      adelantos_monto_total: adelantosMontoTotal,
      adelantos_pendiente_total: adelantosMontoPendienteTotal,
      miembros: miembrosConAdelantosInfo,
      // Debug: ayuda a entender qué está pasando con los pagos
      _debug: {
        empresa_id_actual: empresaId,
        total_pagos_traidos_total: totalPagosTraidos,
        total_pagos_empresa: totalPagosMiEmpresa,
        meses_con_pagos,
        muestra_global: debugMuestra,
        error_query: pagosError ? pagosError.message : null,
      },
    })
  } catch (err) {
    registrarError(err, { ruta: '/api/dashboard/sueldos-mes', accion: 'obtener' })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

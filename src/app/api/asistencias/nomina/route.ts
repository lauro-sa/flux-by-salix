import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/asistencias/nomina — Calcular nómina para un período.
 * Query params: desde, hasta (YYYY-MM-DD)
 * Devuelve: por cada miembro, días trabajados, horas, monto a pagar.
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

    // Datos de la empresa
    const { data: empresaData } = await admin
      .from('empresas')
      .select('nombre')
      .eq('id', empresaId)
      .single()

    const nombreEmpresa = (empresaData?.nombre as string) || ''

    // Config de asistencias de la empresa (descuento almuerzo, etc.)
    const { data: configAsist } = await admin
      .from('config_asistencias')
      .select('descontar_almuerzo, duracion_almuerzo_min')
      .eq('empresa_id', empresaId)
      .single()

    const descontarAlmuerzo = (configAsist?.descontar_almuerzo as boolean) ?? true
    const duracionAlmuerzoMin = (configAsist?.duracion_almuerzo_min as number) ?? 60

    // Miembros con datos de compensación
    let queryMiembros = admin
      .from('miembros')
      .select('id, usuario_id, compensacion_tipo, compensacion_monto, compensacion_frecuencia, dias_trabajo')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    if (empleadosFiltro) queryMiembros = queryMiembros.in('id', empleadosFiltro)

    const { data: miembrosData } = await queryMiembros

    const { data: perfilesData } = await admin
      .from('perfiles')
      .select('id, nombre, apellido, correo_empresa, correo')

    const perfilMap = new Map((perfilesData || []).map((p: Record<string, unknown>) => [p.id, p]))

    // Asistencias del período
    const { data: asistencias } = await admin
      .from('asistencias')
      .select('miembro_id, fecha, estado, tipo, hora_entrada, hora_salida, inicio_almuerzo, fin_almuerzo, salida_particular, vuelta_particular')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)

    // Filtrar por días seleccionados
    const diasSet = diasFiltro ? new Set(diasFiltro) : null

    // Agrupar por miembro
    const asistPorMiembro = new Map<string, Record<string, unknown>[]>()
    for (const a of (asistencias || [])) {
      const r = a as Record<string, unknown>
      if (diasSet && !diasSet.has(r.fecha as string)) continue
      const mid = r.miembro_id as string
      if (!asistPorMiembro.has(mid)) asistPorMiembro.set(mid, [])
      asistPorMiembro.get(mid)!.push(r)
    }

    // Calcular días laborales en el período (o los seleccionados)
    const diasLaboralesEnPeriodo = (() => {
      if (diasSet) {
        // Solo contar los días seleccionados que son laborales
        return Array.from(diasSet).filter(f => {
          const d = new Date(f + 'T12:00:00').getDay()
          return d !== 0 && d !== 6
        }).length
      }
      let count = 0
      const d = new Date(desde + 'T12:00:00')
      const fin = new Date(hasta + 'T12:00:00')
      while (d <= fin) {
        const dia = d.getDay()
        if (dia !== 0 && dia !== 6) count++
        d.setDate(d.getDate() + 1)
      }
      return count
    })()

    // Calcular por cada miembro
    const resultados = (miembrosData || []).map((miembro) => {
      const m = miembro as Record<string, unknown>
      const perfil = perfilMap.get(m.usuario_id) as Record<string, unknown> | undefined
      const nombre = perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Sin nombre'
      const correo = (perfil?.correo_empresa as string) || (perfil?.correo as string) || ''

      const registros = asistPorMiembro.get(m.id as string) || []
      const diasTrabajados = registros.filter(r => r.estado !== 'ausente').length
      const diasAusentes = registros.filter(r => r.estado === 'ausente').length
      const diasTardanza = registros.filter(r => r.tipo === 'tardanza').length

      // Calcular horas con desglose detallado
      let minutosBrutos = 0        // Tiempo total en oficina (sin descontar nada)
      let minutosAlmuerzo = 0      // Tiempo total de almuerzo descontado
      let minutosParticular = 0    // Tiempo total de salidas particulares
      let diasConAlmuerzo = 0
      let diasConSalidaParticular = 0

      for (const r of registros) {
        if (!r.hora_entrada || r.estado === 'ausente') continue
        const entrada = new Date(r.hora_entrada as string).getTime()
        const salida = r.hora_salida ? new Date(r.hora_salida as string).getTime() : 0
        if (!salida) continue

        const minBrutos = Math.round((salida - entrada) / 60000)
        minutosBrutos += Math.max(0, minBrutos)

        // Almuerzo
        if (r.inicio_almuerzo && r.fin_almuerzo) {
          const minAlm = Math.round((new Date(r.fin_almuerzo as string).getTime() - new Date(r.inicio_almuerzo as string).getTime()) / 60000)
          minutosAlmuerzo += Math.max(0, minAlm)
          diasConAlmuerzo++
        }

        // Salida particular (trámites personales)
        if (r.salida_particular && r.vuelta_particular) {
          const minPart = Math.round((new Date(r.vuelta_particular as string).getTime() - new Date(r.salida_particular as string).getTime()) / 60000)
          minutosParticular += Math.max(0, minPart)
          diasConSalidaParticular++
        }
      }

      // Minutos netos = brutos - almuerzo (si la empresa descuenta) - particulares
      const minutosDescontados = (descontarAlmuerzo ? minutosAlmuerzo : 0) + minutosParticular
      const minutosNetos = Math.max(0, minutosBrutos - minutosDescontados)
      const horasBrutas = Math.round((minutosBrutos / 60) * 100) / 100
      const horasNetas = Math.round((minutosNetos / 60) * 100) / 100
      const horasAlmuerzo = Math.round((minutosAlmuerzo / 60) * 100) / 100
      const horasParticular = Math.round((minutosParticular / 60) * 100) / 100

      // Promedio horas netas por día trabajado
      const promedioDiario = diasTrabajados > 0
        ? Math.round((minutosNetos / diasTrabajados / 60) * 100) / 100
        : 0

      // Para compatibilidad: horasTotales = netas (lo que se usa para pagar)
      const horasTotales = horasNetas

      // Calcular monto a pagar
      const compTipo = (m.compensacion_tipo as string) || 'fijo'
      const compMonto = parseFloat(m.compensacion_monto as string) || 0
      const compFrecuencia = (m.compensacion_frecuencia as string) || 'mensual'
      const diasEsperados = (m.dias_trabajo as number) || 5

      let montoPagar = 0
      let montoDetalle = ''

      if (compTipo === 'fijo') {
        // Monto fijo: proporcional a los días del período
        if (compFrecuencia === 'mensual') {
          // Proporción del mes
          const diasMes = 22 // promedio días laborales por mes
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
        dias_laborales: diasLaboralesEnPeriodo,
        dias_trabajados: diasTrabajados,
        dias_ausentes: diasAusentes,
        dias_tardanza: diasTardanza,
        // Horas detalladas
        horas_brutas: horasBrutas,
        horas_netas: horasNetas,
        horas_almuerzo: horasAlmuerzo,
        horas_particular: horasParticular,
        horas_totales: horasTotales, // = netas (compatibilidad)
        promedio_horas_diario: promedioDiario,
        // Conteos de almuerzo y salidas particulares
        dias_con_almuerzo: diasConAlmuerzo,
        dias_con_salida_particular: diasConSalidaParticular,
        // Config empresa
        descuenta_almuerzo: descontarAlmuerzo,
        duracion_almuerzo_config: duracionAlmuerzoMin,
        // Pago
        monto_pagar: Math.round(montoPagar * 100) / 100,
        monto_detalle: montoDetalle,
      }
    })

    return NextResponse.json({
      desde, hasta,
      dias_laborales: diasLaboralesEnPeriodo,
      nombre_empresa: nombreEmpresa,
      resultados: resultados.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad, obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/adelantos — Listar adelantos con cuotas.
 *
 * Query:
 *   - miembro_id (opcional): si viene, filtra al miembro. Sin él lista
 *     todos los adelantos de la empresa (para la vista global de Nóminas).
 *   - estado (opcional): activo | pagado | cancelado.
 *   - tipo (opcional): adelanto | descuento.
 *   - frecuencia (opcional): semanal | quincenal | mensual.
 *   - desde, hasta (opcionales): rango sobre `fecha_solicitud`.
 *   - q (opcional): búsqueda libre (notas + nombre empleado).
 *
 * POST /api/adelantos — Crear adelanto + generar cuotas programadas.
 * Body: miembro_id, monto_total, cuotas_totales, fecha_solicitud,
 *        fecha_inicio_descuento, frecuencia_descuento, notas?
 */

// ─── Helpers ───

/** Calcula la fecha de cada cuota según frecuencia */
function calcularFechasCuotas(
  fechaInicio: string,
  cuotas: number,
  frecuencia: string,
): string[] {
  const fechas: string[] = []
  const d = new Date(fechaInicio + 'T12:00:00')

  for (let i = 0; i < cuotas; i++) {
    fechas.push(d.toISOString().split('T')[0])

    if (frecuencia === 'semanal') {
      d.setDate(d.getDate() + 7)
    } else if (frecuencia === 'quincenal') {
      d.setDate(d.getDate() + 15)
    } else {
      // mensual
      d.setMonth(d.getMonth() + 1)
    }
  }

  return fechas
}

// ─── GET ───

export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const miembroId = params.get('miembro_id')

    // Los adelantos son parte del módulo Nómina (descuentos sobre sueldos).
    // ver_propio → solo consulta los suyos. ver_todos → todos.
    const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
    if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Si soloPropio, forzar miembro_id al del usuario actual.
    let miembroFiltro: string | null = miembroId
    if (vis.soloPropio) {
      const { data: miembroPropio } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('empresa_id', empresaId)
        .single()
      if (!miembroPropio) return NextResponse.json({ adelantos: [] })
      // Si el caller especificó otro miembro_id, rechazamos. Si no especificó,
      // limitamos a su propio miembro_id.
      if (miembroId && miembroPropio.id !== miembroId) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
      }
      miembroFiltro = miembroPropio.id
    }

    const estado = params.get('estado')
    const tipo = params.get('tipo')
    const frecuencia = params.get('frecuencia')
    const desde = params.get('desde')
    const hasta = params.get('hasta')
    const q = params.get('q')?.trim()

    let query = admin
      .from('adelantos_nomina')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('eliminado', false)
      .order('creado_en', { ascending: false })

    if (miembroFiltro) query = query.eq('miembro_id', miembroFiltro)
    if (estado) query = query.eq('estado', estado)
    if (tipo) query = query.eq('tipo', tipo)
    if (frecuencia) query = query.eq('frecuencia_descuento', frecuencia)
    if (desde) query = query.gte('fecha_solicitud', desde)
    if (hasta) query = query.lte('fecha_solicitud', hasta)
    if (q) query = query.ilike('notas', `%${q}%`)

    const { data: adelantos, error } = await query
    if (error) throw error

    // Cargar cuotas de todos los adelantos
    const adelantoIds = (adelantos || []).map((a: Record<string, unknown>) => a.id as string)

    const cuotasMap = new Map<string, Record<string, unknown>[]>()
    if (adelantoIds.length > 0) {
      const { data: cuotas } = await admin
        .from('adelantos_cuotas')
        .select('*')
        .in('adelanto_id', adelantoIds)
        .order('numero_cuota', { ascending: true })

      // Para las cuotas ya descontadas, enriquecemos con el período del
      // pago de nómina donde se aplicaron. Así el tab "Adelantos" puede
      // mostrar "Cuota 1/3 descontada en quincena 1 mayo 2026" y dejar
      // visible la conexión bidireccional adelantos ↔ liquidación.
      const cuotasList = (cuotas || []) as Record<string, unknown>[]
      const pagoIds = Array.from(
        new Set(
          cuotasList
            .map(c => c.pago_nomina_id as string | null)
            .filter((id): id is string => !!id),
        ),
      )
      const pagosMap = new Map<string, { periodo_inicio: string; periodo_fin: string }>()
      if (pagoIds.length > 0) {
        const { data: pagos } = await admin
          .from('pagos_nomina')
          .select('id, periodo_inicio, periodo_fin')
          .in('id', pagoIds)
        for (const p of (pagos || []) as Record<string, unknown>[]) {
          pagosMap.set(p.id as string, {
            periodo_inicio: p.periodo_inicio as string,
            periodo_fin: p.periodo_fin as string,
          })
        }
      }

      for (const c of cuotasList) {
        const pagoId = c.pago_nomina_id as string | null
        const periodo = pagoId ? pagosMap.get(pagoId) : null
        const aid = c.adelanto_id as string
        if (!cuotasMap.has(aid)) cuotasMap.set(aid, [])
        cuotasMap.get(aid)!.push({
          ...c,
          periodo_pago: periodo
            ? { inicio: periodo.periodo_inicio, fin: periodo.periodo_fin }
            : null,
        })
      }
    }

    const resultado = (adelantos || []).map((a: Record<string, unknown>) => ({
      ...a,
      cuotas: cuotasMap.get(a.id as string) || [],
    }))

    return NextResponse.json({ adelantos: resultado })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ─── POST ───

export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Crear adelanto = editar nómina.
    const datosMiembro = await obtenerDatosMiembro(user.id, empresaId)
    if (!datosMiembro) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })
    if (!verificarPermiso(datosMiembro, 'nomina', 'editar')) {
      return NextResponse.json({ error: 'Sin permiso para crear adelantos' }, { status: 403 })
    }

    const body = await request.json()
    const {
      miembro_id,
      tipo,
      monto_total,
      cuotas_totales,
      fecha_solicitud,
      fecha_inicio_descuento,
      frecuencia_descuento,
      notas,
    } = body as {
      miembro_id: string
      tipo?: 'adelanto' | 'descuento' | 'bono'
      monto_total: number
      cuotas_totales: number
      fecha_solicitud: string
      fecha_inicio_descuento: string
      frecuencia_descuento: string
      notas?: string
    }

    if (!miembro_id || !monto_total || !fecha_solicitud || !fecha_inicio_descuento || !frecuencia_descuento) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Tipo por defecto: 'adelanto' (compat hacia atrás). Aceptamos los
    // tres tipos del CHECK constraint: adelanto/descuento/bono.
    const tipoFinal: 'adelanto' | 'descuento' | 'bono' =
      tipo === 'descuento' ? 'descuento'
      : tipo === 'bono' ? 'bono'
      : 'adelanto'
    // Tanto descuentos como bonos son one-off (1 cuota); solo el
    // adelanto puede prorratearse en múltiples cuotas.
    const cuotasFinales = tipoFinal === 'adelanto' ? (cuotas_totales || 1) : 1
    if (tipoFinal === 'adelanto' && !cuotas_totales) {
      return NextResponse.json({ error: 'Falta cuotas_totales para el adelanto' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener nombre del creador
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Sistema'

    // Crear adelanto/descuento
    const { data: adelanto, error: errAdelanto } = await admin
      .from('adelantos_nomina')
      .insert({
        empresa_id: empresaId,
        miembro_id,
        tipo: tipoFinal,
        monto_total: String(monto_total),
        cuotas_totales: cuotasFinales,
        cuotas_descontadas: 0,
        saldo_pendiente: String(monto_total),
        frecuencia_descuento,
        fecha_solicitud,
        fecha_inicio_descuento,
        estado: 'activo',
        notas: notas || null,
        creado_por: user.id,
        creado_por_nombre: nombreCreador,
      })
      .select()
      .single()

    if (errAdelanto) throw errAdelanto

    // Generar cuotas
    const montoCuota = Math.round((monto_total / cuotasFinales) * 100) / 100
    const fechas = calcularFechasCuotas(fecha_inicio_descuento, cuotasFinales, frecuencia_descuento)

    const cuotasData = fechas.map((fecha, idx) => {
      // Última cuota absorbe la diferencia de redondeo
      const esUltima = idx === cuotasFinales - 1
      const montoEsta = esUltima
        ? Math.round((monto_total - montoCuota * (cuotasFinales - 1)) * 100) / 100
        : montoCuota

      return {
        adelanto_id: (adelanto as Record<string, unknown>).id,
        empresa_id: empresaId,
        miembro_id,
        numero_cuota: idx + 1,
        monto_cuota: String(montoEsta),
        fecha_programada: fecha,
        estado: 'pendiente',
      }
    })

    const { error: errCuotas } = await admin
      .from('adelantos_cuotas')
      .insert(cuotasData)

    if (errCuotas) throw errCuotas

    return NextResponse.json({ adelanto, cuotas: cuotasData })
  } catch (e) {
    console.error('Error al crear adelanto:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

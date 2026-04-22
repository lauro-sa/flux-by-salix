import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad, obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/adelantos — Listar adelantos de un miembro con cuotas.
 * Query: miembro_id (requerido), estado (opcional: activo|pagado|cancelado)
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
    if (!miembroId) return NextResponse.json({ error: 'miembro_id requerido' }, { status: 400 })

    // Los adelantos son parte del módulo Nómina (descuentos sobre sueldos).
    // ver_propio → solo consulta los suyos. ver_todos → todos.
    const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
    if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    if (vis.soloPropio) {
      const admin = crearClienteAdmin()
      const { data: miembroPropio } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('empresa_id', empresaId)
        .single()
      if (!miembroPropio || miembroPropio.id !== miembroId) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
      }
    }

    const estado = params.get('estado')
    const admin = crearClienteAdmin()

    let query = admin
      .from('adelantos_nomina')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembroId)
      .eq('eliminado', false)
      .order('creado_en', { ascending: false })

    if (estado) query = query.eq('estado', estado)

    const { data: adelantos, error } = await query
    if (error) throw error

    // Cargar cuotas de todos los adelantos
    const adelantoIds = (adelantos || []).map((a: Record<string, unknown>) => a.id as string)

    let cuotasMap = new Map<string, Record<string, unknown>[]>()
    if (adelantoIds.length > 0) {
      const { data: cuotas } = await admin
        .from('adelantos_cuotas')
        .select('*')
        .in('adelanto_id', adelantoIds)
        .order('numero_cuota', { ascending: true })

      for (const c of (cuotas || []) as Record<string, unknown>[]) {
        const aid = c.adelanto_id as string
        if (!cuotasMap.has(aid)) cuotasMap.set(aid, [])
        cuotasMap.get(aid)!.push(c)
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
      monto_total,
      cuotas_totales,
      fecha_solicitud,
      fecha_inicio_descuento,
      frecuencia_descuento,
      notas,
    } = body as {
      miembro_id: string
      monto_total: number
      cuotas_totales: number
      fecha_solicitud: string
      fecha_inicio_descuento: string
      frecuencia_descuento: string
      notas?: string
    }

    if (!miembro_id || !monto_total || !cuotas_totales || !fecha_solicitud || !fecha_inicio_descuento || !frecuencia_descuento) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener nombre del creador
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Sistema'

    // Crear adelanto
    const { data: adelanto, error: errAdelanto } = await admin
      .from('adelantos_nomina')
      .insert({
        empresa_id: empresaId,
        miembro_id,
        monto_total: String(monto_total),
        cuotas_totales,
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
    const montoCuota = Math.round((monto_total / cuotas_totales) * 100) / 100
    const fechas = calcularFechasCuotas(fecha_inicio_descuento, cuotas_totales, frecuencia_descuento)

    const cuotasData = fechas.map((fecha, idx) => {
      // Última cuota absorbe la diferencia de redondeo
      const esUltima = idx === cuotas_totales - 1
      const montoEsta = esUltima
        ? Math.round((monto_total - montoCuota * (cuotas_totales - 1)) * 100) / 100
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

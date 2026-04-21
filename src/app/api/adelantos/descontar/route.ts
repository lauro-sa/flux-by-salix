import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { formatearFechaISO } from '@/lib/formato-fecha'

/**
 * POST /api/adelantos/descontar — Descontar cuotas de adelantos al registrar un pago.
 *
 * Body:
 *   pago_nomina_id: string — ID del pago recién creado
 *   miembro_id: string
 *   fecha_fin_periodo: string — Fecha fin del período liquidado (YYYY-MM-DD)
 *
 * Lógica:
 *   1. Busca cuotas pendientes con fecha_programada <= fecha_fin_periodo
 *   2. Las marca como descontadas, vincula al pago
 *   3. Actualiza cuotas_descontadas y saldo_pendiente en el adelanto
 *   4. Si todas las cuotas están descontadas → estado = 'pagado'
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { pago_nomina_id, miembro_id, fecha_fin_periodo } = body as {
      pago_nomina_id: string
      miembro_id: string
      fecha_fin_periodo: string
    }

    if (!pago_nomina_id || !miembro_id || !fecha_fin_periodo) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    // "Hoy" en la zona horaria de la empresa — sin esto, a la noche AR se registraba como mañana.
    const { data: empresaTz } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zona = (empresaTz?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const hoy = formatearFechaISO(new Date(), zona)

    // Buscar cuotas pendientes cuya fecha cae dentro del período
    const { data: cuotasPendientes, error: errBuscar } = await admin
      .from('adelantos_cuotas')
      .select('id, adelanto_id, monto_cuota')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembro_id)
      .eq('estado', 'pendiente')
      .lte('fecha_programada', fecha_fin_periodo)
      .order('fecha_programada', { ascending: true })

    if (errBuscar) throw errBuscar
    if (!cuotasPendientes?.length) {
      return NextResponse.json({ descontadas: 0, monto_total_descontado: 0 })
    }

    // Marcar cuotas como descontadas
    const cuotaIds = cuotasPendientes.map((c: Record<string, unknown>) => c.id as string)
    const montoTotalDescontado = cuotasPendientes.reduce(
      (sum: number, c: Record<string, unknown>) => sum + parseFloat(c.monto_cuota as string),
      0,
    )

    await admin
      .from('adelantos_cuotas')
      .update({
        estado: 'descontada',
        fecha_descontada: hoy,
        pago_nomina_id,
        actualizado_en: new Date().toISOString(),
      })
      .in('id', cuotaIds)

    // Agrupar por adelanto y actualizar cada uno
    const porAdelanto = new Map<string, number>()
    for (const c of cuotasPendientes as Record<string, unknown>[]) {
      const aid = c.adelanto_id as string
      const monto = parseFloat(c.monto_cuota as string)
      porAdelanto.set(aid, (porAdelanto.get(aid) || 0) + monto)
    }

    for (const [adelantoId, montoDescontado] of porAdelanto) {
      // Obtener estado actual del adelanto
      const { data: adelanto } = await admin
        .from('adelantos_nomina')
        .select('cuotas_totales, cuotas_descontadas, saldo_pendiente')
        .eq('id', adelantoId)
        .single()

      if (!adelanto) continue
      const a = adelanto as Record<string, unknown>

      const nuevasCuotasDescontadas = (a.cuotas_descontadas as number) + cuotasPendientes.filter(
        (c: Record<string, unknown>) => c.adelanto_id === adelantoId,
      ).length
      const nuevoSaldo = Math.max(0, parseFloat(a.saldo_pendiente as string) - montoDescontado)
      const todasDescontadas = nuevasCuotasDescontadas >= (a.cuotas_totales as number)

      await admin
        .from('adelantos_nomina')
        .update({
          cuotas_descontadas: nuevasCuotasDescontadas,
          saldo_pendiente: String(Math.round(nuevoSaldo * 100) / 100),
          estado: todasDescontadas ? 'pagado' : 'activo',
          editado_por: user.id,
          editado_en: new Date().toISOString(),
        })
        .eq('id', adelantoId)
    }

    return NextResponse.json({
      descontadas: cuotaIds.length,
      monto_total_descontado: Math.round(montoTotalDescontado * 100) / 100,
    })
  } catch (e) {
    console.error('Error al descontar cuotas:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

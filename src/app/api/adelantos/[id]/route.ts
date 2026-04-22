import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad, obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/adelantos/[id] — Detalle de un adelanto con cuotas.
 * PATCH /api/adelantos/[id] — Cancelar adelanto (marca cuotas pendientes como canceladas).
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { id } = await params

    const vis = await verificarVisibilidad(user.id, empresaId, 'asistencias')
    if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: adelanto, error } = await admin
      .from('adelantos_nomina')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !adelanto) return NextResponse.json({ error: 'Adelanto no encontrado' }, { status: 404 })

    // ver_propio: solo el dueño del adelanto puede verlo
    if (vis.soloPropio) {
      const { data: miembroPropio } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('empresa_id', empresaId)
        .single()
      if (!miembroPropio || adelanto.miembro_id !== miembroPropio.id) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
      }
    }

    const { data: cuotas } = await admin
      .from('adelantos_cuotas')
      .select('*')
      .eq('adelanto_id', id)
      .order('numero_cuota', { ascending: true })

    return NextResponse.json({ adelanto, cuotas: cuotas || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { id } = await params

    // Modificar adelantos = modifica nómina. Requiere editar asistencias.
    const datosMiembro = await obtenerDatosMiembro(user.id, empresaId)
    if (!datosMiembro) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })
    if (!verificarPermiso(datosMiembro, 'asistencias', 'editar')) {
      return NextResponse.json({ error: 'Sin permiso para modificar adelantos' }, { status: 403 })
    }

    const body = await request.json()
    const { estado, monto_total, cuotas_totales, notas } = body as {
      estado?: string
      monto_total?: number
      cuotas_totales?: number
      notas?: string
    }

    const admin = crearClienteAdmin()

    // Verificar que existe y pertenece a la empresa
    const { data: adelanto } = await admin
      .from('adelantos_nomina')
      .select('id, estado, monto_total, cuotas_totales, cuotas_descontadas, frecuencia_descuento, fecha_inicio_descuento')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!adelanto) return NextResponse.json({ error: 'Adelanto no encontrado' }, { status: 404 })
    const a = adelanto as Record<string, unknown>

    if (a.estado === 'pagado') {
      return NextResponse.json({ error: 'No se puede modificar un adelanto ya pagado' }, { status: 400 })
    }

    // ─── Cancelar ───
    if (estado === 'cancelado') {
      await admin
        .from('adelantos_cuotas')
        .update({ estado: 'cancelada', actualizado_en: new Date().toISOString() })
        .eq('adelanto_id', id)
        .eq('estado', 'pendiente')

      await admin
        .from('adelantos_nomina')
        .update({
          estado: 'cancelado',
          saldo_pendiente: '0',
          eliminado: true,
          eliminado_en: new Date().toISOString(),
          eliminado_por: user.id,
        })
        .eq('id', id)

      return NextResponse.json({ ok: true })
    }

    // ─── Editar monto/cuotas/notas ───
    if (monto_total || cuotas_totales || notas !== undefined) {
      const nuevoMonto = monto_total || parseFloat(a.monto_total as string)
      const nuevasCuotas = cuotas_totales || (a.cuotas_totales as number)
      const cuotasDescontadas = a.cuotas_descontadas as number

      // Solo se pueden editar cuotas pendientes
      if (cuotasDescontadas > 0 && cuotas_totales && cuotas_totales < cuotasDescontadas) {
        return NextResponse.json({ error: `Ya se descontaron ${cuotasDescontadas} cuotas, no se puede reducir a menos` }, { status: 400 })
      }

      // Actualizar adelanto
      const montoDescontado = parseFloat(a.monto_total as string) - parseFloat(String(a.saldo_pendiente || a.monto_total))
      const nuevoSaldo = Math.max(0, nuevoMonto - montoDescontado)

      await admin.from('adelantos_nomina').update({
        monto_total: String(nuevoMonto),
        cuotas_totales: nuevasCuotas,
        saldo_pendiente: String(Math.round(nuevoSaldo * 100) / 100),
        notas: notas !== undefined ? notas : undefined,
        editado_por: user.id,
        editado_en: new Date().toISOString(),
      }).eq('id', id)

      // Regenerar cuotas pendientes (eliminar las pendientes, crear nuevas)
      await admin.from('adelantos_cuotas').delete()
        .eq('adelanto_id', id)
        .eq('estado', 'pendiente')

      const cuotasPendientes = nuevasCuotas - cuotasDescontadas
      if (cuotasPendientes > 0) {
        const montoPorCuota = Math.round((nuevoSaldo / cuotasPendientes) * 100) / 100
        const frecuencia = a.frecuencia_descuento as string
        const fechaBase = new Date((a.fecha_inicio_descuento as string) + 'T12:00:00')

        // Avanzar la fecha base según cuotas ya descontadas
        for (let i = 0; i < cuotasDescontadas; i++) {
          if (frecuencia === 'semanal') fechaBase.setDate(fechaBase.getDate() + 7)
          else if (frecuencia === 'quincenal') fechaBase.setDate(fechaBase.getDate() + 15)
          else fechaBase.setMonth(fechaBase.getMonth() + 1)
        }

        const cuotasNuevas = Array.from({ length: cuotasPendientes }, (_, i) => {
          const fecha = new Date(fechaBase)
          if (frecuencia === 'semanal') fecha.setDate(fecha.getDate() + 7 * i)
          else if (frecuencia === 'quincenal') fecha.setDate(fecha.getDate() + 15 * i)
          else fecha.setMonth(fecha.getMonth() + i)

          const esUltima = i === cuotasPendientes - 1
          const monto = esUltima
            ? Math.round((nuevoSaldo - montoPorCuota * (cuotasPendientes - 1)) * 100) / 100
            : montoPorCuota

          return {
            adelanto_id: id,
            empresa_id: empresaId,
            miembro_id: a.miembro_id || (adelanto as Record<string, unknown>).miembro_id,
            numero_cuota: cuotasDescontadas + i + 1,
            monto_cuota: String(monto),
            fecha_programada: fecha.toISOString().split('T')[0],
            estado: 'pendiente',
          }
        })

        // Obtener miembro_id del adelanto
        const { data: adelantoFull } = await admin.from('adelantos_nomina').select('miembro_id').eq('id', id).single()
        if (adelantoFull) {
          for (const c of cuotasNuevas) {
            c.miembro_id = (adelantoFull as Record<string, unknown>).miembro_id as string
          }
        }

        await admin.from('adelantos_cuotas').insert(cuotasNuevas)
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

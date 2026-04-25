/**
 * PATCH /api/presupuestos/[id]/pagos/[pagoId] — Editar un pago.
 * DELETE — Eliminar un pago. Si tenía comprobante, se borra el archivo.
 * Cualquier cambio recalcula el estado derivado de la cuota vía trigger.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarChatter } from '@/lib/chatter'
import { sincronizarEstadoPresupuesto } from '@/lib/presupuesto-auto-transicion'
import { descontarUsoStorage } from '@/lib/uso-storage'
import type { MetodoPago } from '@/tipos/presupuesto-pago'

const METODOS_VALIDOS: MetodoPago[] = ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'deposito', 'otro']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string }> }
) {
  try {
    const { id: presupuestoId, pagoId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'presupuestos')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data: pago, error } = await admin
      .from('presupuesto_pagos')
      .select('*')
      .eq('id', pagoId)
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    return NextResponse.json(pago)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string }> }
) {
  try {
    const { id: presupuestoId, pagoId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: pagoExistente } = await admin
      .from('presupuesto_pagos')
      .select('*')
      .eq('id', pagoId)
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!pagoExistente) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

    const body = await request.json()

    const actualizacion: Record<string, unknown> = {
      editado_por: user.id,
      actualizado_en: new Date().toISOString(),
    }

    // Nombre del usuario para auditoría
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    actualizacion.editado_por_nombre = perfil
      ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim()
      : null

    // Validar campos editables
    if (body.cuota_id !== undefined) {
      if (body.cuota_id) {
        const { data: cuota } = await admin
          .from('presupuesto_cuotas')
          .select('id')
          .eq('id', body.cuota_id)
          .eq('presupuesto_id', presupuestoId)
          .eq('empresa_id', empresaId)
          .single()
        if (!cuota) return NextResponse.json({ error: 'Cuota inválida' }, { status: 400 })
      }
      actualizacion.cuota_id = body.cuota_id || null
    }

    if (body.monto !== undefined) {
      const monto = Number(body.monto)
      if (!isFinite(monto) || monto <= 0) {
        return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
      }
      actualizacion.monto = String(monto)
    }

    if (body.moneda !== undefined) actualizacion.moneda = body.moneda

    if (body.cotizacion_cambio !== undefined) {
      const c = Number(body.cotizacion_cambio)
      if (c <= 0) return NextResponse.json({ error: 'Cotización inválida' }, { status: 400 })
      actualizacion.cotizacion_cambio = String(c)
    }

    // Recalcular monto_en_moneda_presupuesto si cambió monto o cotización
    if (body.monto !== undefined || body.cotizacion_cambio !== undefined) {
      const m = body.monto !== undefined ? Number(body.monto) : Number(pagoExistente.monto)
      const c = body.cotizacion_cambio !== undefined
        ? Number(body.cotizacion_cambio)
        : Number(pagoExistente.cotizacion_cambio)
      actualizacion.monto_en_moneda_presupuesto = String(m * c)
    }

    if (body.fecha_pago !== undefined) {
      const fp = new Date(body.fecha_pago)
      if (isNaN(fp.getTime())) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
      if (fp.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'La fecha no puede ser futura' }, { status: 400 })
      }
      actualizacion.fecha_pago = fp.toISOString()
    }

    if (body.metodo !== undefined) {
      if (!METODOS_VALIDOS.includes(body.metodo)) {
        return NextResponse.json({ error: 'Método inválido' }, { status: 400 })
      }
      actualizacion.metodo = body.metodo
    }

    if (body.referencia !== undefined) actualizacion.referencia = body.referencia || null
    if (body.descripcion !== undefined) actualizacion.descripcion = body.descripcion || null

    const { data: pagoActualizado, error } = await admin
      .from('presupuesto_pagos')
      .update(actualizacion)
      .eq('id', pagoId)
      .eq('empresa_id', empresaId)
      .select('*')
      .single()

    if (error) {
      console.error('Error al actualizar pago:', error)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    // Sincronizar la entrada del chatter vinculada (si existe) con los
    // nuevos valores — así el timeline refleja la edición (fecha_evento,
    // monto, método, moneda).
    if (pagoActualizado) {
      const { data: entrada } = await admin
        .from('chatter')
        .select('id, metadata')
        .eq('entidad_tipo', 'presupuesto')
        .eq('entidad_id', presupuestoId)
        .eq('empresa_id', empresaId)
        .contains('metadata', { pago_id: pagoId })
        .maybeSingle()

      if (entrada) {
        // Refrescar info de cuota si cambió la imputación
        let infoCuota = {
          cuota_numero: null as number | null,
          cuotas_total: null as number | null,
          cuota_descripcion: null as string | null,
        }
        if (pagoActualizado.cuota_id) {
          const { data: todasCuotas } = await admin
            .from('presupuesto_cuotas')
            .select('id, numero, descripcion')
            .eq('presupuesto_id', presupuestoId)
            .eq('empresa_id', empresaId)
            .order('numero', { ascending: true })
          if (todasCuotas) {
            infoCuota.cuotas_total = todasCuotas.length
            const actual = todasCuotas.find((c) => c.id === pagoActualizado.cuota_id)
            if (actual) {
              infoCuota.cuota_numero = actual.numero
              infoCuota.cuota_descripcion = actual.descripcion || null
            }
          }
        }

        const metadata = (entrada.metadata || {}) as Record<string, unknown>
        const nuevaMetadata = {
          ...metadata,
          fecha_evento: pagoActualizado.fecha_pago,
          pago_metodo: pagoActualizado.metodo,
          pago_moneda: pagoActualizado.moneda,
          pago_fecha: pagoActualizado.fecha_pago,
          monto_pago: String(pagoActualizado.monto),
          descripcion_pago: pagoActualizado.descripcion ?? undefined,
          cuota_id: pagoActualizado.cuota_id || undefined,
          cuota_numero: infoCuota.cuota_numero,
          cuotas_total: infoCuota.cuotas_total,
          cuota_descripcion: infoCuota.cuota_descripcion,
        }
        await admin
          .from('chatter')
          .update({ metadata: nuevaMetadata })
          .eq('id', entrada.id)
      }
    }

    // Sincronizar estado del presupuesto (avanzar a 'completado' si ahora
    // está todo pagado, o revertir si la edición rompió el "todo cobrado").
    if (pagoActualizado) {
      const usuarioNombre = (actualizacion.editado_por_nombre as string | null) || 'Usuario'
      await sincronizarEstadoPresupuesto({
        admin,
        presupuestoId,
        empresaId,
        usuarioId: user.id,
        usuarioNombre,
        razon: 'pago editado',
      })
    }

    return NextResponse.json(pagoActualizado)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string }> }
) {
  try {
    const { id: presupuestoId, pagoId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: pago } = await admin
      .from('presupuesto_pagos')
      .select('*')
      .eq('id', pagoId)
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

    // Borrar comprobante de Storage si existe
    if (pago.comprobante_storage_path) {
      await admin.storage.from('documentos-pdf').remove([pago.comprobante_storage_path])
      if (pago.comprobante_tamano_bytes) {
        descontarUsoStorage(empresaId, 'documentos-pdf', pago.comprobante_tamano_bytes)
      }
    }

    const { error } = await admin
      .from('presupuesto_pagos')
      .delete()
      .eq('id', pagoId)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('Error al eliminar pago:', error)
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    // Audit chatter — quién eliminó
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreUsuario = perfil ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() : 'Usuario'

    await registrarChatter({
      empresaId,
      entidadTipo: 'presupuesto',
      entidadId: presupuestoId,
      contenido: `Eliminó el pago registrado por ${pago.monto} ${pago.moneda}`,
      autorId: user.id,
      autorNombre: nombreUsuario,
      metadata: {
        accion: 'pago_rechazado',
        cuota_id: pago.cuota_id || undefined,
        monto_pago: pago.monto,
      },
    })

    // Sincronizar estado del presupuesto (puede revertir 'completado' →
    // 'orden_venta' si quedó saldo pendiente, o avanzar si ahora está
    // todo cobrado por otro motivo).
    await sincronizarEstadoPresupuesto({
      admin,
      presupuestoId,
      empresaId,
      usuarioId: user.id,
      usuarioNombre: nombreUsuario,
      razon: 'pago eliminado',
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

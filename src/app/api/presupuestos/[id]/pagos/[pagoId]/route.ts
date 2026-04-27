/**
 * GET    — obtener un pago con sus comprobantes hidratados.
 * PATCH  — editar campos del pago (monto, percepciones, método, adicional…).
 * DELETE — eliminar el pago. Borra archivos de Storage de TODOS los
 *          comprobantes y la entrada del chatter vinculada (no deja rastro
 *          "pago rechazado", para que un pago cargado por error no quede
 *          como evento de auditoría visible al usuario final).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { sincronizarEstadoPresupuesto } from '@/lib/presupuesto-auto-transicion'
import { descontarUsoStorage } from '@/lib/uso-storage'
import { EditarPagoSchema, parsearPago } from '@/lib/schemas/pago'
import type { PresupuestoPagoComprobante } from '@/tipos/presupuesto-pago'

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

    const { data: comprobantes } = await admin
      .from('presupuesto_pago_comprobantes')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('pago_id', pagoId)
      .order('creado_en', { ascending: true })

    return NextResponse.json({
      ...pago,
      comprobantes: (comprobantes || []) as PresupuestoPagoComprobante[],
    })
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

    const bodyRaw = await request.json()
    // Validación con Zod: misma fuente de reglas que POST. Aquí también
    // validamos que percepciones nunca superen el monto efectivo (con
    // valores del body o, si no vienen, del registro existente).
    const parseado = parsearPago(EditarPagoSchema, bodyRaw)
    if (!parseado.ok) {
      return NextResponse.json(
        { error: parseado.error, detalles: parseado.detalles },
        { status: 400 }
      )
    }
    const body = parseado.datos
    // Refuerzo: validar percepciones contra monto vigente (puede ser el del
    // body o el del pagoExistente si no se cambió).
    if (body.monto_percepciones !== undefined) {
      const montoVigente =
        body.monto !== undefined ? body.monto : Number(pagoExistente.monto)
      if (body.monto_percepciones > montoVigente) {
        return NextResponse.json(
          { error: 'Las percepciones no pueden superar el monto del pago' },
          { status: 400 }
        )
      }
    }

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

    // Adicional: si se marca true, forzamos cuota_id a null. Si se marca
    // false y no llega cuota_id, dejamos el cuota_id existente.
    let esAdicional: boolean | undefined
    if (body.es_adicional !== undefined) {
      esAdicional = body.es_adicional
      actualizacion.es_adicional = esAdicional
      if (esAdicional) actualizacion.cuota_id = null
    }

    if (body.concepto_adicional !== undefined) {
      const v = body.concepto_adicional ?? null
      actualizacion.concepto_adicional = v ? v.trim() || null : null
    }

    // cuota_id: validar pertenencia. El schema ya rechazó cuota_id si
    // es_adicional=true. Acá solo aceptamos cuotas reales del presupuesto.
    if (body.cuota_id !== undefined && !esAdicional) {
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

    if (body.monto !== undefined) actualizacion.monto = String(body.monto)
    if (body.monto_percepciones !== undefined) {
      actualizacion.monto_percepciones = String(body.monto_percepciones)
    }
    if (body.moneda !== undefined) {
      // Validar contra monedas activas configuradas (igual que POST). La
      // moneda actual del pago siempre se acepta (puede ser legacy).
      if (body.moneda !== pagoExistente.moneda) {
        const { data: cfg } = await admin
          .from('config_presupuestos')
          .select('monedas')
          .eq('empresa_id', empresaId)
          .maybeSingle()
        const monedasActivas = ((cfg?.monedas as Array<{ id: string; activo?: boolean }>) || [])
          .filter((m) => m.activo !== false)
          .map((m) => m.id)
        if (monedasActivas.length > 0 && !monedasActivas.includes(body.moneda)) {
          return NextResponse.json(
            { error: `Moneda "${body.moneda}" no está habilitada para esta empresa` },
            { status: 400 }
          )
        }
      }
      actualizacion.moneda = body.moneda
    }
    if (body.cotizacion_cambio !== undefined) {
      actualizacion.cotizacion_cambio = String(body.cotizacion_cambio)
    }

    // Recalcular monto_en_moneda_presupuesto si cambió monto, percepciones
    // o cotización. Fórmula: (monto + monto_percepciones) * cotizacion.
    if (
      body.monto !== undefined ||
      body.monto_percepciones !== undefined ||
      body.cotizacion_cambio !== undefined
    ) {
      const m = body.monto !== undefined ? body.monto : Number(pagoExistente.monto)
      const mp = body.monto_percepciones !== undefined
        ? body.monto_percepciones
        : Number(pagoExistente.monto_percepciones || 0)
      const c = body.cotizacion_cambio !== undefined
        ? body.cotizacion_cambio
        : Number(pagoExistente.cotizacion_cambio)
      actualizacion.monto_en_moneda_presupuesto = String(
        Math.round((m + mp) * c * 100) / 100
      )
    }

    if (body.fecha_pago !== undefined) {
      // Schema ya validó parseable + no futura.
      actualizacion.fecha_pago = new Date(body.fecha_pago).toISOString()
    }

    if (body.metodo !== undefined) actualizacion.metodo = body.metodo
    if (body.referencia !== undefined) actualizacion.referencia = body.referencia || null
    if (body.descripcion !== undefined) actualizacion.descripcion = body.descripcion || null

    // Reasignación opcional de OT (Contaduría puede necesitar mover un pago
    // a otra OT del mismo presupuesto). Validamos ownership.
    if (body.orden_trabajo_id !== undefined) {
      if (body.orden_trabajo_id === null) {
        actualizacion.orden_trabajo_id = null
      } else {
        const { data: ot } = await admin
          .from('ordenes_trabajo')
          .select('id')
          .eq('id', body.orden_trabajo_id)
          .eq('presupuesto_id', presupuestoId)
          .eq('empresa_id', empresaId)
          .maybeSingle()
        if (!ot) return NextResponse.json({ error: 'OT inválida' }, { status: 400 })
        actualizacion.orden_trabajo_id = ot.id
      }
    }

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
        const infoCuota = {
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
          es_adicional: pagoActualizado.es_adicional || undefined,
          concepto_adicional: pagoActualizado.concepto_adicional || undefined,
          monto_percepciones: Number(pagoActualizado.monto_percepciones || 0) > 0
            ? String(pagoActualizado.monto_percepciones)
            : undefined,
          // Quien editó el pago por última vez (para mostrar "editado por X"
          // en el chatter cuando es distinto del creador). Y cuándo.
          editado_por_nombre: pagoActualizado.editado_por_nombre || undefined,
          editado_en: pagoActualizado.actualizado_en || undefined,
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

    // Devolver el pago con sus comprobantes hidratados
    const { data: comprobantes } = await admin
      .from('presupuesto_pago_comprobantes')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('pago_id', pagoId)
      .order('creado_en', { ascending: true })

    return NextResponse.json({
      ...pagoActualizado,
      comprobantes: (comprobantes || []) as PresupuestoPagoComprobante[],
    })
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

    // Borrar TODOS los comprobantes de Storage desde la tabla canónica.
    const { data: comprobantes } = await admin
      .from('presupuesto_pago_comprobantes')
      .select('storage_path, tamano_bytes')
      .eq('empresa_id', empresaId)
      .eq('pago_id', pagoId)

    const paths = new Set<string>()
    let bytesTotal = 0
    for (const c of comprobantes || []) {
      if (c.storage_path) {
        paths.add(c.storage_path)
        if (c.tamano_bytes) bytesTotal += Number(c.tamano_bytes)
      }
    }

    if (paths.size > 0) {
      await admin.storage.from('documentos-pdf').remove(Array.from(paths))
      if (bytesTotal > 0) descontarUsoStorage(empresaId, 'documentos-pdf', bytesTotal)
    }

    // Eliminar la entrada del chatter vinculada al pago (si existe). Antes
    // creábamos una nueva entrada `pago_rechazado` como rastro, pero quedaba
    // como evento confuso para el usuario final cuando lo eliminado era un
    // error de carga. Política nueva: borrar la entrada original.
    await admin
      .from('chatter')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('entidad_tipo', 'presupuesto')
      .eq('entidad_id', presupuestoId)
      .contains('metadata', { pago_id: pagoId })

    // Borrar el pago (CASCADE borra las filas de presupuesto_pago_comprobantes)
    const { error } = await admin
      .from('presupuesto_pagos')
      .delete()
      .eq('id', pagoId)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('Error al eliminar pago:', error)
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    // Sincronizar estado del presupuesto (puede revertir 'completado' →
    // 'orden_venta' si quedó saldo pendiente, o avanzar si ahora está
    // todo cobrado por otro motivo).
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreUsuario = perfil ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() : 'Usuario'

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

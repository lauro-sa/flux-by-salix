import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/presupuestos/[id]/lineas — Agregar línea(s) al presupuesto.
 * Acepta una línea o un array de líneas. Recalcula totales del presupuesto.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Verificar que el presupuesto existe y pertenece a la empresa
    const { data: presupuesto } = await admin
      .from('presupuestos')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // Obtener orden máximo actual
    const { data: ultimaLinea } = await admin
      .from('lineas_presupuesto')
      .select('orden')
      .eq('presupuesto_id', id)
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()

    let ordenBase = (ultimaLinea?.orden ?? -1) + 1

    const lineasInput = Array.isArray(body) ? body : [body]

    const lineas = lineasInput.map((linea: {
      tipo_linea?: string; codigo_producto?: string; descripcion?: string;
      descripcion_detalle?: string; cantidad?: string; unidad?: string;
      precio_unitario?: string; descuento?: string; impuesto_label?: string;
      impuesto_porcentaje?: string; monto?: string; orden?: number
    }) => {
      const cantidad = parseFloat(linea.cantidad || '1')
      const precioUnitario = parseFloat(linea.precio_unitario || '0')
      const descuentoPct = parseFloat(linea.descuento || '0')
      const impuestoPct = parseFloat(linea.impuesto_porcentaje || '0')

      const subtotal = linea.tipo_linea === 'producto'
        ? cantidad * precioUnitario * (1 - descuentoPct / 100)
        : 0
      const impuestoMonto = subtotal * impuestoPct / 100
      const total = subtotal + impuestoMonto

      return {
        presupuesto_id: id,
        empresa_id: empresaId,
        tipo_linea: linea.tipo_linea || 'producto',
        orden: linea.orden ?? ordenBase++,
        codigo_producto: linea.codigo_producto || null,
        descripcion: linea.descripcion || null,
        descripcion_detalle: linea.descripcion_detalle || null,
        cantidad: linea.cantidad || '1',
        unidad: linea.unidad || null,
        precio_unitario: linea.precio_unitario || '0',
        descuento: linea.descuento || '0',
        impuesto_label: linea.impuesto_label || null,
        impuesto_porcentaje: linea.impuesto_porcentaje || '0',
        subtotal: subtotal.toString(),
        impuesto_monto: impuestoMonto.toString(),
        total: total.toString(),
        monto: linea.tipo_linea === 'descuento' ? (linea.monto || '0') : null,
      }
    })

    const { data: nuevasLineas, error } = await admin
      .from('lineas_presupuesto')
      .insert(lineas)
      .select('*')

    if (error) {
      console.error('Error al agregar líneas:', error)
      return NextResponse.json({ error: 'Error al agregar líneas' }, { status: 500 })
    }

    // Recalcular totales del presupuesto
    await recalcularTotales(admin, id, empresaId, user.id)

    return NextResponse.json(nuevasLineas, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/presupuestos/[id]/lineas — Actualizar líneas existentes.
 * Acepta un array de { id, ...campos } para actualización masiva.
 * También soporta reordenamiento con { reordenar: [{ id, orden }] }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Reordenamiento masivo
    if (body.reordenar) {
      const actualizaciones = (body.reordenar as { id: string; orden: number }[]).map(
        ({ id: lineaId, orden }) =>
          admin
            .from('lineas_presupuesto')
            .update({ orden })
            .eq('id', lineaId)
            .eq('presupuesto_id', id)
      )
      await Promise.all(actualizaciones)
      return NextResponse.json({ ok: true })
    }

    // Actualización de una línea individual
    if (body.id) {
      const lineaId = body.id
      const camposLinea: Record<string, unknown> = {}

      const camposPermitidos = [
        'tipo_linea', 'codigo_producto', 'descripcion', 'descripcion_detalle',
        'cantidad', 'unidad', 'precio_unitario', 'descuento',
        'impuesto_label', 'impuesto_porcentaje', 'monto', 'orden',
      ]

      for (const campo of camposPermitidos) {
        if (body[campo] !== undefined) {
          camposLinea[campo] = body[campo]
        }
      }

      // Recalcular subtotales de la línea
      const cantidad = parseFloat(body.cantidad ?? '1')
      const precioUnitario = parseFloat(body.precio_unitario ?? '0')
      const descuentoPct = parseFloat(body.descuento ?? '0')
      const impuestoPct = parseFloat(body.impuesto_porcentaje ?? '0')

      if (body.tipo_linea !== 'seccion' && body.tipo_linea !== 'nota') {
        const subtotal = cantidad * precioUnitario * (1 - descuentoPct / 100)
        const impuestoMonto = subtotal * impuestoPct / 100
        camposLinea.subtotal = subtotal.toString()
        camposLinea.impuesto_monto = impuestoMonto.toString()
        camposLinea.total = (subtotal + impuestoMonto).toString()
      }

      const { data: lineaActualizada, error } = await admin
        .from('lineas_presupuesto')
        .update(camposLinea)
        .eq('id', lineaId)
        .eq('presupuesto_id', id)
        .select('*')
        .single()

      if (error) {
        console.error('Error al actualizar línea:', error)
        return NextResponse.json({ error: 'Error al actualizar línea' }, { status: 500 })
      }

      // Recalcular totales del presupuesto
      await recalcularTotales(admin, id, empresaId, user.id)

      return NextResponse.json(lineaActualizada)
    }

    return NextResponse.json({ error: 'Se requiere id de línea o reordenar' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/presupuestos/[id]/lineas — Eliminar línea(s).
 * Acepta { linea_id } o { linea_ids: [...] }.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    const ids = body.linea_ids || (body.linea_id ? [body.linea_id] : [])

    if (!ids.length) {
      return NextResponse.json({ error: 'Se requiere linea_id o linea_ids' }, { status: 400 })
    }

    const { error } = await admin
      .from('lineas_presupuesto')
      .delete()
      .in('id', ids)
      .eq('presupuesto_id', id)

    if (error) {
      console.error('Error al eliminar líneas:', error)
      return NextResponse.json({ error: 'Error al eliminar líneas' }, { status: 500 })
    }

    // Recalcular totales del presupuesto
    await recalcularTotales(admin, id, empresaId, user.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * Recalcula subtotal_neto, total_impuestos y total_final del presupuesto
 * basándose en todas sus líneas.
 */
async function recalcularTotales(
  admin: ReturnType<typeof crearClienteAdmin>,
  presupuestoId: string,
  empresaId: string,
  userId: string,
) {
  // Leer líneas y descuento global en paralelo
  const [{ data: lineas }, { data: presupuesto }] = await Promise.all([
    admin
      .from('lineas_presupuesto')
      .select('tipo_linea, subtotal, impuesto_monto, monto')
      .eq('presupuesto_id', presupuestoId),
    admin
      .from('presupuestos')
      .select('descuento_global')
      .eq('id', presupuestoId)
      .single(),
  ])

  if (!lineas) return

  let subtotalNeto = 0
  let totalImpuestos = 0

  for (const linea of lineas) {
    if (linea.tipo_linea === 'producto') {
      subtotalNeto += parseFloat(linea.subtotal || '0')
      totalImpuestos += parseFloat(linea.impuesto_monto || '0')
    } else if (linea.tipo_linea === 'descuento') {
      subtotalNeto += parseFloat(linea.monto || '0')
    }
  }

  const descuentoGlobalPct = parseFloat(presupuesto?.descuento_global || '0')
  const descuentoGlobalMonto = subtotalNeto * descuentoGlobalPct / 100
  const totalFinal = subtotalNeto - descuentoGlobalMonto + totalImpuestos

  await admin
    .from('presupuestos')
    .update({
      subtotal_neto: subtotalNeto.toString(),
      total_impuestos: totalImpuestos.toString(),
      descuento_global_monto: descuentoGlobalMonto.toString(),
      total_final: totalFinal.toString(),
      editado_por: userId,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', presupuestoId)
    .eq('empresa_id', empresaId)
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
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
    const { user } = await obtenerUsuarioRuta()
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

    /** parseFloat seguro: devuelve fallback si el valor es NaN */
    const parseNumero = (valor: string | undefined, fallback: number) => {
      const n = parseFloat(valor || String(fallback))
      return Number.isNaN(n) ? fallback : n
    }

    const lineas = lineasInput.map((linea: {
      tipo_linea?: string; codigo_producto?: string; descripcion?: string;
      descripcion_detalle?: string; cantidad?: string; unidad?: string;
      precio_unitario?: string; descuento?: string; impuesto_label?: string;
      impuesto_porcentaje?: string; monto?: string; orden?: number
    }) => {
      const cantidad = parseNumero(linea.cantidad, 1)
      const precioUnitario = parseNumero(linea.precio_unitario, 0)
      const descuentoPct = parseNumero(linea.descuento, 0)
      const impuestoPct = parseNumero(linea.impuesto_porcentaje, 0)

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
    const { user } = await obtenerUsuarioRuta()
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
      const resultados = await Promise.all(actualizaciones)
      const errores = resultados.filter(r => r.error)
      if (errores.length > 0) {
        console.error('Errores al reordenar líneas:', errores.map(e => e.error))
        return NextResponse.json({ error: 'Error parcial al reordenar' }, { status: 500 })
      }
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

      // Recalcular subtotales de la línea (con validación NaN)
      const parseNum = (v: string | undefined, fb: number) => { const n = parseFloat(v || String(fb)); return Number.isNaN(n) ? fb : n }
      const cantidad = parseNum(body.cantidad, 1)
      const precioUnitario = parseNum(body.precio_unitario, 0)
      const descuentoPct = parseNum(body.descuento, 0)
      const impuestoPct = parseNum(body.impuesto_porcentaje, 0)

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
    const { user } = await obtenerUsuarioRuta()
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
 * usando función PL/pgSQL que ejecuta todo en 1 solo roundtrip atómico.
 */
async function recalcularTotales(
  admin: ReturnType<typeof crearClienteAdmin>,
  presupuestoId: string,
  _empresaId: string,
  userId: string,
) {
  await admin.rpc('recalcular_totales_presupuesto', {
    p_presupuesto_id: presupuestoId,
    p_usuario_id: userId,
  })
}

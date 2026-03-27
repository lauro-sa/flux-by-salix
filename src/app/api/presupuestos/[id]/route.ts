import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/presupuestos/[id] — Obtener detalle completo de un presupuesto.
 * Incluye: líneas (ordenadas), historial de estados, cuotas de pago.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Obtener presupuesto con relaciones
    const { data: presupuesto, error } = await admin
      .from('presupuestos')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // Obtener líneas, historial y cuotas en paralelo
    const [lineasRes, historialRes, cuotasRes] = await Promise.all([
      admin
        .from('lineas_presupuesto')
        .select('*')
        .eq('presupuesto_id', id)
        .order('orden', { ascending: true }),
      admin
        .from('presupuesto_historial')
        .select('*')
        .eq('presupuesto_id', id)
        .order('fecha', { ascending: true }),
      admin
        .from('presupuesto_cuotas')
        .select('*')
        .eq('presupuesto_id', id)
        .order('numero', { ascending: true }),
    ])

    return NextResponse.json({
      ...presupuesto,
      lineas: lineasRes.data || [],
      historial: historialRes.data || [],
      cuotas: cuotasRes.data || [],
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/presupuestos/[id] — Actualizar presupuesto (autoguardado).
 * Acepta campos parciales. Si cambia el estado, registra en historial.
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

    // Obtener nombre del usuario
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

    const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : null

    // Campos permitidos para actualizar
    const camposPermitidos = [
      'contacto_id', 'contacto_nombre', 'contacto_apellido', 'contacto_tipo',
      'contacto_identificacion', 'contacto_condicion_iva', 'contacto_direccion',
      'contacto_correo', 'contacto_telefono',
      'atencion_contacto_id', 'atencion_nombre', 'atencion_correo', 'atencion_cargo',
      'referencia', 'moneda', 'cotizacion_cambio',
      'condicion_pago_id', 'condicion_pago_label', 'condicion_pago_tipo',
      'fecha_emision', 'dias_vencimiento', 'fecha_vencimiento',
      'subtotal_neto', 'total_impuestos', 'descuento_global', 'descuento_global_monto', 'total_final',
      'columnas_lineas', 'notas_html', 'condiciones_html', 'nota_plan_pago',
      'estado', 'en_papelera',
    ]

    const actualizacion: Record<string, unknown> = {
      editado_por: user.id,
      editado_por_nombre: nombreUsuario,
      actualizado_en: new Date().toISOString(),
    }

    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) {
        actualizacion[campo] = body[campo]
      }
    }

    // Si se manda a papelera
    if (body.en_papelera === true) {
      actualizacion.papelera_en = new Date().toISOString()
    } else if (body.en_papelera === false) {
      actualizacion.papelera_en = null
    }

    // Si cambia contacto_id, hacer snapshot del nuevo contacto
    if (body.contacto_id && !body.contacto_nombre) {
      const { data: contacto } = await admin
        .from('contactos')
        .select(`
          nombre, apellido, correo, telefono,
          tipo_contacto:tipos_contacto!tipo_contacto_id(clave),
          numero_identificacion, datos_fiscales,
          direcciones:contacto_direcciones(texto, es_principal)
        `)
        .eq('id', body.contacto_id)
        .single()

      if (contacto) {
        const dirPrincipal = (contacto.direcciones as { texto: string | null; es_principal: boolean }[])?.find(
          (d) => d.es_principal
        )
        actualizacion.contacto_nombre = contacto.nombre
        actualizacion.contacto_apellido = contacto.apellido
        actualizacion.contacto_tipo = (contacto.tipo_contacto as unknown as { clave: string } | null)?.clave || null
        actualizacion.contacto_identificacion = contacto.numero_identificacion
        actualizacion.contacto_condicion_iva = (contacto.datos_fiscales as Record<string, string>)?.condicion_iva || null
        actualizacion.contacto_direccion = dirPrincipal?.texto || null
        actualizacion.contacto_correo = contacto.correo
        actualizacion.contacto_telefono = contacto.telefono
      }
    }

    const { data: actualizado, error } = await admin
      .from('presupuestos')
      .update(actualizacion)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select('*')
      .single()

    if (error) {
      console.error('Error al actualizar presupuesto:', error)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    // Si cambió el estado, registrar en historial
    if (body.estado) {
      await admin.from('presupuesto_historial').insert({
        presupuesto_id: id,
        empresa_id: empresaId,
        estado: body.estado,
        usuario_id: user.id,
        usuario_nombre: nombreUsuario,
        notas: body.notas_estado || null,
      })
    }

    return NextResponse.json(actualizado)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/presupuestos/[id] — Eliminar presupuesto definitivamente.
 * Solo si está en papelera.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Verificar que está en papelera
    const { data: presupuesto } = await admin
      .from('presupuestos')
      .select('id, en_papelera')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    if (!presupuesto.en_papelera) {
      return NextResponse.json({ error: 'El presupuesto debe estar en papelera para eliminarlo definitivamente' }, { status: 400 })
    }

    // Eliminar (cascade borra líneas, historial, cuotas)
    const { error } = await admin
      .from('presupuestos')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('Error al eliminar presupuesto:', error)
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

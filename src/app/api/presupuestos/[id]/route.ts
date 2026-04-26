import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarCambioEstado } from '@/lib/chatter'
import { obtenerYVerificarPermiso, requerirPermisoAPI, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarReciente } from '@/lib/recientes'

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
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'presupuestos')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

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

    // Si solo ve los propios, validar que sea creador. Devolvemos 404 para no
    // filtrar la existencia del recurso.
    if (visibilidad.soloPropio && presupuesto.creado_por !== user.id) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // Obtener líneas, historial, cuotas, orden de trabajo y pagos en paralelo
    const [lineasRes, historialRes, cuotasRes, ordenTrabajoRes, pagosRes] = await Promise.all([
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
      // OT viva (no en papelera) generada desde este presupuesto.
      // Sirve para ocultar el botón "Generar OT" y mostrar "Ver OT".
      admin
        .from('ordenes_trabajo')
        .select('id, numero')
        .eq('presupuesto_id', id)
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .maybeSingle(),
      // Pagos no-adicionales para calcular total cobrado (usado por el
      // desglose de cuotas en el cabezal cuando la condición es plazo_fijo:
      // ahí no hay cuotas materializadas, así que el estado se deriva del
      // total cobrado vs total_final).
      admin
        .from('presupuesto_pagos')
        .select('monto_en_moneda_presupuesto, es_adicional')
        .eq('presupuesto_id', id)
        .eq('empresa_id', empresaId),
    ])

    const totalCobrado = (pagosRes.data || [])
      .filter((p) => !p.es_adicional)
      .reduce((s, p) => s + Number(p.monto_en_moneda_presupuesto || 0), 0)

    // Si no hay cuotas en BD pero tiene condición de pago tipo hitos,
    // generar cuotas sintéticas desde la configuración para que el editor
    // de plantillas pueda calcular correctamente monto_adelanto
    let cuotas = cuotasRes.data || []
    if (cuotas.length === 0 && presupuesto.condicion_pago_id && presupuesto.condicion_pago_tipo === 'hitos') {
      const { data: config } = await admin
        .from('config_presupuestos')
        .select('condiciones_pago')
        .eq('empresa_id', empresaId)
        .single()

      if (config?.condiciones_pago) {
        const condiciones = config.condiciones_pago as Array<{
          id: string; tipo: string; hitos: Array<{ porcentaje: number; descripcion: string; diasDesdeEmision?: number }>
        }>
        const condicion = condiciones.find(c => c.id === presupuesto.condicion_pago_id)
        if (condicion?.tipo === 'hitos' && condicion.hitos?.length) {
          const totalFinal = Number(presupuesto.total_final) || 0
          cuotas = condicion.hitos.map((h, i) => ({
            id: `sintetico-${i}`,
            presupuesto_id: id,
            empresa_id: empresaId,
            numero: i + 1,
            descripcion: h.descripcion || '',
            porcentaje: String(h.porcentaje),
            monto: String(totalFinal * h.porcentaje / 100),
            dias_desde_emision: h.diasDesdeEmision || 0,
            estado: 'pendiente',
            fecha_cobro: null,
            cobrado_por_nombre: null,
          }))
        }
      }
    }

    // Registrar en historial de recientes (fire-and-forget)
    const nombreContacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido].filter(Boolean).join(' ')
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'presupuesto',
      entidadId: id,
      titulo: `Presupuesto #${presupuesto.numero}${nombreContacto ? ` — ${nombreContacto}` : ''}`,
      subtitulo: presupuesto.estado,
      accion: 'visto',
    })

    // Flags granulares para la UI.
    const [puedeEditar, puedeEliminar, puedeEnviar] = await Promise.all([
      obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'editar'),
      obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'eliminar'),
      obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'enviar'),
    ])

    return NextResponse.json({
      ...presupuesto,
      lineas: lineasRes.data || [],
      historial: historialRes.data || [],
      cuotas,
      total_cobrado: totalCobrado,
      orden_trabajo: ordenTrabajoRes.data || null,
      permisos: {
        editar: puedeEditar.permitido,
        eliminar: puedeEliminar.permitido,
        enviar: puedeEnviar.permitido,
      },
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
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para editar presupuestos' }, { status: 403 })

    const body = await request.json()

    // Si se envía a papelera, verificar permiso de eliminar además de editar
    if (body.en_papelera === true) {
      const { permitido: puedeEliminar } = await obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'eliminar')
      if (!puedeEliminar) return NextResponse.json({ error: 'Sin permiso para eliminar presupuestos' }, { status: 403 })
    }
    const admin = crearClienteAdmin()

    // Bloquear el envío a papelera si hay una OT viva derivada de este
    // presupuesto. Caso típico: el operario ya ejecutó/está ejecutando el
    // trabajo; tirar el presupuesto rompería trazabilidad fiscal.
    if (body.en_papelera === true) {
      const { data: otActiva } = await admin
        .from('ordenes_trabajo')
        .select('id, numero')
        .eq('presupuesto_id', id)
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .neq('estado', 'cancelada')
        .maybeSingle()
      if (otActiva) {
        return NextResponse.json(
          {
            error: `No se puede eliminar: existe la OT ${otActiva.numero} vinculada. Cancelá o eliminá la OT primero.`,
            codigo: 'ot_activa',
            orden_trabajo_id: otActiva.id,
          },
          { status: 409 }
        )
      }
    }

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
      'fecha_emision', 'fecha_emision_original', 'dias_vencimiento', 'fecha_vencimiento',
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

    // Si se limpia el contacto, limpiar todos los campos de snapshot
    if (body.contacto_id === null) {
      actualizacion.contacto_nombre = null
      actualizacion.contacto_apellido = null
      actualizacion.contacto_tipo = null
      actualizacion.contacto_identificacion = null
      actualizacion.contacto_condicion_iva = null
      actualizacion.contacto_direccion = null
      actualizacion.contacto_correo = null
      actualizacion.contacto_telefono = null
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

    // Obtener estado anterior (para chatter)
    let estadoAnterior: string | null = null
    if (body.estado) {
      const { data: actual } = await admin
        .from('presupuestos')
        .select('estado')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .single()
      estadoAnterior = actual?.estado || null
    }

    // Auto-llenar fecha_aceptacion al pasar a confirmado_cliente u orden_venta
    if (body.estado && ['confirmado_cliente', 'orden_venta'].includes(body.estado)) {
      actualizacion.fecha_aceptacion = new Date().toISOString()
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

    // Si cambió el estado, registrar en historial + chatter
    if (body.estado) {
      await admin.from('presupuesto_historial').insert({
        presupuesto_id: id,
        empresa_id: empresaId,
        estado: body.estado,
        usuario_id: user.id,
        usuario_nombre: nombreUsuario,
        notas: body.notas_estado || null,
      })

      // Registrar en chatter
      if (estadoAnterior && estadoAnterior !== body.estado) {
        await registrarCambioEstado({
          empresaId,
          presupuestoId: id,
          estadoAnterior,
          estadoNuevo: body.estado,
          usuarioId: user.id,
          usuarioNombre: nombreUsuario || 'Usuario',
          notas: body.notas_estado,
        })
      }
    }

    // Registrar en historial de recientes (fire-and-forget)
    if (actualizado) {
      const nombreCto = [actualizado.contacto_nombre, actualizado.contacto_apellido].filter(Boolean).join(' ')
      registrarReciente({
        empresaId,
        usuarioId: user.id,
        tipoEntidad: 'presupuesto',
        entidadId: id,
        titulo: `Presupuesto #${actualizado.numero}${nombreCto ? ` — ${nombreCto}` : ''}`,
        subtitulo: actualizado.estado,
        accion: body.en_papelera ? 'eliminado' : 'editado',
      })
    }

    return NextResponse.json(actualizado)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/presupuestos/[id] — Descartar presupuesto.
 *
 * Lógica inteligente:
 * - Si es el ÚLTIMO presupuesto (no hay ninguno con número mayor) →
 *   eliminar definitivamente + retroceder el contador secuencial.
 * - Si hay presupuestos con número mayor → no se puede eliminar,
 *   se marca como cancelado (respuesta con accion: 'cancelado').
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('presupuestos', 'eliminar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    // Obtener el presupuesto
    const { data: presupuesto } = await admin
      .from('presupuestos')
      .select('id, numero, empresa_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // Bloquear cancelación/eliminación si hay OT viva. Tirar el presupuesto
    // dejaría la OT huérfana y rompería trazabilidad para Contaduría.
    const { data: otActiva } = await admin
      .from('ordenes_trabajo')
      .select('id, numero')
      .eq('presupuesto_id', id)
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .neq('estado', 'cancelada')
      .maybeSingle()

    if (otActiva) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: existe la OT ${otActiva.numero} vinculada. Cancelá o eliminá la OT primero.`,
          codigo: 'ot_activa',
          orden_trabajo_id: otActiva.id,
        },
        { status: 409 }
      )
    }

    // Verificar si hay presupuestos con número mayor (creados después)
    const { count: posteriores } = await admin
      .from('presupuestos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .gt('creado_en', (await admin.from('presupuestos').select('creado_en').eq('id', id).single()).data?.creado_en || '')
      .eq('en_papelera', false)

    if (posteriores && posteriores > 0) {
      // Hay presupuestos posteriores → cancelar en vez de eliminar
      await admin
        .from('presupuestos')
        .update({ estado: 'cancelado' })
        .eq('id', id)
        .eq('empresa_id', empresaId)

      // Registrar en historial. La columna correcta es usuario_id (ver
      // esquema presupuesto_historial); cambiado_por NO existe.
      await admin.from('presupuesto_historial').insert({
        presupuesto_id: id,
        empresa_id: empresaId,
        estado: 'cancelado',
        usuario_id: user.id,
      })

      return NextResponse.json({
        ok: true,
        accion: 'cancelado',
        mensaje: 'El presupuesto fue cancelado porque hay presupuestos posteriores.',
      })
    }

    // Es el último → eliminar definitivamente + retroceder contador
    // Extraer el número secuencial del presupuesto (ej: "P-0005" → 5)
    const match = presupuesto.numero?.match(/(\d+)$/)
    if (match) {
      const numActual = parseInt(match[1], 10)
      // Solo retroceder si coincide con siguiente - 1
      const { data: secuencia } = await admin
        .from('secuencias')
        .select('siguiente')
        .eq('empresa_id', empresaId)
        .eq('entidad', 'presupuesto')
        .single()

      if (secuencia && secuencia.siguiente === numActual + 1) {
        await admin
          .from('secuencias')
          .update({ siguiente: numActual })
          .eq('empresa_id', empresaId)
          .eq('entidad', 'presupuesto')
      }
    }

    // Eliminar definitivamente (cascade borra líneas, historial, cuotas)
    const { error } = await admin
      .from('presupuestos')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('Error al eliminar presupuesto:', error)
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, accion: 'eliminado' })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

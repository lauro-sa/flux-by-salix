import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { registrarReciente } from '@/lib/recientes'

/**
 * POST /api/ordenes/generar — Generar orden de trabajo desde un presupuesto en estado orden_venta.
 * Copia datos del contacto y líneas (sin precios) del presupuesto.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'ordenes_trabajo', 'crear')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para crear órdenes' }, { status: 403 })

    const body = await request.json()
    const { presupuesto_id } = body

    if (!presupuesto_id) {
      return NextResponse.json({ error: 'Se requiere presupuesto_id' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener presupuesto con líneas en paralelo
    const [presupuestoRes, lineasRes, { data: numero, error: numError }, { data: perfil }] = await Promise.all([
      admin
        .from('presupuestos')
        .select('*')
        .eq('id', presupuesto_id)
        .eq('empresa_id', empresaId)
        .single(),
      admin
        .from('lineas_presupuesto')
        .select('*')
        .eq('presupuesto_id', presupuesto_id)
        .order('orden', { ascending: true }),
      admin.rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'orden_trabajo' }),
      admin.from('perfiles').select('nombre, apellido').eq('id', user.id).single(),
    ])

    if (presupuestoRes.error || !presupuestoRes.data) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    const presupuesto = presupuestoRes.data

    // Validar que el presupuesto está en estado orden_venta
    if (presupuesto.estado !== 'orden_venta') {
      return NextResponse.json({
        error: `El presupuesto debe estar en estado "Orden de Venta" (actual: ${presupuesto.estado})`,
      }, { status: 400 })
    }

    if (numError || !numero) {
      return NextResponse.json({ error: 'Error al generar número de orden' }, { status: 500 })
    }

    const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : null
    const nombreContacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido].filter(Boolean).join(' ')

    // Crear la orden de trabajo
    const nuevaOrden = {
      empresa_id: empresaId,
      numero: numero as string,
      estado: 'abierta',
      prioridad: body.prioridad || 'media',
      titulo: body.titulo || `${nombreContacto || 'Cliente'} — ${presupuesto.numero}`,
      descripcion: body.descripcion || null,
      notas: body.notas || null,
      // Snapshot contacto operativo (del presupuesto)
      contacto_id: presupuesto.contacto_id,
      contacto_nombre: nombreContacto || null,
      contacto_telefono: presupuesto.contacto_telefono,
      contacto_correo: presupuesto.contacto_correo,
      contacto_direccion: presupuesto.contacto_direccion,
      contacto_whatsapp: presupuesto.contacto_telefono, // usar teléfono como WhatsApp por defecto
      // Link al presupuesto
      presupuesto_id: presupuesto.id,
      presupuesto_numero: presupuesto.numero,
      // Asignado (opcional desde body)
      asignado_a: body.asignado_a || null,
      asignado_nombre: body.asignado_nombre || null,
      // Fechas
      fecha_inicio: body.fecha_inicio || null,
      fecha_fin_estimada: body.fecha_fin_estimada || null,
      // Audit
      creado_por: user.id,
      creado_por_nombre: nombreUsuario,
    }

    // Insertar OT con reintento por numero duplicado
    let orden: Record<string, unknown> | null = null
    for (let intento = 0; intento < 3; intento++) {
      const { data, error: insertError } = await admin
        .from('ordenes_trabajo')
        .insert(nuevaOrden)
        .select('*')
        .single()

      if (!insertError && data) { orden = data; break }

      if (insertError?.code === '23505' && insertError.message?.includes('numero')) {
        const { data: nuevoNumero } = await admin.rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'orden_trabajo' })
        if (nuevoNumero) { nuevaOrden.numero = nuevoNumero as string; continue }
      }

      return NextResponse.json({ error: 'Error al crear orden de trabajo' }, { status: 500 })
    }

    if (!orden) return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 })

    // Copiar líneas del presupuesto SIN precios
    const lineas = lineasRes.data || []
    const lineasOT = lineas
      .filter(l => ['producto', 'seccion', 'nota'].includes(l.tipo_linea))
      .map(l => ({
        orden_trabajo_id: orden!.id as string,
        empresa_id: empresaId,
        tipo_linea: l.tipo_linea,
        orden: l.orden,
        codigo_producto: l.codigo_producto,
        descripcion: l.descripcion,
        descripcion_detalle: l.descripcion_detalle,
        cantidad: l.cantidad,
        unidad: l.unidad,
      }))

    // Generar actividades automáticas desde las líneas de producto
    const lineasProducto = lineas.filter(l => l.tipo_linea === 'producto' && l.descripcion)

    // Obtener tipo "tarea" y estado "pendiente" de la empresa para las actividades auto-generadas
    let tipoTarea: { id: string; clave: string } | null = null
    let estadoPendiente: { id: string; clave: string } | null = null
    if (lineasProducto.length > 0) {
      const [tipoRes, estadoRes] = await Promise.all([
        admin.from('tipos_actividad').select('id, clave').eq('empresa_id', empresaId).eq('clave', 'tarea').single(),
        admin.from('estados_actividad').select('id, clave').eq('empresa_id', empresaId).eq('clave', 'pendiente').single(),
      ])
      tipoTarea = tipoRes.data
      estadoPendiente = estadoRes.data
    }

    // Vinculos para las actividades: OT + contacto del presupuesto
    const vinculosActividad = [
      { tipo: 'orden', id: orden.id as string, nombre: `OT #${orden.numero}` },
      ...(presupuesto.contacto_id ? [{
        tipo: 'contacto',
        id: presupuesto.contacto_id,
        nombre: nombreContacto || 'Cliente',
      }] : []),
    ]
    const vinculoIds = vinculosActividad.map(v => v.id)

    const actividadesAutoGeneradas = (tipoTarea && estadoPendiente) ? lineasProducto.map(l => {
      const cantidadTexto = l.cantidad && l.cantidad !== '1'
        ? `${l.cantidad}${l.unidad ? ' ' + l.unidad : ''}`
        : null
      // Si la descripción es genérica ("Servicio", "Producto") y hay detalle, usar el detalle como título
      const esGenerica = ['servicio', 'producto'].includes((l.descripcion || '').toLowerCase().trim())
      const titulo = esGenerica && l.descripcion_detalle
        ? l.descripcion_detalle.slice(0, 150)
        : l.descripcion
      const descripcion = esGenerica
        ? cantidadTexto
        : [l.descripcion_detalle, cantidadTexto].filter(Boolean).join(' — ') || null
      return {
        empresa_id: empresaId,
        titulo,
        descripcion,
        tipo_id: tipoTarea!.id,
        tipo_clave: tipoTarea!.clave,
        estado_id: estadoPendiente!.id,
        estado_clave: estadoPendiente!.clave,
        prioridad: 'normal',
        vinculos: vinculosActividad,
        vinculo_ids: vinculoIds,
        asignados: [],
        asignados_ids: [],
        checklist: [],
        es_tarea_ot: true,
        creado_por: user.id,
        creado_por_nombre: nombreUsuario,
      }
    }) : []

    // Insertar líneas + actividades + historial + chatter en paralelo
    await Promise.all([
      lineasOT.length > 0 ? admin.from('lineas_orden_trabajo').insert(lineasOT) : Promise.resolve(),
      actividadesAutoGeneradas.length > 0 ? admin.from('actividades').insert(actividadesAutoGeneradas) : Promise.resolve(),
      admin.from('orden_trabajo_historial').insert({
        orden_trabajo_id: orden.id as string,
        empresa_id: empresaId,
        estado: 'abierta',
        usuario_id: user.id,
        usuario_nombre: nombreUsuario,
        notas: `Generada desde presupuesto ${presupuesto.numero}`,
      }),
      // Chatter en la OT
      registrarChatter({
        empresaId,
        entidadTipo: 'orden_trabajo',
        entidadId: orden.id as string,
        contenido: `Orden generada desde presupuesto ${presupuesto.numero}`,
        autorId: user.id,
        autorNombre: nombreUsuario || 'Usuario',
        metadata: {
          accion: 'creado',
          presupuesto_id: presupuesto.id,
          presupuesto_numero: presupuesto.numero,
        },
      }),
      // Chatter en el presupuesto
      registrarChatter({
        empresaId,
        entidadTipo: 'presupuesto',
        entidadId: presupuesto.id,
        contenido: `Se generó la orden de trabajo ${orden.numero}`,
        autorId: user.id,
        autorNombre: nombreUsuario || 'Usuario',
        metadata: {
          accion: 'orden_trabajo_generada',
          orden_trabajo_id: orden.id,
          orden_trabajo_numero: orden.numero,
        },
      }),
    ])

    // Registrar en recientes
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'orden_trabajo',
      entidadId: orden.id as string,
      titulo: `OT #${orden.numero} — ${orden.titulo}`,
      subtitulo: 'abierta',
      accion: 'creado',
    })

    return NextResponse.json({
      orden,
      lineas: lineasOT,
    }, { status: 201 })
  } catch (err) {
    console.error('Error interno POST /api/ordenes/generar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

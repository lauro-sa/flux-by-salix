import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { sanitizarBusqueda, normalizarAcentos } from '@/lib/validaciones'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarError } from '@/lib/logger'
import { registrarReciente } from '@/lib/recientes'
import { autoCompletarActividad } from '@/lib/auto-completar-actividad'

/**
 * GET /api/presupuestos — Listar presupuestos de la empresa activa.
 * Soporta: búsqueda, filtros por estado/contacto/moneda/fecha, paginación, ordenamiento.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permisos de visibilidad con una sola query a BD
    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'presupuestos')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso para ver presupuestos' }, { status: 403 })
    const soloPropio = visibilidad.soloPropio

    const params = request.nextUrl.searchParams
    const busqueda = sanitizarBusqueda(params.get('busqueda') || '')
    const estado = params.get('estado') // CSV
    const contacto_id = params.get('contacto_id')
    const tipo_contacto = params.get('tipo_contacto') // CSV: persona,empresa,edificio...
    const moneda = params.get('moneda')
    const fecha_desde = params.get('fecha_desde')
    const fecha_hasta = params.get('fecha_hasta')
    // Nuevos filtros
    const en_orden_venta = params.get('en_orden_venta') // 'true' | 'false'
    const vencido = params.get('vencido') // 'true' | 'false'
    const con_descuento = params.get('con_descuento') // 'true' | 'false'
    const con_observaciones = params.get('con_observaciones') // 'true' | 'false'
    const monto_min = params.get('monto_min')
    const monto_max = params.get('monto_max')
    const anio = params.get('anio') // entero (ej. 2026)
    const creado_por = params.get('creado_por')
    const en_papelera = params.get('en_papelera') === 'true'
    const orden_campo = params.get('orden_campo') || 'numero'
    const orden_dir = params.get('orden_dir') === 'asc' ? true : false
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    // Filtro por tipo_contacto — JOIN implícito vía pre-query.
    // Supabase/PostgREST no permite JOINs en WHERE en una sola query, entonces:
    // 1) buscamos tipo_contacto.id por clave  → 2) contacto.id por tipo  → 3) in()
    // Si alguna capa devuelve vacío, cortocircuitamos con respuesta vacía.
    let idsPorTipoContacto: string[] | null = null
    if (tipo_contacto) {
      const tipos = tipo_contacto.split(',').filter(Boolean)
      // Buscar los IDs de tipos_contacto que coincidan con las claves
      const { data: tiposCt } = await admin
        .from('tipos_contacto')
        .select('id')
        .eq('empresa_id', empresaId)
        .in('clave', tipos)
      const tipoIds = (tiposCt || []).map(t => t.id)
      if (tipoIds.length > 0) {
        const { data: contactosFiltrados } = await admin
          .from('contactos')
          .select('id')
          .eq('empresa_id', empresaId)
          .in('tipo_contacto_id', tipoIds)
        idsPorTipoContacto = (contactosFiltrados || []).map(c => c.id)
        if (idsPorTipoContacto.length === 0) {
          return NextResponse.json({ presupuestos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
        }
      } else {
        return NextResponse.json({ presupuestos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
      }
    }

    let query = admin
      .from('presupuestos')
      .select(`
        id, numero, estado, referencia,
        contacto_id, contacto_nombre, contacto_apellido, contacto_tipo,
        contacto_correo, contacto_telefono, contacto_identificacion,
        contacto_condicion_iva, contacto_direccion,
        atencion_contacto_id, atencion_nombre, atencion_correo, atencion_cargo,
        moneda, condicion_pago_label,
        fecha_emision, fecha_vencimiento, dias_vencimiento, fecha_aceptacion,
        estado_cambiado_en,
        subtotal_neto, total_impuestos, descuento_global, descuento_global_monto, total_final,
        notas_html,
        origen_documento_numero,
        creado_por, creado_por_nombre, creado_en, actualizado_en
      `, { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', en_papelera)

    // Si solo tiene ver_propio, filtrar por presupuestos creados por él
    if (soloPropio) {
      query = query.eq('creado_por', user.id)
    }

    // Filtro por tipo de contacto (vía contactos.tipo_contacto_id)
    if (idsPorTipoContacto) {
      query = query.in('contacto_id', idsPorTipoContacto)
    }

    // Filtro por estado (puede ser múltiple separado por comas)
    if (estado) {
      const estados = estado.split(',')
      if (estados.length === 1) {
        query = query.eq('estado', estados[0])
      } else {
        query = query.in('estado', estados)
      }
    }

    // Filtro por contacto (como cliente principal O como "dirigido a")
    if (contacto_id) {
      query = query.or(`contacto_id.eq.${contacto_id},atencion_contacto_id.eq.${contacto_id}`)
    }

    // Filtro por moneda
    if (moneda) {
      query = query.eq('moneda', moneda)
    }

    // Filtro por creador
    if (creado_por) {
      query = query.eq('creado_por', creado_por)
    }

    // Filtro "en orden de venta" — estado='orden_venta' (aceptado y convertido)
    if (en_orden_venta === 'true') {
      query = query.eq('estado', 'orden_venta')
    } else if (en_orden_venta === 'false') {
      query = query.neq('estado', 'orden_venta')
    }

    // Filtro "vencido" — fecha_vencimiento < hoy AND estado IN ('enviado','vencido')
    if (vencido === 'true') {
      const ahora = new Date().toISOString()
      query = query.lt('fecha_vencimiento', ahora).in('estado', ['enviado', 'vencido'])
    } else if (vencido === 'false') {
      // No vencido = fecha_vencimiento >= hoy o estado terminal (aceptado/cancelado/rechazado)
      const ahora = new Date().toISOString()
      query = query.or(`fecha_vencimiento.gte.${ahora},estado.in.(borrador,confirmado_cliente,orden_venta,rechazado,cancelado)`)
    }

    // Filtro "con descuento" — descuento_global > 0
    if (con_descuento === 'true') {
      query = query.gt('descuento_global', 0)
    } else if (con_descuento === 'false') {
      query = query.or('descuento_global.eq.0,descuento_global.is.null')
    }

    // Filtro "con observaciones" — notas_html no nulo y no vacío
    if (con_observaciones === 'true') {
      query = query.not('notas_html', 'is', null).neq('notas_html', '')
    } else if (con_observaciones === 'false') {
      query = query.or('notas_html.is.null,notas_html.eq.')
    }

    // Filtro por rango de monto
    if (monto_min) {
      const min = Number(monto_min)
      if (!isNaN(min)) query = query.gte('total_final', min)
    }
    if (monto_max) {
      const max = Number(monto_max)
      if (!isNaN(max)) query = query.lte('total_final', max)
    }

    // Filtro por año (rango de fecha_emision dentro del año)
    if (anio) {
      const a = parseInt(anio)
      if (!isNaN(a)) {
        const inicio = new Date(a, 0, 1).toISOString()
        const fin = new Date(a + 1, 0, 1).toISOString()
        query = query.gte('fecha_emision', inicio).lt('fecha_emision', fin)
      }
    }

    // Filtro por rango de fechas (custom — sigue funcionando para "finalizadas hoy" y demás)
    if (fecha_desde) {
      query = query.gte('fecha_emision', fecha_desde)
    }
    if (fecha_hasta) {
      query = query.lte('fecha_emision', fecha_hasta)
    }

    // ── Búsqueda case + accent insensitive en múltiples campos
    // (incluye búsqueda por etiqueta de estado: "aceptado" → estado IN aceptados, etc.)
    if (busqueda.trim()) {
      const busquedaNorm = normalizarAcentos(busqueda).toLowerCase()

      // Detectar si el término coincide con alguna etiqueta de estado
      const ESTADO_KEYWORDS: Record<string, string[]> = {
        borrador: ['borrador'],
        enviado: ['enviado', 'enviar'],
        confirmado_cliente: ['confirmado', 'aceptado', 'acept'],
        orden_venta: ['orden', 'venta', 'ov'],
        rechazado: ['rechazado', 'rechaz'],
        vencido: ['vencido', 'venc'],
        cancelado: ['cancelado', 'cancel'],
      }
      const estadosCoincidentes: string[] = []
      for (const [estadoClave, palabras] of Object.entries(ESTADO_KEYWORDS)) {
        if (palabras.some(p => p.startsWith(busquedaNorm) || busquedaNorm.startsWith(p))) {
          estadosCoincidentes.push(estadoClave)
        }
      }

      const filtroBase = [
        `numero.ilike.%${busquedaNorm}%`,
        `contacto_nombre.ilike.%${busquedaNorm}%`,
        `contacto_apellido.ilike.%${busquedaNorm}%`,
        `atencion_nombre.ilike.%${busquedaNorm}%`,
        `referencia.ilike.%${busquedaNorm}%`,
        `contacto_direccion.ilike.%${busquedaNorm}%`,
        `creado_por_nombre.ilike.%${busquedaNorm}%`,
      ]
      if (estadosCoincidentes.length > 0) {
        filtroBase.push(`estado.in.(${estadosCoincidentes.join(',')})`)
      }
      query = query.or(filtroBase.join(','))
    }

    // Ordenamiento y paginación
    query = query
      .order(orden_campo, { ascending: orden_dir })
      .range(desde, desde + por_pagina - 1)

    const { data, error, count } = await query

    if (error) {
      registrarError(error, { ruta: '/api/presupuestos', accion: 'listar', empresaId })
      return NextResponse.json({ error: 'Error al obtener presupuestos' }, { status: 500 })
    }

    // ── Resumen de pagos por presupuesto ──────────────────────────────
    // Para que el listado pueda renderizar la columna "Pagos" (dots por
    // cuota cobrada / parcial / pendiente), traemos en paralelo un mini
    // resumen agregado de cuotas y de pagos por cada presupuesto de la
    // página actual. Se hace en 2 queries IN(ids) — barato.
    const presupuestos = data || []
    if (presupuestos.length > 0) {
      const ids = presupuestos.map((p) => p.id)

      const [cuotasResumen, pagosResumen] = await Promise.all([
        admin
          .from('presupuesto_cuotas')
          .select('presupuesto_id, estado, numero')
          .in('presupuesto_id', ids),
        admin
          .from('presupuesto_pagos')
          .select('presupuesto_id, monto_en_moneda_presupuesto, es_adicional')
          .in('presupuesto_id', ids)
          .is('eliminado_en', null),
      ])

      // Agrupar cuotas por presupuesto, ordenadas por numero ascendente.
      // Devolvemos la lista de estados de cuotas para que el frontend
      // pueda dibujar 1 dot por cuota en orden.
      const cuotasPorPres = new Map<string, { numero: number; estado: string }[]>()
      for (const c of cuotasResumen.data || []) {
        const arr = cuotasPorPres.get(c.presupuesto_id) || []
        arr.push({ numero: c.numero, estado: c.estado })
        cuotasPorPres.set(c.presupuesto_id, arr)
      }
      for (const arr of cuotasPorPres.values()) {
        arr.sort((a, b) => a.numero - b.numero)
      }

      // Agregados de pagos: total cobrado (no-adicionales) + cantidad
      const pagosPorPres = new Map<string, { cobrado: number; cantidad: number }>()
      for (const p of pagosResumen.data || []) {
        if (p.es_adicional) continue
        const r = pagosPorPres.get(p.presupuesto_id) || { cobrado: 0, cantidad: 0 }
        r.cobrado += Number(p.monto_en_moneda_presupuesto || 0)
        r.cantidad += 1
        pagosPorPres.set(p.presupuesto_id, r)
      }

      for (const p of presupuestos as Array<Record<string, unknown>>) {
        const cuotas = cuotasPorPres.get(p.id as string) || []
        const pagos = pagosPorPres.get(p.id as string) || { cobrado: 0, cantidad: 0 }
        p.resumen_pagos = {
          // Lista ordenada de cuotas con su estado (vacía si plazo_fijo / contado)
          cuotas: cuotas.map((c) => c.estado),
          // Cantidad de pagos cargados (no incluye adicionales)
          cantidad_pagos: pagos.cantidad,
          // Total cobrado en moneda del presupuesto
          total_cobrado: pagos.cobrado,
        }
      }
    }

    return NextResponse.json({
      presupuestos,
      total: count || 0,
      pagina,
      por_pagina,
      total_paginas: Math.ceil((count || 0) / por_pagina),
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/presupuestos — Crear un nuevo presupuesto.
 * Genera número secuencial, snapshot del contacto, registra estado inicial.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'crear')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para crear presupuestos' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Paralelizar queries independientes: número, config y perfil
    const [
      { data: numero, error: numError },
      { data: config },
      { data: perfil },
    ] = await Promise.all([
      admin.rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'presupuesto' }),
      admin.from('config_presupuestos').select('*').eq('empresa_id', empresaId).maybeSingle(),
      admin.from('perfiles').select('nombre, apellido').eq('id', user.id).single(),
    ])

    if (numError || !numero) {
      console.error('Error al generar número:', numError)
      return NextResponse.json({ error: 'Error al generar número de presupuesto' }, { status: 500 })
    }

    const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : null

    // Snapshot del contacto si se proporcionó
    let snapshotContacto: Record<string, string | null> = {}
    if (body.contacto_id) {
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
        snapshotContacto = {
          contacto_nombre: contacto.nombre,
          contacto_apellido: contacto.apellido,
          contacto_tipo: (contacto.tipo_contacto as unknown as { clave: string } | null)?.clave || null,
          contacto_identificacion: contacto.numero_identificacion,
          contacto_condicion_iva: (contacto.datos_fiscales as Record<string, string>)?.condicion_iva || null,
          contacto_direccion: dirPrincipal?.texto || null,
          contacto_correo: contacto.correo,
          contacto_telefono: contacto.telefono,
        }
      }
    }

    // Condición de pago por defecto
    const condicionesPago = (config?.condiciones_pago as { id: string; label: string; tipo: string; diasVencimiento: number; notaPlanPago: string; predeterminado: boolean }[]) || []
    const condDefault = condicionesPago.find(c => c.predeterminado) || condicionesPago[0]

    const diasVenc = body.dias_vencimiento ?? config?.dias_vencimiento_predeterminado ?? 30
    const fechaEmision = new Date()
    const fechaVencimiento = new Date(fechaEmision.getTime() + diasVenc * 24 * 60 * 60 * 1000)

    // Crear presupuesto
    const nuevoPresupuesto = {
      empresa_id: empresaId,
      numero: numero as string,
      estado: 'borrador',
      contacto_id: body.contacto_id || null,
      ...snapshotContacto,
      referencia: body.referencia || null,
      moneda: body.moneda || config?.moneda_predeterminada || 'ARS',
      condicion_pago_id: body.condicion_pago_id || condDefault?.id || null,
      condicion_pago_label: condDefault?.label || null,
      condicion_pago_tipo: condDefault?.tipo || null,
      fecha_emision: fechaEmision.toISOString(),
      dias_vencimiento: diasVenc,
      fecha_vencimiento: fechaVencimiento.toISOString(),
      notas_html: body.notas_html || config?.notas_predeterminadas || null,
      condiciones_html: body.condiciones_html || config?.condiciones_predeterminadas || null,
      nota_plan_pago: condDefault?.notaPlanPago || null,
      columnas_lineas: body.columnas_lineas || config?.columnas_lineas_default || ['producto', 'descripcion', 'cantidad', 'unidad', 'precio_unitario', 'descuento', 'impuesto', 'subtotal'],
      // Persistir el vínculo a la actividad origen (si vino) para que el listener
      // del PATCH pueda completar la actividad cuando el presupuesto cambie de estado.
      actividad_origen_id: body.actividad_origen_id || null,
      creado_por: user.id,
      creado_por_nombre: nombreUsuario,
    }

    let presupuesto: Record<string, unknown> | null = null

    // Intentar insertar — si falla por número duplicado, reintentar con el siguiente
    for (let intento = 0; intento < 3; intento++) {
      const { data, error: insertError } = await admin
        .from('presupuestos')
        .insert(nuevoPresupuesto)
        .select('*')
        .single()

      if (!insertError && data) {
        presupuesto = data
        break
      }

      // Número duplicado: generar otro y reintentar
      if (insertError?.code === '23505' && insertError.message?.includes('numero')) {
        const { data: nuevoNumero } = await admin
          .rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'presupuesto' })
        if (nuevoNumero) {
          nuevoPresupuesto.numero = nuevoNumero as string
          continue
        }
      }

      console.error('Error al crear presupuesto:', insertError)
      return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 })
    }

    if (!presupuesto) {
      return NextResponse.json({ error: 'No se pudo crear el presupuesto después de reintentos' }, { status: 500 })
    }

    // Registrar estado inicial en historial
    await admin.from('presupuesto_historial').insert({
      presupuesto_id: presupuesto.id as string,
      empresa_id: empresaId,
      estado: 'borrador',
      usuario_id: user.id,
      usuario_nombre: nombreUsuario,
    })

    // Registrar creación en chatter
    await registrarChatter({
      empresaId,
      entidadTipo: 'presupuesto',
      entidadId: presupuesto.id as string,
      contenido: `Creó el presupuesto ${presupuesto.numero}`,
      autorId: user.id,
      autorNombre: nombreUsuario || 'Usuario',
      metadata: { accion: 'creado' },
    })

    // Auto-completar la actividad origen SOLO si su tipo tiene
    // `evento_auto_completar = 'al_crear'`. Si está configurado 'al_enviar',
    // se completará cuando el PATCH cambie el estado del presupuesto a 'enviado'.
    if (body.actividad_origen_id) {
      await autoCompletarActividad({
        admin,
        empresaId,
        actividadId: body.actividad_origen_id,
        eventoEsperado: 'al_crear',
        usuarioId: user.id,
        usuarioNombre: nombreUsuario,
        mensajeChatter: `Completada automáticamente al crear presupuesto ${presupuesto.numero}`,
        metadataChatter: { presupuesto_id: presupuesto.id, presupuesto_numero: presupuesto.numero },
      })
    }

    // Crear líneas iniciales si se proporcionaron
    if (body.lineas?.length) {
      const lineas = body.lineas.map((linea: {
        tipo_linea?: string; orden?: number; codigo_producto?: string; descripcion?: string;
        descripcion_detalle?: string; cantidad?: string; unidad?: string; precio_unitario?: string;
        descuento?: string; impuesto_label?: string; impuesto_porcentaje?: string; monto?: string
      }, idx: number) => {
        const cantidad = parseFloat(linea.cantidad || '1')
        const precioUnitario = parseFloat(linea.precio_unitario || '0')
        const descuentoPct = parseFloat(linea.descuento || '0')
        const impuestoPct = parseFloat(linea.impuesto_porcentaje || '0')

        const subtotal = cantidad * precioUnitario * (1 - descuentoPct / 100)
        const impuestoMonto = subtotal * impuestoPct / 100
        const total = subtotal + impuestoMonto

        return {
          presupuesto_id: presupuesto.id,
          empresa_id: empresaId,
          tipo_linea: linea.tipo_linea || 'producto',
          orden: linea.orden ?? idx,
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
          monto: linea.monto || null,
        }
      })

      await admin.from('lineas_presupuesto').insert(lineas)

      // Recalcular totales del presupuesto (subtotal_neto, total_impuestos, total_final)
      // sin esto, el portal público y el PDF leen $0 aunque el editor los calcula en vivo
      await admin.rpc('recalcular_totales_presupuesto', {
        p_presupuesto_id: presupuesto.id,
        p_usuario_id: user.id,
      })
    }

    // Registrar en historial de recientes (fire-and-forget)
    const nombreCto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido].filter(Boolean).join(' ')
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'presupuesto',
      entidadId: presupuesto.id as string,
      titulo: `Presupuesto #${presupuesto.numero}${nombreCto ? ` — ${nombreCto}` : ''}`,
      subtitulo: 'borrador',
      accion: 'creado',
    })

    return NextResponse.json(presupuesto, { status: 201 })
  } catch (err) {
    console.error('Error interno POST /api/presupuestos:', err)
    return NextResponse.json({ error: 'Error interno', detalle: String(err) }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/presupuestos — Listar presupuestos de la empresa activa.
 * Soporta: búsqueda, filtros por estado/contacto/moneda/fecha, paginación, ordenamiento.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const busqueda = params.get('busqueda') || ''
    const estado = params.get('estado')
    const contacto_id = params.get('contacto_id')
    const moneda = params.get('moneda')
    const fecha_desde = params.get('fecha_desde')
    const fecha_hasta = params.get('fecha_hasta')
    const en_papelera = params.get('en_papelera') === 'true'
    const orden_campo = params.get('orden_campo') || 'numero'
    const orden_dir = params.get('orden_dir') === 'asc' ? true : false
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    let query = admin
      .from('presupuestos')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', en_papelera)

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

    // Filtro por rango de fechas
    if (fecha_desde) {
      query = query.gte('fecha_emision', fecha_desde)
    }
    if (fecha_hasta) {
      query = query.lte('fecha_emision', fecha_hasta)
    }

    // Búsqueda full-text
    if (busqueda.trim()) {
      if (busqueda.length <= 2) {
        query = query.or(`numero.ilike.%${busqueda}%,contacto_nombre.ilike.%${busqueda}%,contacto_apellido.ilike.%${busqueda}%,referencia.ilike.%${busqueda}%`)
      } else {
        const terminos = busqueda.trim().split(/\s+/).map(t => `${t}:*`).join(' & ')
        query = query.textSearch('busqueda', terminos, { config: 'spanish' })
      }
    }

    // Ordenamiento y paginación
    query = query
      .order(orden_campo, { ascending: orden_dir })
      .range(desde, desde + por_pagina - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error al listar presupuestos:', error)
      return NextResponse.json({ error: 'Error al obtener presupuestos' }, { status: 500 })
    }

    return NextResponse.json({
      presupuestos: data || [],
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
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Generar número secuencial
    const { data: numero, error: numError } = await admin
      .rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'presupuesto' })

    if (numError || !numero) {
      console.error('Error al generar número:', numError)
      return NextResponse.json({ error: 'Error al generar número de presupuesto' }, { status: 500 })
    }

    // Obtener config para defaults
    const { data: config } = await admin
      .from('config_presupuestos')
      .select('*')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    // Obtener nombre del usuario
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

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
      creado_por: user.id,
      creado_por_nombre: nombreUsuario,
    }

    const { data: presupuesto, error: insertError } = await admin
      .from('presupuestos')
      .insert(nuevoPresupuesto)
      .select('*')
      .single()

    if (insertError) {
      console.error('Error al crear presupuesto:', insertError)
      return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 })
    }

    // Registrar estado inicial en historial
    await admin.from('presupuesto_historial').insert({
      presupuesto_id: presupuesto.id,
      empresa_id: empresaId,
      estado: 'borrador',
      usuario_id: user.id,
      usuario_nombre: nombreUsuario,
    })

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
    }

    return NextResponse.json(presupuesto, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

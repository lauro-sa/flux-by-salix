import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { sanitizarBusqueda, normalizarAcentos } from '@/lib/validaciones'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/productos — Listar productos/servicios de la empresa activa.
 * Soporta: búsqueda full-text, filtros por tipo/categoría/activo, paginación.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Productos son compartidos — solo verificar que tenga permiso 'ver'
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'productos', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para ver productos' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const busqueda = sanitizarBusqueda(params.get('busqueda') || '')
    const tipo = params.get('tipo')
    const categoria = params.get('categoria')
    const activo = params.get('activo')
    const puede_venderse = params.get('puede_venderse')
    const puede_comprarse = params.get('puede_comprarse')
    const favorito = params.get('favorito')
    const en_papelera = params.get('en_papelera') === 'true'
    const orden_campo = params.get('orden_campo') || 'creado_en'
    const orden_dir = params.get('orden_dir') === 'asc'
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    let query = admin
      .from('productos')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', en_papelera)
      .eq('es_provisorio', false)

    // Filtros
    if (tipo) query = query.eq('tipo', tipo)
    if (categoria) query = query.eq('categoria', categoria)
    if (activo !== null && activo !== undefined) query = query.eq('activo', activo === 'true')
    if (puede_venderse) query = query.eq('puede_venderse', puede_venderse === 'true')
    if (puede_comprarse) query = query.eq('puede_comprarse', puede_comprarse === 'true')
    if (favorito === 'true') query = query.eq('favorito', true)

    // Búsqueda full-text (normalizada sin acentos)
    if (busqueda.trim()) {
      const busquedaNorm = normalizarAcentos(busqueda)
      if (busqueda.length <= 2) {
        query = query.or(`codigo.ilike.%${busquedaNorm}%,nombre.ilike.%${busquedaNorm}%,referencia_interna.ilike.%${busquedaNorm}%,codigo_barras.ilike.%${busquedaNorm}%`)
      } else {
        const terminos = busquedaNorm.trim().split(/\s+/).map(t => `${t}:*`).join(' & ')
        query = query.textSearch('busqueda', terminos, { config: 'spanish_unaccent' })
      }
    }

    // Ordenamiento y paginación
    query = query
      .order(orden_campo, { ascending: orden_dir })
      .range(desde, desde + por_pagina - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error al listar productos:', error)
      return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 })
    }

    return NextResponse.json({
      productos: data || [],
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
 * POST /api/productos — Crear un nuevo producto/servicio.
 * Genera código secuencial basado en prefijo configurado (PRD-0001, SRV-0001).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'productos', 'crear')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para crear productos' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const tipo = body.tipo || 'servicio'

    // Obtener o crear config de productos para esta empresa
    let { data: config } = await admin
      .from('config_productos')
      .select('prefijos')
      .eq('empresa_id', empresaId)
      .single()

    if (!config) {
      // Crear config por defecto
      await admin.from('config_productos').insert({ empresa_id: empresaId })
      const { data: nuevaConfig } = await admin
        .from('config_productos')
        .select('prefijos')
        .eq('empresa_id', empresaId)
        .single()
      config = nuevaConfig
    }

    // Generar código secuencial basado en prefijo
    const prefijos = (config?.prefijos || []) as { id: string; prefijo: string; siguiente: number }[]
    const prefijoConfig = prefijos.find(p => p.id === tipo) || { prefijo: tipo === 'servicio' ? 'SRV' : 'PRD', siguiente: 1 }
    const siguiente = prefijoConfig.siguiente || 1
    const codigo = `${prefijoConfig.prefijo}-${String(siguiente).padStart(4, '0')}`

    // Incrementar secuencia
    const prefijosActualizados = prefijos.map(p =>
      p.id === tipo ? { ...p, siguiente: siguiente + 1 } : p
    )
    // Si no existía el prefijo, agregarlo
    if (!prefijos.find(p => p.id === tipo)) {
      prefijosActualizados.push({ id: tipo, prefijo: prefijoConfig.prefijo, siguiente: siguiente + 1, label: tipo === 'servicio' ? 'Servicio' : 'Producto' } as never)
    }

    await admin
      .from('config_productos')
      .update({ prefijos: prefijosActualizados, actualizado_en: new Date().toISOString() })
      .eq('empresa_id', empresaId)

    // Obtener nombre del creador
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : 'Usuario'

    // Crear producto
    const nuevoProducto = {
      empresa_id: empresaId,
      codigo,
      nombre: body.nombre.trim(),
      tipo,
      categoria: body.categoria || null,
      referencia_interna: body.referencia_interna || null,
      codigo_barras: body.codigo_barras || null,
      imagen_url: body.imagen_url || null,
      precio_unitario: body.precio_unitario || null,
      moneda: body.moneda || null,
      costo: body.costo || null,
      desglose_costos: body.desglose_costos || [],
      impuesto_id: body.impuesto_id || null,
      impuesto_compra_id: body.impuesto_compra_id || null,
      unidad: body.unidad || 'unidad',
      descripcion: body.descripcion || null,
      descripcion_venta: body.descripcion_venta || null,
      notas_internas: body.notas_internas || null,
      peso: body.peso || null,
      volumen: body.volumen || null,
      puede_venderse: body.puede_venderse ?? true,
      puede_comprarse: body.puede_comprarse ?? false,
      activo: true,
      creado_por: user.id,
      creado_por_nombre: nombreCreador,
      origen: body.origen || 'manual',
      es_provisorio: body.es_provisorio || false,
    }

    const { data, error } = await admin
      .from('productos')
      .insert([nuevoProducto])
      .select()
      .single()

    if (error) {
      console.error('Error al crear producto:', error)
      return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
    }

    // Registrar en chatter
    await registrarChatter({
      empresaId,
      entidadTipo: 'producto',
      entidadId: data.id,
      contenido: `Creó ${tipo === 'servicio' ? 'el servicio' : 'el producto'} "${data.nombre}" (${data.codigo})`,
      autorId: user.id,
      autorNombre: nombreCreador,
      metadata: { accion: 'creado' },
    })

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

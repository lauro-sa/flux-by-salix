import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { sanitizarBusqueda } from '@/lib/validaciones'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarError } from '@/lib/logger'
import { registrarReciente } from '@/lib/recientes'

/**
 * GET /api/ordenes — Listar órdenes de trabajo de la empresa activa.
 * Soporta: búsqueda, filtros por estado/prioridad/contacto/asignado, paginación.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'ordenes_trabajo')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso para ver órdenes' }, { status: 403 })
    const soloPropio = visibilidad.soloPropio

    const params = request.nextUrl.searchParams
    const busqueda = sanitizarBusqueda(params.get('busqueda') || '')
    const estado = params.get('estado')
    const prioridad = params.get('prioridad')
    const contacto_id = params.get('contacto_id')
    const asignado_a = params.get('asignado_a')
    const presupuesto_id = params.get('presupuesto_id')
    const en_papelera = params.get('en_papelera') === 'true'
    const orden_campo = params.get('orden_campo') || 'numero'
    const orden_dir = params.get('orden_dir') === 'asc' ? true : false
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    let query = admin
      .from('ordenes_trabajo')
      .select(`
        id, numero, estado, prioridad, titulo, descripcion, publicada,
        contacto_id, contacto_nombre, contacto_telefono, contacto_direccion,
        presupuesto_id, presupuesto_numero,
        asignado_a, asignado_nombre,
        fecha_inicio, fecha_fin_estimada, fecha_fin_real,
        creado_por, creado_por_nombre, creado_en, actualizado_en
      `, { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', en_papelera)

    if (soloPropio) {
      // Obtener IDs de OTs donde el usuario es asignado
      const { data: misAsignaciones } = await admin
        .from('asignados_orden_trabajo')
        .select('orden_trabajo_id')
        .eq('empresa_id', empresaId)
        .eq('usuario_id', user.id)
      const idsAsignado = (misAsignaciones || []).map(a => a.orden_trabajo_id)

      if (idsAsignado.length > 0) {
        query = query.or(`creado_por.eq.${user.id},id.in.(${idsAsignado.join(',')})`)
      } else {
        query = query.eq('creado_por', user.id)
      }

      // Si no es admin, solo ver publicadas (excepto las que creó)
      // Esto se filtra después o en el frontend
    }

    // Filtro por estado
    if (estado) {
      const estados = estado.split(',')
      query = estados.length === 1 ? query.eq('estado', estados[0]) : query.in('estado', estados)
    }

    // Filtro por prioridad
    if (prioridad) {
      const prioridades = prioridad.split(',')
      query = prioridades.length === 1 ? query.eq('prioridad', prioridades[0]) : query.in('prioridad', prioridades)
    }

    if (contacto_id) query = query.eq('contacto_id', contacto_id)
    if (asignado_a) query = query.eq('asignado_a', asignado_a)
    if (presupuesto_id) query = query.eq('presupuesto_id', presupuesto_id)

    // Búsqueda por numero, titulo o contacto
    if (busqueda.trim()) {
      query = query.or(`numero.ilike.%${busqueda}%,titulo.ilike.%${busqueda}%,contacto_nombre.ilike.%${busqueda}%`)
    }

    query = query
      .order(orden_campo, { ascending: orden_dir })
      .range(desde, desde + por_pagina - 1)

    const { data, error, count } = await query

    if (error) {
      registrarError(error, { ruta: '/api/ordenes', accion: 'listar', empresaId })
      return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 })
    }

    return NextResponse.json({
      ordenes: data || [],
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
 * POST /api/ordenes — Crear una orden de trabajo manualmente.
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
    const admin = crearClienteAdmin()

    // Generar número y obtener perfil en paralelo
    const [{ data: numero, error: numError }, { data: perfil }] = await Promise.all([
      admin.rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'orden_trabajo' }),
      admin.from('perfiles').select('nombre, apellido').eq('id', user.id).single(),
    ])

    if (numError || !numero) {
      return NextResponse.json({ error: 'Error al generar número de orden' }, { status: 500 })
    }

    const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : null

    // Snapshot del contacto operativo (sin datos fiscales)
    let snapshotContacto: Record<string, string | null> = {}
    if (body.contacto_id) {
      const { data: contacto } = await admin
        .from('contactos')
        .select(`
          nombre, apellido, correo, telefono, whatsapp,
          direcciones:contacto_direcciones(texto, es_principal)
        `)
        .eq('id', body.contacto_id)
        .single()

      if (contacto) {
        const dirPrincipal = (contacto.direcciones as { texto: string | null; es_principal: boolean }[])?.find(d => d.es_principal)
        snapshotContacto = {
          contacto_nombre: [contacto.nombre, contacto.apellido].filter(Boolean).join(' '),
          contacto_telefono: contacto.telefono,
          contacto_correo: contacto.correo,
          contacto_direccion: dirPrincipal?.texto || null,
          contacto_whatsapp: contacto.whatsapp || contacto.telefono,
        }
      }
    }

    // Asignados: array de { usuario_id, usuario_nombre, es_cabecilla }
    const asignados: { usuario_id: string; usuario_nombre: string; es_cabecilla: boolean }[] = body.asignados || []

    // Cabecilla denormalizado para queries rápidas
    const cabecilla = asignados.find(a => a.es_cabecilla) || asignados[0] || null

    const nuevaOrden = {
      empresa_id: empresaId,
      numero: numero as string,
      estado: 'abierta',
      publicada: false,
      prioridad: body.prioridad || 'media',
      titulo: body.titulo,
      descripcion: body.descripcion || null,
      notas: body.notas || null,
      contacto_id: body.contacto_id || null,
      ...snapshotContacto,
      presupuesto_id: body.presupuesto_id || null,
      presupuesto_numero: body.presupuesto_numero || null,
      asignado_a: cabecilla?.usuario_id || null,
      asignado_nombre: cabecilla?.usuario_nombre || null,
      fecha_inicio: body.fecha_inicio || null,
      fecha_fin_estimada: body.fecha_fin_estimada || null,
      creado_por: user.id,
      creado_por_nombre: nombreUsuario,
    }

    // Insertar con reintento por duplicado de numero
    let orden: Record<string, unknown> | null = null
    for (let intento = 0; intento < 3; intento++) {
      const { data, error: insertError } = await admin
        .from('ordenes_trabajo')
        .insert(nuevaOrden)
        .select('*')
        .single()

      if (!insertError && data) {
        orden = data
        break
      }

      if (insertError?.code === '23505' && insertError.message?.includes('numero')) {
        const { data: nuevoNumero } = await admin.rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'orden_trabajo' })
        if (nuevoNumero) { nuevaOrden.numero = nuevoNumero as string; continue }
      }

      return NextResponse.json({ error: 'Error al crear orden' }, { status: 500 })
    }

    if (!orden) return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 })

    // Historial + chatter + asignados en paralelo
    await Promise.all([
      admin.from('orden_trabajo_historial').insert({
        orden_trabajo_id: orden.id as string,
        empresa_id: empresaId,
        estado: 'abierta',
        usuario_id: user.id,
        usuario_nombre: nombreUsuario,
      }),
      registrarChatter({
        empresaId,
        entidadTipo: 'orden_trabajo',
        entidadId: orden.id as string,
        contenido: `Creó la orden de trabajo ${orden.numero}`,
        autorId: user.id,
        autorNombre: nombreUsuario || 'Usuario',
        metadata: { accion: 'creado' },
      }),
      // Insertar asignados
      asignados.length > 0
        ? admin.from('asignados_orden_trabajo').insert(
            asignados.map(a => ({
              orden_trabajo_id: orden!.id as string,
              empresa_id: empresaId,
              usuario_id: a.usuario_id,
              usuario_nombre: a.usuario_nombre,
              es_cabecilla: a.es_cabecilla,
            }))
          )
        : Promise.resolve(),
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

    return NextResponse.json(orden, { status: 201 })
  } catch (err) {
    console.error('Error interno POST /api/ordenes:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

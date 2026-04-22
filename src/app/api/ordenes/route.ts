import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { sanitizarBusqueda, normalizarAcentos } from '@/lib/validaciones'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarError } from '@/lib/logger'
import { registrarReciente } from '@/lib/recientes'
import { obtenerInicioFinDiaEnZona } from '@/lib/formato-fecha'

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
    // Admins bypasean el filtro de publicación (ven borradores ajenos)
    const rolUsuario = visibilidad.miembro?.rol
    const esAdminOT = ['propietario', 'administrador', 'gerente'].includes(rolUsuario || '')
      || Boolean(user.app_metadata?.es_superadmin)

    const params = request.nextUrl.searchParams
    const busqueda = sanitizarBusqueda(params.get('busqueda') || '')
    const estado = params.get('estado') // CSV
    const prioridad = params.get('prioridad') // CSV
    const contacto_id = params.get('contacto_id')
    const tipo_contacto = params.get('tipo_contacto') // CSV: persona,empresa,edificio
    // 'asignado_a' ahora soporta CSV (multi)
    const asignado_a = params.get('asignado_a')
    const sin_asignar = params.get('sin_asignar') === 'true'
    const creado_por = params.get('creado_por')
    const presupuesto_id = params.get('presupuesto_id')
    const con_presupuesto = params.get('con_presupuesto') // 'true' | 'false'
    const vencida = params.get('vencida') // 'true' | 'false'
    const publicada = params.get('publicada') // 'true' | 'false'
    const fecha = params.get('fecha') // 'hoy' | 'semana' | 'vencidas' | 'futuras'
    const anio = params.get('anio')
    const en_papelera = params.get('en_papelera') === 'true'
    const orden_campo = params.get('orden_campo') || 'numero'
    const orden_dir = params.get('orden_dir') === 'asc' ? true : false
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    // Filtro por tipo_contacto — JOIN implícito (ver nota en /api/presupuestos/route.ts).
    // Pre-query: clave → tipo_contacto.id → contacto.id → in().
    let idsPorTipoContacto: string[] | null = null
    if (tipo_contacto) {
      const tipos = tipo_contacto.split(',').filter(Boolean)
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
          return NextResponse.json({ ordenes: [], total: 0, pagina, por_pagina, total_paginas: 0 })
        }
      } else {
        return NextResponse.json({ ordenes: [], total: 0, pagina, por_pagina, total_paginas: 0 })
      }
    }

    let query = admin
      .from('ordenes_trabajo')
      .select(`
        id, numero, estado, prioridad, titulo, descripcion, publicada,
        contacto_id, contacto_nombre, contacto_telefono, contacto_direccion,
        presupuesto_id, presupuesto_numero,
        fecha_inicio, fecha_fin_estimada, fecha_fin_real,
        creado_por, creado_por_nombre, creado_en, actualizado_en
      `, { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', en_papelera)

    // ── Filtro por publicación + visibilidad ──
    // Regla: los asignados comunes NO ven borradores. Solo ven publicadas o donde son
    // creador/cabecilla. Admins ven todo. soloPropio acota al universo propio primero.
    if (!esAdminOT) {
      // Cargar asignaciones del user para distinguir cabecilla vs común
      const { data: misAsignaciones } = await admin
        .from('asignados_orden_trabajo')
        .select('orden_trabajo_id, es_cabecilla')
        .eq('empresa_id', empresaId)
        .eq('usuario_id', user.id)
      const asigs = misAsignaciones || []
      const idsCabecilla = asigs.filter(a => a.es_cabecilla).map(a => a.orden_trabajo_id)
      const idsAsignadoComun = asigs.filter(a => !a.es_cabecilla).map(a => a.orden_trabajo_id)

      // Construir las cláusulas OR aplicables a este usuario.
      const clausulas: string[] = [`creado_por.eq.${user.id}`]
      if (idsCabecilla.length > 0) clausulas.push(`id.in.(${idsCabecilla.join(',')})`)
      if (idsAsignadoComun.length > 0) {
        // Asignado común: solo ve esas OTs si están publicadas
        clausulas.push(`and(publicada.eq.true,id.in.(${idsAsignadoComun.join(',')}))`)
      }

      if (soloPropio) {
        // Universo: solo las que le pertenecen (creador, cabecilla, o asignado común publicada)
        query = query.or(clausulas.join(','))
      } else {
        // verTodos sin ser admin: ve publicadas ajenas + todas las propias/cabecillas
        query = query.or([`publicada.eq.true`, ...clausulas].join(','))
      }
    }

    // Filtro por tipo de contacto (vía contactos.tipo_contacto_id)
    if (idsPorTipoContacto) {
      query = query.in('contacto_id', idsPorTipoContacto)
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

    // Filtro por asignado (CSV multi) — se resuelve vía tabla asignados_orden_trabajo
    // (pre-query: traer IDs de OT donde esos usuarios son asignados).
    if (asignado_a) {
      const ids = asignado_a.split(',').filter(Boolean)
      const { data: asignsMatch } = await admin
        .from('asignados_orden_trabajo')
        .select('orden_trabajo_id')
        .eq('empresa_id', empresaId)
        .in('usuario_id', ids)
      const idsOT = Array.from(new Set((asignsMatch || []).map(a => a.orden_trabajo_id)))
      if (idsOT.length === 0) {
        return NextResponse.json({ ordenes: [], total: 0, pagina, por_pagina, total_paginas: 0 })
      }
      query = query.in('id', idsOT)
    }

    // Filtro "sin asignar" — OT que no tiene ninguna fila en asignados_orden_trabajo.
    if (sin_asignar) {
      const { data: idsConAsignado } = await admin
        .from('asignados_orden_trabajo')
        .select('orden_trabajo_id')
        .eq('empresa_id', empresaId)
      const idsExcluir = Array.from(new Set((idsConAsignado || []).map(a => a.orden_trabajo_id)))
      if (idsExcluir.length > 0) {
        query = query.not('id', 'in', `(${idsExcluir.join(',')})`)
      }
    }

    // Filtro por creador
    if (creado_por) query = query.eq('creado_por', creado_por)

    if (presupuesto_id) query = query.eq('presupuesto_id', presupuesto_id)

    // Filtro "con presupuesto"
    if (con_presupuesto === 'true') {
      query = query.not('presupuesto_id', 'is', null)
    } else if (con_presupuesto === 'false') {
      query = query.is('presupuesto_id', null)
    }

    // Filtro "publicada"
    if (publicada === 'true') {
      query = query.eq('publicada', true)
    } else if (publicada === 'false') {
      query = query.eq('publicada', false)
    }

    // Filtro "vencida" — fecha_fin_estimada < hoy AND estado activo
    if (vencida === 'true') {
      const ahora = new Date().toISOString()
      query = query.lt('fecha_fin_estimada', ahora).in('estado', ['abierta', 'en_progreso', 'esperando'])
    } else if (vencida === 'false') {
      const ahora = new Date().toISOString()
      query = query.or(`fecha_fin_estimada.gte.${ahora},fecha_fin_estimada.is.null,estado.in.(completada,cancelada)`)
    }

    // Filtro por fecha programada (preset) — calculado en zona de la empresa, no UTC.
    if (fecha) {
      const { data: empOrd } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
      const zonaOrd = (empOrd?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
      const ahora = new Date()
      const rangoHoy = obtenerInicioFinDiaEnZona(zonaOrd, ahora)
      const hoyISO = rangoHoy.inicio
      const mananaISO = rangoHoy.fin
      const finSemanaISO = obtenerInicioFinDiaEnZona(zonaOrd, new Date(ahora.getTime() + 7 * 24 * 3600_000)).inicio
      switch (fecha) {
        case 'hoy':
          query = query.gte('fecha_inicio', hoyISO).lt('fecha_inicio', mananaISO)
          break
        case 'semana':
          query = query.gte('fecha_inicio', hoyISO).lt('fecha_inicio', finSemanaISO)
          break
        case 'vencidas':
          query = query.lt('fecha_fin_estimada', hoyISO).in('estado', ['abierta', 'en_progreso', 'esperando'])
          break
        case 'futuras':
          query = query.gte('fecha_inicio', mananaISO)
          break
      }
    }

    // Filtro por año (de creado_en)
    if (anio) {
      const a = parseInt(anio)
      if (!isNaN(a)) {
        const inicio = new Date(a, 0, 1).toISOString()
        const fin = new Date(a + 1, 0, 1).toISOString()
        query = query.gte('creado_en', inicio).lt('creado_en', fin)
      }
    }

    // Búsqueda accent-insensitive en múltiples campos + match por etiqueta de estado
    if (busqueda.trim()) {
      const busquedaNorm = normalizarAcentos(busqueda).toLowerCase()

      // Detectar si el término coincide con alguna etiqueta de estado de OT
      const ESTADO_KEYWORDS: Record<string, string[]> = {
        abierta: ['abierta', 'abrir', 'open'],
        en_progreso: ['progreso', 'en progreso', 'curso'],
        esperando: ['esperando', 'espera', 'pausa'],
        completada: ['completada', 'completa', 'finalizada', 'cerrada'],
        cancelada: ['cancelada', 'cancel'],
      }
      const estadosCoincidentes: string[] = []
      for (const [estadoClave, palabras] of Object.entries(ESTADO_KEYWORDS)) {
        if (palabras.some(p => p.startsWith(busquedaNorm) || busquedaNorm.startsWith(p))) {
          estadosCoincidentes.push(estadoClave)
        }
      }

      // Nombre del asignado: pre-query a asignados_orden_trabajo por nombre.
      const { data: idsPorAsignado } = await admin
        .from('asignados_orden_trabajo')
        .select('orden_trabajo_id')
        .eq('empresa_id', empresaId)
        .ilike('usuario_nombre', `%${busquedaNorm}%`)
      const idsOTporAsignado = Array.from(new Set((idsPorAsignado || []).map(a => a.orden_trabajo_id)))

      const filtroBase = [
        `numero.ilike.%${busquedaNorm}%`,
        `titulo.ilike.%${busquedaNorm}%`,
        `descripcion.ilike.%${busquedaNorm}%`,
        `contacto_nombre.ilike.%${busquedaNorm}%`,
        `contacto_direccion.ilike.%${busquedaNorm}%`,
        `creado_por_nombre.ilike.%${busquedaNorm}%`,
        `presupuesto_numero.ilike.%${busquedaNorm}%`,
      ]
      if (idsOTporAsignado.length > 0) {
        filtroBase.push(`id.in.(${idsOTporAsignado.join(',')})`)
      }
      if (estadosCoincidentes.length > 0) {
        filtroBase.push(`estado.in.(${estadosCoincidentes.join(',')})`)
      }
      query = query.or(filtroBase.join(','))
    }

    query = query
      .order(orden_campo, { ascending: orden_dir })
      .range(desde, desde + por_pagina - 1)

    const { data, error, count } = await query

    if (error) {
      registrarError(error, { ruta: '/api/ordenes', accion: 'listar', empresaId })
      return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 })
    }

    // Adjuntar asignados de cada OT desde asignados_orden_trabajo.
    // Para el cliente armamos también `asignado_nombre` (cabecilla o primero) como
    // atajo visual — deriva de los asignados, NO se persiste.
    const ordenesConAsignados: Record<string, unknown>[] = data || []
    if (ordenesConAsignados.length > 0) {
      const idsOT = ordenesConAsignados.map(o => o.id as string)
      const { data: asignadosData } = await admin
        .from('asignados_orden_trabajo')
        .select('orden_trabajo_id, usuario_id, usuario_nombre, es_cabecilla')
        .in('orden_trabajo_id', idsOT)

      const porOT = new Map<string, { usuario_id: string; usuario_nombre: string; es_cabecilla: boolean }[]>()
      for (const a of asignadosData || []) {
        const lista = porOT.get(a.orden_trabajo_id as string) || []
        lista.push({
          usuario_id: a.usuario_id as string,
          usuario_nombre: a.usuario_nombre as string,
          es_cabecilla: a.es_cabecilla as boolean,
        })
        porOT.set(a.orden_trabajo_id as string, lista)
      }

      for (const ot of ordenesConAsignados) {
        const asigs = porOT.get(ot.id as string) || []
        const cabecilla = asigs.find(a => a.es_cabecilla) || asigs[0] || null
        ot.asignados = asigs
        ot.asignado_nombre = cabecilla?.usuario_nombre || null
        ot.asignado_a = cabecilla?.usuario_id || null
      }
    }

    return NextResponse.json({
      ordenes: ordenesConAsignados,
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

    // Asignados: array de { usuario_id, usuario_nombre, es_cabecilla }.
    // Los datos viven en asignados_orden_trabajo; acá solo se valida la forma
    // para insertar después de crear la OT.
    const asignados: { usuario_id: string; usuario_nombre: string; es_cabecilla: boolean }[] = body.asignados || []

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

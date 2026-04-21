import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { crearNotificacion } from '@/lib/notificaciones'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarReciente } from '@/lib/recientes'
import { sanitizarBusqueda, normalizarAcentos } from '@/lib/validaciones'
import { inicioRangoFechaISO } from '@/lib/presets-fecha'
import { obtenerInicioFinDiaEnZona } from '@/lib/formato-fecha'

/**
 * GET /api/actividades — Listar actividades de la empresa activa.
 * Soporta: búsqueda, filtros por estado/tipo/asignado/fecha/vista, paginación, ordenamiento.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permisos de visibilidad con una sola query a BD
    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'actividades')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso para ver actividades' }, { status: 403 })
    const soloPropio = visibilidad.soloPropio

    const params = request.nextUrl.searchParams
    const busqueda = sanitizarBusqueda(params.get('busqueda') || '')
    const estado = params.get('estado')
    const tipo = params.get('tipo')
    const prioridad = params.get('prioridad')
    // 'asignado_a' ahora soporta CSV (multi-select)
    const asignado_a = params.get('asignado_a')
    // 'sin_asignado' = 'true' filtra actividades sin ningún asignado
    const sin_asignado = params.get('sin_asignado') === 'true'
    // 'creado_por' = ID del usuario creador
    const creado_por = params.get('creado_por')
    // 'creado_rango' = 'hoy' | '7d' | '30d' | '90d' | 'este_ano'
    const creado_rango = params.get('creado_rango')
    const vista = params.get('vista') || 'todas' // 'todas' | 'mias' | 'enviadas'
    const fecha = params.get('fecha') // 'hoy' | 'semana' | 'vencidas' | 'sin_fecha' | 'futuras'
    const contacto_id = params.get('contacto_id') // filtrar por vínculo a contacto
    const orden_trabajo_id = params.get('orden_trabajo_id') // filtrar por vínculo a orden de trabajo
    const presupuesto_id = params.get('presupuesto_id') // filtrar por vínculo a presupuesto
    const en_papelera = params.get('en_papelera') === 'true'
    const orden_campo = params.get('orden_campo') || 'fecha_vencimiento'
    const orden_dir = params.get('orden_dir') ? params.get('orden_dir') === 'asc' : true
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    let query = admin
      .from('actividades')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', en_papelera)

    // Si solo tiene ver_propio, forzar filtro por creador o asignado a él
    if (soloPropio) {
      query = query.or(`creado_por.eq.${user.id},asignados_ids.cs.{${user.id}}`)
    }

    // Vista: propias = creadas por mí O asignadas a mí (default del sistema)
    // mias = solo asignadas a mí, enviadas = solo creadas por mí
    if (vista === 'propias') {
      query = query.or(`creado_por.eq.${user.id},asignados_ids.cs.{${user.id}}`)
    } else if (vista === 'mias') {
      query = query.contains('asignados_ids', [user.id])
    } else if (vista === 'enviadas') {
      query = query.eq('creado_por', user.id)
    }

    // Filtro por estado
    if (estado) {
      const estados = estado.split(',')
      query = estados.length === 1 ? query.eq('estado_clave', estados[0]) : query.in('estado_clave', estados)
    } else {
      // Default: ocultar completadas y canceladas (el usuario las ve solo si las filtra explícitamente)
      query = query.not('estado_clave', 'in', '(completada,cancelada)')
    }

    // Filtro por tipo
    if (tipo) {
      const tipos = tipo.split(',')
      query = tipos.length === 1 ? query.eq('tipo_clave', tipos[0]) : query.in('tipo_clave', tipos)
    }

    // Filtro por prioridad
    if (prioridad) {
      query = query.eq('prioridad', prioridad)
    }

    // Filtro por asignado (CSV → multi-select). Match si CUALQUIER asignado coincide.
    if (asignado_a) {
      const ids = asignado_a.split(',').filter(Boolean)
      if (ids.length === 1) {
        query = query.contains('asignados_ids', ids)
      } else if (ids.length > 1) {
        // overlaps: actividades cuyo array asignados_ids tenga al menos uno de estos IDs
        query = query.overlaps('asignados_ids', ids)
      }
    }

    // Filtro "sin asignado" — actividades que no tienen ningún responsable
    if (sin_asignado) {
      // Postgres: array vacío o NULL. Más simple: usar .or
      query = query.or('asignados_ids.is.null,asignados_ids.eq.{}')
    }

    // Filtro por creador
    if (creado_por) {
      query = query.eq('creado_por', creado_por)
    }

    // Filtro por contacto vinculado
    if (contacto_id) {
      query = query.contains('vinculo_ids', [contacto_id])
    }

    // Filtro por orden de trabajo vinculada
    if (orden_trabajo_id) {
      query = query.contains('vinculo_ids', [orden_trabajo_id])
    }

    // Filtro por presupuesto vinculado
    if (presupuesto_id) {
      query = query.contains('vinculo_ids', [presupuesto_id])
    }

    // Filtro por fecha — calculado en la zona de la empresa para que "hoy/semana/vencidas"
    // coincidan con el día local, no con UTC del server.
    if (fecha) {
      const { data: empFecha } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
      const zonaFecha = (empFecha?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
      const ahora = new Date()
      const rangoHoy = obtenerInicioFinDiaEnZona(zonaFecha, ahora)
      const hoyISO = rangoHoy.inicio
      const mananaISO = rangoHoy.fin
      // Fin de semana (+7 días desde hoy)
      const rangoFinSemana = obtenerInicioFinDiaEnZona(zonaFecha, new Date(ahora.getTime() + 7 * 24 * 3600_000))
      const finSemanaISO = rangoFinSemana.inicio

      switch (fecha) {
        case 'hoy':
          query = query.gte('fecha_vencimiento', hoyISO).lt('fecha_vencimiento', mananaISO)
          break
        case 'semana':
          query = query.gte('fecha_vencimiento', hoyISO).lt('fecha_vencimiento', finSemanaISO)
          break
        case 'vencidas':
          query = query.lt('fecha_vencimiento', hoyISO).in('estado_clave', ['pendiente', 'vencida'])
          break
        case 'sin_fecha':
          query = query.is('fecha_vencimiento', null)
          break
        case 'futuras':
          query = query.gte('fecha_vencimiento', mananaISO)
          break
      }
    }

    // Filtro por rango de fecha (actualizado_en) — usado para "finalizadas hoy"
    const fecha_desde = params.get('fecha_desde')
    const fecha_hasta = params.get('fecha_hasta')
    if (fecha_desde) query = query.gte('actualizado_en', fecha_desde)
    if (fecha_hasta) query = query.lt('actualizado_en', fecha_hasta)

    // Filtro por preset de fecha de creación (ver src/lib/presets-fecha.ts)
    if (creado_rango) {
      const { data: emp } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
      const desdeISO = inicioRangoFechaISO(creado_rango, new Date(), (emp?.zona_horaria as string) || undefined)
      if (desdeISO) query = query.gte('creado_en', desdeISO)
    }

    // Búsqueda case + accent insensitive en múltiples campos:
    // titulo, descripcion, creado_por_nombre, y nombres de asignados/vínculos (jsonb)
    if (busqueda.trim()) {
      const busquedaNorm = normalizarAcentos(busqueda)
      // ilike es case-insensitive. Para acent-insensitive, normalizamos el patrón
      // (los datos en BD se guardan con acentos pero el normalizarAcentos del input
      //  permite buscar "jose" → encuentra "José" si la BD tiene índice unaccent;
      //  caso contrario, ilike sigue funcionando para mayúsculas/minúsculas)
      query = query.or([
        `titulo.ilike.%${busquedaNorm}%`,
        `descripcion.ilike.%${busquedaNorm}%`,
        `creado_por_nombre.ilike.%${busquedaNorm}%`,
      ].join(','))
    }

    // Ordenamiento y paginación
    if (orden_campo !== 'fecha_vencimiento') {
      query = query
        .order(orden_campo, { ascending: orden_dir, nullsFirst: false })
        .order('creado_en', { ascending: false })
    }
    query = query.range(desde, desde + por_pagina - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('Error al listar actividades:', error)
      return NextResponse.json({ error: 'Error al listar actividades' }, { status: 500 })
    }

    // Orden inteligente: Activas (Hoy → Vencidas → Futuras → Sin fecha) → Cerradas al final
    // Con prioridad como desempate dentro de cada grupo
    let actividades = data || []
    if (orden_campo === 'fecha_vencimiento') {
      // "Hoy" en zona de empresa para clasificar correctamente las actividades del día local.
      const { data: empOrden } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
      const zonaOrden = (empOrden?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
      const rangoOrden = obtenerInicioFinDiaEnZona(zonaOrden, new Date())
      const hoy = new Date(rangoOrden.inicio)
      const manana = new Date(rangoOrden.fin)

      const esCerrada = (estadoClave: string | null): boolean =>
        estadoClave === 'completada' || estadoClave === 'cancelada'

      const pesoGrupo = (fecha: string | null): number => {
        if (!fecha) return 4 // sin fecha al final
        const f = new Date(fecha)
        if (f >= hoy && f < manana) return 1 // hoy primero
        if (f < hoy) return 2 // vencidas después
        return 3 // futuras
      }

      const pesoPrioridad: Record<string, number> = { alta: 1, normal: 2, baja: 3 }

      actividades = actividades.sort((a, b) => {
        // Cerradas (completadas/canceladas) siempre al final
        const ca = esCerrada(a.estado_clave) ? 1 : 0
        const cb = esCerrada(b.estado_clave) ? 1 : 0
        if (ca !== cb) return ca - cb

        const ga = pesoGrupo(a.fecha_vencimiento)
        const gb = pesoGrupo(b.fecha_vencimiento)
        if (ga !== gb) return ga - gb

        // Dentro del mismo grupo: por prioridad (alta primero)
        const pa = pesoPrioridad[a.prioridad] || 2
        const pb = pesoPrioridad[b.prioridad] || 2
        if (pa !== pb) return pa - pb

        // Dentro de misma prioridad: por fecha (más próxima primero para futuras, más reciente para vencidas)
        if (a.fecha_vencimiento && b.fecha_vencimiento) {
          const fa = new Date(a.fecha_vencimiento).getTime()
          const fb = new Date(b.fecha_vencimiento).getTime()
          if (ga === 2) return fb - fa // vencidas: más reciente primero
          return fa - fb // futuras: más próxima primero
        }

        return 0
      })
    }

    return NextResponse.json({
      actividades,
      total: count || 0,
      pagina,
      por_pagina,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/actividades — Crear una actividad nueva.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'actividades', 'crear')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para crear actividades' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }
    if (!body.tipo_id) {
      return NextResponse.json({ error: 'El tipo es obligatorio' }, { status: 400 })
    }

    // Queries independientes en paralelo: tipo, estado default y perfil del creador
    const [
      { data: tipo },
      { data: estadoDefault },
      { data: perfil },
    ] = await Promise.all([
      admin.from('tipos_actividad').select('clave, etiqueta, color').eq('id', body.tipo_id).single(),
      admin.from('estados_actividad').select('id, clave').eq('empresa_id', empresaId).eq('clave', 'pendiente').single(),
      admin.from('perfiles').select('nombre, apellido').eq('id', user.id).single(),
    ])

    if (!tipo) return NextResponse.json({ error: 'Tipo no encontrado' }, { status: 404 })
    if (!estadoDefault) return NextResponse.json({ error: 'Estado pendiente no encontrado' }, { status: 500 })

    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    // Vínculos
    const vinculos = Array.isArray(body.vinculos) ? body.vinculos : []
    const vinculoIds = vinculos.map((v: { id: string }) => v.id)

    const { data, error } = await admin
      .from('actividades')
      .insert({
        empresa_id: empresaId,
        titulo: body.titulo.trim(),
        descripcion: body.descripcion || null,
        tipo_id: body.tipo_id,
        tipo_clave: tipo.clave,
        estado_id: body.estado_id || estadoDefault.id,
        estado_clave: body.estado_clave || estadoDefault.clave,
        prioridad: body.prioridad || 'normal',
        fecha_vencimiento: body.fecha_vencimiento || null,
        asignados: Array.isArray(body.asignados) ? body.asignados : [],
        asignados_ids: Array.isArray(body.asignados_ids) ? body.asignados_ids : [],
        checklist: body.checklist || [],
        vinculos,
        vinculo_ids: vinculoIds,
        creado_por: user.id,
        creado_por_nombre: nombreCreador,
      })
      .select()
      .single()

    if (error) {
      console.error('Error al crear actividad:', error)
      return NextResponse.json({ error: 'Error al crear actividad' }, { status: 500 })
    }

    // Registrar UNA entrada en el chatter de cada entidad vinculada
    // Para evitar duplicados, registrar en cada entidad con todos los vínculos como contexto
    const entidadesRegistradas = new Set<string>()
    for (const vinculo of vinculos) {
      const clave = `${vinculo.tipo}:${vinculo.id}`
      if (entidadesRegistradas.has(clave)) continue
      entidadesRegistradas.add(clave)

      const otrosVinculos = vinculos.filter((v: { id: string }) => v.id !== vinculo.id)

      registrarChatter({
        empresaId,
        entidadTipo: vinculo.tipo,
        entidadId: vinculo.id,
        contenido: `Nueva actividad: ${body.titulo.trim()}`,
        autorId: user.id,
        autorNombre: nombreCreador,
        metadata: {
          accion: 'actividad_creada',
          actividad_id: data.id,
          tipo_actividad: tipo.clave,
          tipo_etiqueta: tipo.etiqueta,
          tipo_color: tipo.color,
          titulo: body.titulo.trim(),
          descripcion: body.descripcion || null,
          prioridad: body.prioridad || 'normal',
          fecha_vencimiento: body.fecha_vencimiento || null,
          asignados: Array.isArray(body.asignados) ? body.asignados : [],
          vinculos_relacionados: otrosVinculos,
        },
      })
    }

    // Notificar a todos los asignados (excepto al creador)
    const listaAsignados = Array.isArray(data.asignados) ? data.asignados as { id: string; nombre: string }[] : []
    for (const asignado of listaAsignados) {
      if (asignado.id !== user.id) {
        crearNotificacion({
          empresaId,
          usuarioId: asignado.id,
          tipo: 'actividad_asignada',
          titulo: `📋 ${nombreCreador} te asignó`,
          cuerpo: `${tipo.etiqueta} · ${data.titulo}`,
          icono: 'ClipboardList',
          color: tipo.color,
          url: '/actividades',
          referenciaTipo: 'actividad',
          referenciaId: data.id,
        })
      }
    }

    // Registrar en historial de recientes (fire-and-forget)
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'actividad',
      entidadId: data.id,
      titulo: data.titulo || 'Actividad',
      subtitulo: data.estado_clave || undefined,
      accion: 'creado',
    })

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

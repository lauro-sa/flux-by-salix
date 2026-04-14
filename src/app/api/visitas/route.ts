import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { crearNotificacion } from '@/lib/notificaciones'
import { COLOR_NOTIFICACION } from '@/lib/colores_entidad'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarReciente } from '@/lib/recientes'
import { obtenerTiposVisita, crearRegistrosVinculados } from '@/lib/visitas-sync'

/**
 * GET /api/visitas — Listar visitas de la empresa activa.
 * Soporta: búsqueda, filtros por estado/prioridad/asignado/fecha/vista, paginación, ordenamiento.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'visitas')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso para ver visitas' }, { status: 403 })
    const soloPropio = visibilidad.soloPropio

    const params = request.nextUrl.searchParams
    const busqueda = params.get('busqueda') || ''
    const estado = params.get('estado')
    const prioridad = params.get('prioridad')
    const asignado_a = params.get('asignado_a')
    const contacto_id = params.get('contacto_id')
    const actividad_id = params.get('actividad_id')
    const vista = params.get('vista') || 'todas'
    const fecha = params.get('fecha')
    const en_papelera = params.get('en_papelera') === 'true'
    const archivadas = params.get('archivadas') === 'true'
    const orden_campo = params.get('orden_campo') || 'fecha_programada'
    const orden_dir = params.get('orden_dir') ? params.get('orden_dir') === 'asc' : true
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    let query = admin
      .from('visitas')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', en_papelera)
      .eq('archivada', archivadas)

    // Si solo tiene ver_propio, forzar filtro
    if (soloPropio) {
      query = query.or(`creado_por.eq.${user.id},asignado_a.eq.${user.id}`)
    }

    // Vista: propias = creadas por mí O asignadas a mí (default del sistema)
    // mias = solo asignadas a mí, enviadas = solo creadas por mí
    if (vista === 'propias') {
      query = query.or(`creado_por.eq.${user.id},asignado_a.eq.${user.id}`)
    } else if (vista === 'mias') {
      query = query.eq('asignado_a', user.id)
    } else if (vista === 'enviadas') {
      query = query.eq('creado_por', user.id)
    }

    // Filtro por estado
    if (estado) {
      const estados = estado.split(',')
      query = estados.length === 1 ? query.eq('estado', estados[0]) : query.in('estado', estados)
    }

    // Filtro por prioridad
    if (prioridad) {
      query = query.eq('prioridad', prioridad)
    }

    // Filtro por asignado
    if (asignado_a) {
      query = query.eq('asignado_a', asignado_a)
    }

    // Filtro por contacto
    if (contacto_id) {
      query = query.eq('contacto_id', contacto_id)
    }

    // Filtro por actividad vinculada
    if (actividad_id) {
      query = query.eq('actividad_id', actividad_id)
    }

    // Filtro por fecha
    if (fecha) {
      const ahora = new Date()
      const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
      const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)
      const finSemana = new Date(hoy); finSemana.setDate(finSemana.getDate() + 7)

      switch (fecha) {
        case 'hoy':
          query = query.gte('fecha_programada', hoy.toISOString()).lt('fecha_programada', manana.toISOString())
          break
        case 'semana':
          query = query.gte('fecha_programada', hoy.toISOString()).lt('fecha_programada', finSemana.toISOString())
          break
        case 'vencidas':
          query = query.lt('fecha_programada', hoy.toISOString()).in('estado', ['programada'])
          break
        case 'futuras':
          query = query.gte('fecha_programada', manana.toISOString())
          break
      }
    }

    // Filtro por rango de fecha (actualizado_en) — usado para "finalizadas hoy"
    const fecha_desde = params.get('fecha_desde')
    const fecha_hasta = params.get('fecha_hasta')
    if (fecha_desde) query = query.gte('actualizado_en', fecha_desde)
    if (fecha_hasta) query = query.lt('actualizado_en', fecha_hasta)

    // Búsqueda
    if (busqueda.trim()) {
      query = query.or(`contacto_nombre.ilike.%${busqueda}%,asignado_nombre.ilike.%${busqueda}%,motivo.ilike.%${busqueda}%,direccion_texto.ilike.%${busqueda}%`)
    }

    // Ordenamiento y paginación
    if (orden_campo === 'fecha_programada') {
      query = query
        .order('fecha_programada', { ascending: orden_dir, nullsFirst: false })
        .order('prioridad', { ascending: true })
        .order('creado_en', { ascending: true })
    } else {
      query = query
        .order(orden_campo, { ascending: orden_dir, nullsFirst: false })
        .order('creado_en', { ascending: true })
    }
    query = query.range(desde, desde + por_pagina - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('Error al listar visitas:', error)
      return NextResponse.json({ error: 'Error al listar visitas' }, { status: 500 })
    }

    return NextResponse.json({
      visitas: data || [],
      total: count || 0,
      pagina,
      por_pagina,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/visitas — Crear una visita nueva.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'crear')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para crear visitas' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    if (!body.contacto_id) {
      return NextResponse.json({ error: 'El contacto es obligatorio' }, { status: 400 })
    }
    if (!body.fecha_programada) {
      return NextResponse.json({ error: 'La fecha programada es obligatoria' }, { status: 400 })
    }

    // Queries en paralelo: contacto, config, perfil del creador
    const [
      { data: contacto },
      { data: config },
      { data: perfil },
    ] = await Promise.all([
      admin.from('contactos').select('nombre, empresa_nombre').eq('id', body.contacto_id).single(),
      admin.from('config_visitas').select('*').eq('empresa_id', empresaId).single(),
      admin.from('perfiles').select('nombre, apellido').eq('id', user.id).single(),
    ])

    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'
    const contactoNombre = contacto?.nombre || contacto?.empresa_nombre || body.contacto_nombre || 'Sin nombre'

    // Snapshot de dirección si se proporcionó
    let direccionTexto = body.direccion_texto || null
    let direccionLat = body.direccion_lat || null
    let direccionLng = body.direccion_lng || null

    if (body.direccion_id && !direccionTexto) {
      const { data: dir } = await admin
        .from('contacto_direcciones')
        .select('calle, ciudad, provincia, pais, lat, lng')
        .eq('id', body.direccion_id)
        .single()
      if (dir) {
        direccionTexto = [dir.calle, dir.ciudad, dir.provincia, dir.pais].filter(Boolean).join(', ')
        direccionLat = dir.lat
        direccionLng = dir.lng
      }
    }

    // Vinculos
    const vinculos = Array.isArray(body.vinculos) ? body.vinculos : []

    const { data, error } = await admin
      .from('visitas')
      .insert({
        empresa_id: empresaId,
        contacto_id: body.contacto_id,
        contacto_nombre: contactoNombre,
        direccion_id: body.direccion_id || null,
        direccion_texto: direccionTexto,
        direccion_lat: direccionLat,
        direccion_lng: direccionLng,
        asignado_a: body.asignado_a || null,
        asignado_nombre: body.asignado_nombre || null,
        fecha_programada: body.fecha_programada,
        duracion_estimada_min: body.duracion_estimada_min || config?.duracion_estimada_default || 30,
        estado: 'programada',
        motivo: body.motivo || null,
        notas: body.notas || null,
        prioridad: body.prioridad || 'normal',
        checklist: body.checklist || config?.checklist_predeterminado || [],
        recibe_nombre: body.recibe_nombre || null,
        recibe_telefono: body.recibe_telefono || null,
        actividad_id: body.actividad_id || null,
        vinculos,
        creado_por: user.id,
        creado_por_nombre: nombreCreador,
      })
      .select()
      .single()

    if (error) {
      console.error('Error al crear visita:', error)
      return NextResponse.json({ error: 'Error al crear visita' }, { status: 500 })
    }

    // Registrar en chatter del contacto
    registrarChatter({
      empresaId,
      entidadTipo: 'contacto',
      entidadId: body.contacto_id,
      contenido: `Nueva visita programada: ${motivo(body.motivo)}`,
      autorId: user.id,
      autorNombre: nombreCreador,
      metadata: {
        accion: 'creado',
        visita_id: data.id,
      },
    })

    // Registrar en chatter de cada entidad vinculada
    for (const vinculo of vinculos) {
      registrarChatter({
        empresaId,
        entidadTipo: vinculo.tipo,
        entidadId: vinculo.id,
        contenido: `Nueva visita programada para ${contactoNombre}`,
        autorId: user.id,
        autorNombre: nombreCreador,
        metadata: {
          accion: 'creado',
          visita_id: data.id,
        },
      })
    }

    // Notificar al asignado (si es otro usuario)
    if (data.asignado_a && data.asignado_a !== user.id) {
      crearNotificacion({
        empresaId,
        usuarioId: data.asignado_a,
        tipo: 'actividad_asignada',
        titulo: `📍 ${nombreCreador} te asignó una visita`,
        cuerpo: `${contactoNombre} · ${direccionTexto || 'Sin dirección'}`,
        icono: 'MapPin',
        color: COLOR_NOTIFICACION.info,
        url: '/visitas',
        referenciaTipo: 'visita',
        referenciaId: data.id,
      })
    }

    // Crear actividad + evento calendario vinculados
    const tipos = await obtenerTiposVisita(empresaId)
    if (tipos) {
      await crearRegistrosVinculados({
        id: data.id,
        empresa_id: empresaId,
        contacto_id: body.contacto_id,
        contacto_nombre: contactoNombre,
        direccion_texto: direccionTexto,
        asignado_a: body.asignado_a || null,
        asignado_nombre: body.asignado_nombre || null,
        fecha_programada: body.fecha_programada,
        duracion_estimada_min: body.duracion_estimada_min || config?.duracion_estimada_default || 30,
        estado: 'programada',
        motivo: body.motivo || null,
        prioridad: body.prioridad || 'normal',
        actividad_id: null,
        creado_por: user.id,
        creado_por_nombre: nombreCreador,
      }, tipos)
    }

    // Registrar en recientes
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'visita',
      entidadId: data.id,
      titulo: contactoNombre,
      subtitulo: 'programada',
      accion: 'creado',
    })

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Helper para el mensaje del chatter
function motivo(m: string | null | undefined): string {
  return m ? m : 'visita comercial'
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/inbox/conversaciones — Listar conversaciones con filtros.
 * Soporta: tipo_canal, estado, asignado_a, búsqueda, paginación.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permisos: determinar módulo según tipo_canal del query param
    const params = request.nextUrl.searchParams
    const tipo_canal = params.get('tipo_canal') // 'whatsapp', 'correo', 'interno'

    // Mapear tipo_canal al módulo de permisos correspondiente
    const moduloPorCanal = {
      whatsapp: 'inbox_whatsapp',
      correo: 'inbox_correo',
      interno: 'inbox_interno',
    } as const
    const moduloPermiso = tipo_canal
      ? moduloPorCanal[tipo_canal as keyof typeof moduloPorCanal]
      : null

    // Si hay tipo_canal específico, verificar permiso de ese módulo
    if (moduloPermiso) {
      const { permitido: verTodos } = await obtenerYVerificarPermiso(user.id, empresaId, moduloPermiso, 'ver_todos')
      if (!verTodos) {
        const { permitido: verPropio } = await obtenerYVerificarPermiso(user.id, empresaId, moduloPermiso, 'ver_propio')
        if (!verPropio) {
          return NextResponse.json({ error: 'Sin permiso para ver conversaciones de este canal' }, { status: 403 })
        }
      }
    }
    const estado = params.get('estado') // 'abierta', 'en_espera', 'resuelta', 'spam'
    const asignado_a = params.get('asignado_a') // usuario_id o 'sin_asignar'
    const canal_id = params.get('canal_id')
    const busqueda = params.get('busqueda') || ''
    const enviados = params.get('enviados') === 'true'
    const soloNoLeidos = params.get('no_leidos') === 'true'
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '500'), 500)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    let query = admin
      .from('conversaciones')
      .select(`
        *,
        canal:canales_inbox!canal_id(id, nombre, tipo, proveedor),
        contacto:contactos!contacto_id(id, es_provisorio)
      `, { count: 'exact' })
      .eq('empresa_id', empresaId)

    // Filtros
    if (tipo_canal) query = query.eq('tipo_canal', tipo_canal)
    if (estado) query = query.eq('estado', estado)
    if (canal_id) query = query.eq('canal_id', canal_id)
    const contacto_id = params.get('contacto_id')
    if (contacto_id) query = query.eq('contacto_id', contacto_id)

    // Filtro enviados: solo conversaciones donde el último mensaje es saliente
    if (enviados) {
      query = query.eq('ultimo_mensaje_es_entrante', false)
    }

    // Filtro no leídos: solo conversaciones con mensajes sin leer
    if (soloNoLeidos) {
      query = query.gt('mensajes_sin_leer', 0)
    }

    if (asignado_a === 'sin_asignar') {
      query = query.is('asignado_a', null)
    } else if (asignado_a) {
      query = query.eq('asignado_a', asignado_a)
    }

    // Filtro por etiqueta
    const etiqueta = params.get('etiqueta')
    if (etiqueta) {
      query = query.contains('etiquetas', [etiqueta])
    }

    // Filtro por fecha (desde/hasta)
    const desde_fecha = params.get('desde_fecha')
    const hasta_fecha = params.get('hasta_fecha')
    if (desde_fecha) {
      query = query.gte('ultimo_mensaje_en', desde_fecha)
    }
    if (hasta_fecha) {
      query = query.lte('ultimo_mensaje_en', hasta_fecha + 'T23:59:59')
    }

    // Búsqueda por nombre de contacto, asunto o cuerpo de mensajes
    if (busqueda) {
      query = query.or(`contacto_nombre.ilike.%${busqueda}%,asunto.ilike.%${busqueda}%,identificador_externo.ilike.%${busqueda}%,ultimo_mensaje_texto.ilike.%${busqueda}%`)
    }

    const { data, count, error } = await query
      .order('ultimo_mensaje_en', { ascending: false, nullsFirst: false })
      .range(desde, desde + por_pagina - 1)

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ conversaciones: [], total: 0 })
      }
      throw error
    }

    // Si búsqueda activa y pocos resultados, buscar también en cuerpo de mensajes
    let resultados = data || []
    if (busqueda && resultados.length < 5 && tipo_canal === 'correo') {
      const idsExistentes = new Set(resultados.map(c => c.id))
      const { data: mensajesMatch } = await admin
        .from('mensajes')
        .select('conversacion_id')
        .eq('empresa_id', empresaId)
        .or(`texto.ilike.%${busqueda}%,correo_asunto.ilike.%${busqueda}%,correo_de.ilike.%${busqueda}%`)
        .limit(20)

      if (mensajesMatch && mensajesMatch.length > 0) {
        const idsConv = [...new Set(
          mensajesMatch.map(m => m.conversacion_id).filter(id => !idsExistentes.has(id))
        )]
        if (idsConv.length > 0) {
          const { data: convsExtra } = await admin
            .from('conversaciones')
            .select(`*, canal:canales_inbox!canal_id(id, nombre, tipo, proveedor)`)
            .eq('empresa_id', empresaId)
            .in('id', idsConv.slice(0, 10))
            .order('ultimo_mensaje_en', { ascending: false, nullsFirst: false })

          if (convsExtra) {
            resultados = [...resultados, ...convsExtra]
          }
        }
      }
    }

    return NextResponse.json({ conversaciones: resultados, total: count || resultados.length })
  } catch (err) {
    console.error('Error al obtener conversaciones:', err)
    return NextResponse.json({ conversaciones: [], total: 0 })
  }
}

/**
 * POST /api/inbox/conversaciones — Crear nueva conversación.
 * Se usa al iniciar un chat, redactar un correo, o abrir conversación interna.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { canal_id, tipo_canal, contacto_id, contacto_nombre, asunto, identificador_externo, canal_interno_id } = body

    if (!canal_id || !tipo_canal) {
      return NextResponse.json({ error: 'canal_id y tipo_canal son requeridos' }, { status: 400 })
    }

    // Verificar permiso de enviar en el módulo correspondiente al canal
    const moduloPorCanal = {
      whatsapp: 'inbox_whatsapp',
      correo: 'inbox_correo',
      interno: 'inbox_interno',
    } as const
    const moduloPermiso = moduloPorCanal[tipo_canal as keyof typeof moduloPorCanal]
    if (moduloPermiso) {
      const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, moduloPermiso, 'enviar')
      if (!permitido) {
        return NextResponse.json({ error: 'Sin permiso para crear conversaciones en este canal' }, { status: 403 })
      }
    }

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('conversaciones')
      .insert({
        empresa_id: empresaId,
        canal_id,
        tipo_canal,
        contacto_id: contacto_id || null,
        contacto_nombre: contacto_nombre || null,
        asunto: asunto || null,
        identificador_externo: identificador_externo || null,
        canal_interno_id: canal_interno_id || null,
        estado: 'abierta',
        asignado_a: user.id,
        asignado_a_nombre: `${user.user_metadata?.nombre || ''} ${user.user_metadata?.apellido || ''}`.trim(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ conversacion: data }, { status: 201 })
  } catch (err) {
    console.error('Error al crear conversación:', err)
    return NextResponse.json({ error: 'Error al crear conversación' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { resolverCanales } from '@/lib/canales'
import { EstadosConversacion } from '@/tipos/conversacion'

/**
 * GET /api/inbox/conversaciones — Listar conversaciones con filtros.
 * Soporta: tipo_canal, estado, asignado_a, búsqueda, paginación.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
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

    // Si hay tipo_canal específico, verificar permiso de ese módulo (1 sola query).
    // Guardamos `soloPropio` para aplicar el filtro de visibilidad abajo.
    let soloPropio = false
    if (moduloPermiso) {
      const visibilidad = await verificarVisibilidad(user.id, empresaId, moduloPermiso)
      if (!visibilidad) {
        return NextResponse.json({ error: 'Sin permiso para ver conversaciones de este canal' }, { status: 403 })
      }
      soloPropio = visibilidad.soloPropio
    }
    const estado = params.get('estado') // 'abierta', 'en_espera', 'resuelta', 'spam'
    const asignado_a = params.get('asignado_a') // usuario_id o 'sin_asignar'
    const canal_id = params.get('canal_id')
    const busqueda = params.get('busqueda') || ''
    const enviados = params.get('enviados') === 'true'
    // Carpeta "Entrada": solo conversaciones que recibieron al menos un
    // mensaje del contacto. Las solo salientes (sin respuesta) quedan únicamente
    // en "Enviados".
    const soloRecibidos = params.get('solo_recibidos') === 'true'
    const soloNoLeidos = params.get('no_leidos') === 'true'
    // Pestañas Clientes/Empleados (solo aplica con tipo_canal=whatsapp).
    // 'clientes' → conversaciones sin miembro vinculado. 'empleados' → con miembro.
    const audiencia = params.get('audiencia')
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '500'), 500)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    let query = admin
      .from('conversaciones')
      .select(`
        *,
        contacto:contactos!contacto_id(id, nombre, apellido, correo, telefono, whatsapp, avatar_url, es_provisorio),
        etapa:etapas_conversacion!etapa_id(id, etiqueta, color, icono)
      `, { count: 'exact' })
      .eq('empresa_id', empresaId)

    // Filtros de papelera y bloqueadas (excluir por defecto)
    const mostrarPapelera = params.get('papelera') === 'true'
    const mostrarBloqueadas = params.get('bloqueadas') === 'true'
    if (!mostrarPapelera) query = query.eq('en_papelera', false)
    if (!mostrarBloqueadas) query = query.eq('bloqueada', false)

    // Visibilidad "ver_propio": solo conversaciones asignadas al usuario o
    // creadas por él. Se aplica cuando el rol no tiene `ver_todos` del canal.
    if (soloPropio) {
      query = query.or(`asignado_a.eq.${user.id},creado_por.eq.${user.id}`)
    }

    // Filtros
    if (tipo_canal) query = query.eq('tipo_canal', tipo_canal)
    if (estado) query = query.eq('estado', estado)
    if (canal_id) query = query.eq('canal_id', canal_id)

    // Pestaña Clientes/Empleados — separa la bandeja según haya miembro vinculado.
    if (audiencia === 'empleados') {
      query = query.not('miembro_id', 'is', null)
    } else if (audiencia === 'clientes') {
      query = query.is('miembro_id', null)
    }
    const contacto_id = params.get('contacto_id')
    if (contacto_id) query = query.eq('contacto_id', contacto_id)

    // Filtro enviados: solo conversaciones donde el último mensaje es saliente
    if (enviados) {
      query = query.eq('ultimo_mensaje_es_entrante', false)
    }

    // Filtro entrada: excluir conversaciones que solo tienen mensajes salientes
    // (hilos donde nunca respondió el contacto). Esos viven solo en "Enviados".
    if (soloRecibidos) {
      query = query.eq('tiene_mensaje_entrante', true)
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
    // Escapar caracteres especiales de ILIKE para prevenir inyección de wildcards
    const busquedaEscapada = busqueda ? busqueda.replace(/[\\%_]/g, '\\$&') : ''
    if (busqueda) {
      query = query.or(`contacto_nombre.ilike.%${busquedaEscapada}%,asunto.ilike.%${busquedaEscapada}%,identificador_externo.ilike.%${busquedaEscapada}%,ultimo_mensaje_texto.ilike.%${busquedaEscapada}%`)
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
        .or(`texto.ilike.%${busquedaEscapada}%,correo_asunto.ilike.%${busquedaEscapada}%,correo_de.ilike.%${busquedaEscapada}%`)
        .limit(20)

      if (mensajesMatch && mensajesMatch.length > 0) {
        const idsConv = [...new Set(
          mensajesMatch.map(m => m.conversacion_id).filter(id => !idsExistentes.has(id))
        )]
        if (idsConv.length > 0) {
          const { data: convsExtra } = await admin
            .from('conversaciones')
            .select('*')
            .eq('empresa_id', empresaId)
            .in('id', idsConv.slice(0, 10))
            .order('ultimo_mensaje_en', { ascending: false, nullsFirst: false })

          if (convsExtra) {
            resultados = [...resultados, ...convsExtra]
          }
        }
      }
    }

    // Resolver info de canal desde canales_correo/canales_whatsapp según tipo_canal
    const canalesMap = await resolverCanales(admin, resultados as Array<{ canal_id?: string; tipo_canal?: string }>)

    // Enriquecer con flags del usuario actual (fijada, silenciada, seguida)
    const convIds = resultados.map(c => c.id)
    if (convIds.length > 0) {
      // Visitas provisorias por contacto (indicador visual en la lista)
      const contactoIds = [...new Set(resultados.map(c => c.contacto_id).filter(Boolean))] as string[]
      const visitasProvisoriasSet = new Set<string>()
      if (contactoIds.length > 0) {
        const { data: visitasProv } = await admin
          .from('visitas')
          .select('contacto_id')
          .eq('empresa_id', empresaId)
          .eq('estado', 'provisoria')
          .eq('en_papelera', false)
          .in('contacto_id', contactoIds)
        for (const v of visitasProv || []) visitasProvisoriasSet.add(v.contacto_id)
      }

      const [pinsData, silenciosData, seguidoresData] = await Promise.all([
        admin.from('conversacion_pins').select('conversacion_id').eq('usuario_id', user.id).in('conversacion_id', convIds),
        admin.from('conversacion_silencios').select('conversacion_id').eq('usuario_id', user.id).in('conversacion_id', convIds),
        admin.from('conversacion_seguidores').select('conversacion_id').eq('usuario_id', user.id).in('conversacion_id', convIds),
      ])
      const pinsSet = new Set((pinsData.data || []).map(p => p.conversacion_id))
      const silenciosSet = new Set((silenciosData.data || []).map(s => s.conversacion_id))
      const seguidoresSet = new Set((seguidoresData.data || []).map(s => s.conversacion_id))

      // Agregar flags, aplanar etapa, y ordenar fijadas primero
      const conversacionesConFlags = resultados.map(c => {
        const etapaJoin = c.etapa as { id: string; etiqueta: string; color: string; icono: string | null } | null
        return {
          ...c,
          canal: c.canal_id ? canalesMap.get(c.canal_id) || null : null,
          etapa_etiqueta: etapaJoin?.etiqueta || null,
          etapa_color: etapaJoin?.color || null,
          tiene_visita_provisoria: c.contacto_id ? visitasProvisoriasSet.has(c.contacto_id) : false,
          _fijada: pinsSet.has(c.id),
          _silenciada: silenciosSet.has(c.id),
          _seguida: seguidoresSet.has(c.id),
        }
      })
      conversacionesConFlags.sort((a, b) => (b._fijada ? 1 : 0) - (a._fijada ? 1 : 0))

      return NextResponse.json({ conversaciones: conversacionesConFlags, total: count || resultados.length })
    }

    // Aplanar etapa para resultados sin pins
    const resultadosConEtapa = resultados.map(c => {
      const etapaJoin = c.etapa as { id: string; etiqueta: string; color: string; icono: string | null } | null
      return {
        ...c,
        canal: c.canal_id ? canalesMap.get(c.canal_id) || null : null,
        etapa_etiqueta: etapaJoin?.etiqueta || null,
        etapa_color: etapaJoin?.color || null,
      }
    })
    return NextResponse.json({ conversaciones: resultadosConEtapa, total: count || resultados.length })
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
    const { user } = await obtenerUsuarioRuta()
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

    // Verificar que el canal pertenezca a la empresa (buscar en la tabla del tipo correspondiente)
    const tablaCanal =
      tipo_canal === 'whatsapp' ? 'canales_whatsapp' :
      tipo_canal === 'correo' ? 'canales_correo' :
      tipo_canal === 'interno' ? 'canales_internos' :
      null
    if (!tablaCanal) {
      return NextResponse.json({ error: 'Tipo de canal no soportado' }, { status: 400 })
    }
    const { data: canalVerif } = await admin
      .from(tablaCanal)
      .select('id')
      .eq('id', canal_id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!canalVerif) {
      return NextResponse.json({ error: 'Canal no encontrado en esta empresa' }, { status: 404 })
    }

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
        estado: EstadosConversacion.ABIERTA,
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

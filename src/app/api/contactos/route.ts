import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { esEmailValido, esTelefonoValido, esUrlValida, esIdentificacionValida, sanitizarBusqueda, normalizarAcentos } from '@/lib/validaciones'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarError } from '@/lib/logger'
import { registrarReciente } from '@/lib/recientes'

/**
 * GET /api/contactos — Listar contactos de la empresa activa.
 * Soporta: búsqueda, filtros por tipo/activo/etiqueta, paginación, ordenamiento.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permisos de visibilidad con una sola query a BD
    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'contactos')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso para ver contactos' }, { status: 403 })
    const soloPropio = visibilidad.soloPropio

    const params = request.nextUrl.searchParams
    const busqueda = sanitizarBusqueda(params.get('busqueda') || '')
    const tipo = params.get('tipo') // clave del tipo de contacto
    const activo = params.get('activo')
    const en_papelera = params.get('en_papelera') === 'true'
    const etiqueta = params.get('etiqueta')
    const responsable_id = params.get('responsable_id')
    const vinculado_de = params.get('vinculado_de')
    const origen_filtro = params.get('origen_filtro')
    const condicion_iva = params.get('condicion_iva')
    const etapa_id = params.get('etapa_id')
    const orden_campo = params.get('orden_campo') || 'codigo'
    const orden_dir = params.get('orden_dir') === 'asc' ? true : false
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    // Query base: campos selectivos (sin datos_fiscales, notas, etc. innecesarios para la lista)
    let query = admin
      .from('contactos')
      .select(`
        id, codigo, nombre, apellido, correo, telefono, whatsapp, cargo, rubro,
        activo, es_provisorio, origen, etiquetas, moneda, idioma,
        tipo_identificacion, numero_identificacion, datos_fiscales,
        limite_credito, plazo_pago_cliente, plazo_pago_proveedor,
        rank_cliente, rank_proveedor, pais_fiscal, zona_horaria,
        notas, web, titulo,
        creado_por, editado_por, creado_en, actualizado_en,
        tipo_contacto:tipos_contacto!tipo_contacto_id(id, clave, etiqueta, icono, color),
        responsables:contacto_responsables(usuario_id),
        direcciones:contacto_direcciones(id, tipo, calle, numero, texto, ciudad, provincia, codigo_postal, es_principal),
        vinculaciones:contacto_vinculaciones!contacto_vinculaciones_contacto_id_fkey(puesto, vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(id, nombre, apellido, correo, telefono, whatsapp))
      `, { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', en_papelera)

    // Si solo tiene ver_propio, filtrar por contactos creados por él o asignados como responsable
    if (soloPropio) {
      const { data: responsableIds } = await admin
        .from('contacto_responsables')
        .select('contacto_id')
        .eq('usuario_id', user.id)
      const idsResponsable = (responsableIds || []).map(r => r.contacto_id)

      if (idsResponsable.length > 0) {
        query = query.or(`creado_por.eq.${user.id},id.in.(${idsResponsable.join(',')})`)
      } else {
        query = query.eq('creado_por', user.id)
      }
    }

    // Filtro por tipo (buscamos por clave del tipo)
    if (tipo) {
      const { data: tipoData } = await admin
        .from('tipos_contacto')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('clave', tipo)
        .single()
      if (tipoData) {
        query = query.eq('tipo_contacto_id', tipoData.id)
      }
    }

    // Filtro por activo
    if (activo !== null && activo !== undefined) {
      query = query.eq('activo', activo === 'true')
    }

    // Filtro por etiqueta
    if (etiqueta) {
      query = query.contains('etiquetas', [etiqueta])
    }

    // Filtro por responsable
    if (responsable_id) {
      const { data: contactoIds } = await admin
        .from('contacto_responsables')
        .select('contacto_id')
        .eq('usuario_id', responsable_id)
      if (contactoIds) {
        query = query.in('id', contactoIds.map(r => r.contacto_id))
      }
    }

    // Filtro por origen
    if (origen_filtro) {
      query = query.eq('origen', origen_filtro)
    }

    // Filtro por condición IVA (dentro de datos_fiscales jsonb)
    if (condicion_iva) {
      query = query.eq('datos_fiscales->>condicion_iva', condicion_iva)
    }

    // Filtro por etapa de conversación (busca contactos cuya última conversación tenga esa etapa)
    if (etapa_id) {
      const { data: convsConEtapa } = await admin
        .from('conversaciones')
        .select('contacto_id')
        .eq('empresa_id', empresaId)
        .eq('etapa_id', etapa_id)
        .not('contacto_id', 'is', null)
      const idsConEtapa = [...new Set((convsConEtapa || []).map(c => c.contacto_id).filter(Boolean))]
      if (idsConEtapa.length > 0) {
        query = query.in('id', idsConEtapa)
      } else {
        return NextResponse.json({ contactos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
      }
    }

    // Filtro por vinculaciones (directas e inversas)
    if (vinculado_de) {
      const [{ data: directas }, { data: inversas }] = await Promise.all([
        admin.from('contacto_vinculaciones').select('vinculado_id').eq('empresa_id', empresaId).eq('contacto_id', vinculado_de),
        admin.from('contacto_vinculaciones').select('contacto_id').eq('empresa_id', empresaId).eq('vinculado_id', vinculado_de),
      ])
      const ids = [
        ...(directas || []).map(v => v.vinculado_id),
        ...(inversas || []).map(v => v.contacto_id),
      ]
      if (ids.length > 0) {
        query = query.in('id', ids)
      } else {
        // Sin vinculaciones → devolver vacío
        return NextResponse.json({ contactos: [], total: 0 })
      }
    }

    // Búsqueda full-text + direcciones (normalizada sin acentos)
    if (busqueda.trim()) {
      const busquedaNorm = normalizarAcentos(busqueda)

      // Buscar en direcciones (calle, ciudad, provincia) para obtener IDs de contactos
      const { data: dirMatches } = await admin
        .from('contacto_direcciones')
        .select('contacto_id')
        .or(`calle.ilike.%${busquedaNorm}%,ciudad.ilike.%${busquedaNorm}%,provincia.ilike.%${busquedaNorm}%,barrio.ilike.%${busquedaNorm}%,texto.ilike.%${busquedaNorm}%`)

      const idsDirecciones = [...new Set((dirMatches || []).map(d => d.contacto_id))]

      if (busqueda.length <= 2) {
        const filtroTexto = `nombre.ilike.%${busquedaNorm}%,apellido.ilike.%${busquedaNorm}%,correo.ilike.%${busquedaNorm}%,codigo.ilike.%${busquedaNorm}%,telefono.ilike.%${busquedaNorm}%`
        if (idsDirecciones.length > 0) {
          query = query.or(`${filtroTexto},id.in.(${idsDirecciones.join(',')})`)
        } else {
          query = query.or(filtroTexto)
        }
      } else {
        const terminos = busquedaNorm.trim().split(/\s+/).map(t => `${t}:*`).join(' & ')
        if (idsDirecciones.length > 0) {
          query = query.or(`busqueda.fts(spanish_unaccent).${terminos},id.in.(${idsDirecciones.join(',')})`)
        } else {
          query = query.textSearch('busqueda', terminos, { config: 'spanish_unaccent' })
        }
      }
    }

    // Ordenamiento y paginación
    query = query
      .order(orden_campo, { ascending: orden_dir })
      .range(desde, desde + por_pagina - 1)

    const { data, error, count } = await query

    if (error) {
      registrarError(error, { ruta: '/api/contactos', accion: 'listar', empresaId })
      return NextResponse.json({ error: 'Error al obtener contactos' }, { status: 500 })
    }

    // Enriquecer con la última etapa de conversación por contacto (en paralelo con nada — ya tenemos data)
    const contactoIds = (data || []).map(c => c.id).filter(Boolean)
    const etapasPorContacto: Record<string, { etapa_etiqueta: string; etapa_color: string; tipo_canal: string }> = {}

    if (contactoIds.length > 0) {
      // Traer solo las conversaciones con etapa de los contactos de esta página
      const { data: convEtapas } = await admin
        .from('conversaciones')
        .select('contacto_id, tipo_canal, etapa:etapas_conversacion!etapa_id(etiqueta, color)')
        .in('contacto_id', contactoIds)
        .not('etapa_id', 'is', null)
        .order('ultimo_mensaje_en', { ascending: false })
        .limit(contactoIds.length * 2) // Máximo 2 conversaciones por contacto es suficiente

      if (convEtapas) {
        for (const conv of convEtapas) {
          if (!conv.contacto_id || etapasPorContacto[conv.contacto_id]) continue
          const etapa = conv.etapa as unknown as { etiqueta: string; color: string } | null
          if (etapa) {
            etapasPorContacto[conv.contacto_id] = {
              etapa_etiqueta: etapa.etiqueta,
              etapa_color: etapa.color,
              tipo_canal: conv.tipo_canal,
            }
          }
        }
      }
    }

    // Resolver nombres de creador/editor
    const idsUsuarios = [...new Set(
      (data || []).flatMap(c => [c.creado_por, c.editado_por]).filter(Boolean)
    )]
    const nombresMap = new Map<string, string>()
    if (idsUsuarios.length > 0) {
      const { data: perfiles } = await admin
        .from('perfiles')
        .select('id, nombre, apellido')
        .in('id', idsUsuarios)
      for (const p of (perfiles || [])) {
        nombresMap.set(p.id, `${p.nombre} ${p.apellido || ''}`.trim())
      }
    }

    let contactosConEtapa = (data || []).map(c => ({
      ...c,
      ultima_etapa: etapasPorContacto[c.id] || null,
      creador_nombre: c.creado_por ? (nombresMap.get(c.creado_por) || null) : null,
      editor_nombre: c.editado_por ? (nombresMap.get(c.editado_por) || null) : null,
    }))

    // Cuando hay búsqueda, re-ordenar por relevancia:
    // 1. Nombre empieza con el término → más relevante
    // 2. Nombre contiene el término → relevante
    // 3. Resto (matcheó por correo, teléfono, dirección, etc.)
    if (busqueda.trim()) {
      const busquedaNorm = normalizarAcentos(busqueda).toLowerCase()
      // Normalizar nombre igual que la búsqueda (& → espacio) para comparar relevancia
      const normNombre = (s: string) => normalizarAcentos(s).replace(/[&/(),]/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim()
      contactosConEtapa.sort((a, b) => {
        const na = normNombre((a.nombre || '') + ' ' + (a.apellido || ''))
        const nb = normNombre((b.nombre || '') + ' ' + (b.apellido || ''))
        const aEmpieza = na.startsWith(busquedaNorm) ? 0 : na.includes(busquedaNorm) ? 1 : 2
        const bEmpieza = nb.startsWith(busquedaNorm) ? 0 : nb.includes(busquedaNorm) ? 1 : 2
        return aEmpieza - bEmpieza
      })
    }

    return NextResponse.json({
      contactos: contactosConEtapa,
      total: count || 0,
      pagina,
      por_pagina,
      total_paginas: Math.ceil((count || 0) / por_pagina),
    })
  } catch (err) {
    registrarError(err, { ruta: '/api/contactos', accion: 'listar' })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/contactos — Crear un nuevo contacto.
 * Genera código secuencial, asigna creador como responsable y seguidor.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de crear contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'contactos', 'crear')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para crear contactos' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Validar tipo de contacto (acepta tipo_contacto_id o tipo_contacto_clave)
    let tipoContactoId = body.tipo_contacto_id
    if (!tipoContactoId && body.tipo_contacto_clave) {
      const { data: tipoPorClave } = await admin
        .from('tipos_contacto')
        .select('id')
        .eq('clave', body.tipo_contacto_clave)
        .eq('empresa_id', empresaId)
        .single()
      if (tipoPorClave) tipoContactoId = tipoPorClave.id
    }

    if (!tipoContactoId) {
      return NextResponse.json({ error: 'tipo_contacto_id o tipo_contacto_clave es obligatorio' }, { status: 400 })
    }

    const { data: tipoExiste } = await admin
      .from('tipos_contacto')
      .select('id, clave')
      .eq('id', tipoContactoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!tipoExiste) {
      return NextResponse.json({ error: 'Tipo de contacto no válido' }, { status: 400 })
    }

    // Validar nombre
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    // Validar al menos un dato de contacto (edificios necesitan nombre + dirección)
    const esEdificio = tipoExiste.clave === 'edificio'
    const tieneDireccion = !!(body.direccion?.calle?.trim() || body.direcciones?.some((d: { calle?: string }) => d.calle?.trim()))
    const tieneDatoContacto = !!(
      body.correo?.trim() ||
      body.telefono?.trim() ||
      body.whatsapp?.trim() ||
      tieneDireccion
    )
    if (esEdificio && !tieneDireccion && !body.es_provisorio) {
      return NextResponse.json({ error: 'Se requiere al menos una dirección para un edificio' }, { status: 400 })
    }
    if (!esEdificio && !tieneDatoContacto && !body.es_provisorio) {
      return NextResponse.json({ error: 'Se requiere al menos un email, teléfono, WhatsApp o dirección' }, { status: 400 })
    }

    // Validar formatos
    if (body.correo?.trim() && !esEmailValido(body.correo)) {
      return NextResponse.json({ error: 'Formato de email no válido' }, { status: 400 })
    }
    if (body.telefono?.trim() && !esTelefonoValido(body.telefono)) {
      return NextResponse.json({ error: 'Formato de teléfono no válido' }, { status: 400 })
    }
    if (body.whatsapp?.trim() && !esTelefonoValido(body.whatsapp)) {
      return NextResponse.json({ error: 'Formato de WhatsApp no válido' }, { status: 400 })
    }
    if (body.web?.trim() && !esUrlValida(body.web)) {
      return NextResponse.json({ error: 'Formato de URL no válido' }, { status: 400 })
    }
    if (body.numero_identificacion?.trim() && body.tipo_identificacion) {
      if (!esIdentificacionValida(body.tipo_identificacion, body.numero_identificacion)) {
        return NextResponse.json({ error: 'Formato de identificación no válido' }, { status: 400 })
      }
    }

    // Generar código secuencial atómico
    const { data: codigoData, error: codigoError } = await admin
      .rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'contacto' })

    if (codigoError || !codigoData) {
      console.error('Error al generar código:', codigoError)
      return NextResponse.json({ error: 'Error al generar código' }, { status: 500 })
    }

    // Detección de duplicados — todas las queries en paralelo
    if (!body.ignorar_duplicados) {
      const checksParalelos: PromiseLike<{ campo: string; duplicado: { id: string; nombre: string; codigo: string } | null }>[] = []

      if (body.numero_identificacion) {
        checksParalelos.push(
          admin.from('contactos').select('id, nombre, codigo').eq('empresa_id', empresaId)
            .eq('numero_identificacion', body.numero_identificacion).eq('en_papelera', false).maybeSingle()
            .then(({ data }) => ({ campo: 'identificación', duplicado: data }))
        )
      }
      if (body.correo) {
        checksParalelos.push(
          admin.from('contactos').select('id, nombre, codigo').eq('empresa_id', empresaId)
            .eq('correo', body.correo.toLowerCase().trim()).eq('en_papelera', false).maybeSingle()
            .then(({ data }) => ({ campo: 'correo', duplicado: data }))
        )
      }
      if (body.telefono?.trim()) {
        checksParalelos.push(
          admin.from('contactos').select('id, nombre, codigo').eq('empresa_id', empresaId)
            .eq('telefono', body.telefono.trim()).eq('en_papelera', false).maybeSingle()
            .then(({ data }) => ({ campo: 'telefono', duplicado: data }))
        )
      }
      if (body.whatsapp?.trim()) {
        checksParalelos.push(
          admin.from('contactos').select('id, nombre, codigo').eq('empresa_id', empresaId)
            .eq('whatsapp', body.whatsapp.trim()).eq('en_papelera', false).maybeSingle()
            .then(({ data }) => ({ campo: 'whatsapp', duplicado: data }))
        )
      }

      if (checksParalelos.length > 0) {
        const resultados = await Promise.all(checksParalelos)
        const encontrado = resultados.find(r => r.duplicado)
        if (encontrado?.duplicado) {
          return NextResponse.json({
            error: 'duplicado',
            duplicado: { id: encontrado.duplicado.id, nombre: encontrado.duplicado.nombre, codigo: encontrado.duplicado.codigo },
            mensaje: `Ya existe un contacto con ${encontrado.campo === 'identificación' ? 'esa' : 'ese'} ${encontrado.campo}: ${encontrado.duplicado.nombre} (${encontrado.duplicado.codigo})`,
            campo: encontrado.campo,
          }, { status: 409 })
        }
      }
    }

    // Construir el registro
    const nuevoContacto = {
      empresa_id: empresaId,
      tipo_contacto_id: tipoContactoId,
      codigo: codigoData as string,
      nombre: body.nombre.trim(),
      apellido: body.apellido?.trim() || null,
      titulo: body.titulo || null,
      correo: body.correo?.toLowerCase().trim() || null,
      telefono: body.telefono?.trim() || null,
      whatsapp: body.whatsapp?.trim() || null,
      web: body.web?.trim() || null,
      cargo: body.cargo?.trim() || null,
      rubro: body.rubro?.trim() || null,
      moneda: body.moneda || null,
      idioma: body.idioma || null,
      pais_fiscal: body.pais_fiscal || null,
      tipo_identificacion: body.tipo_identificacion || null,
      numero_identificacion: body.numero_identificacion?.trim() || null,
      datos_fiscales: body.datos_fiscales || {},
      etiquetas: body.etiquetas || [],
      notas: body.notas || null,
      origen: body.origen || 'manual',
      es_provisorio: body.es_provisorio || false,
      creado_por: user.id,
    }

    const { data: contacto, error: insertError } = await admin
      .from('contactos')
      .insert(nuevoContacto)
      .select(`
        *,
        tipo_contacto:tipos_contacto!tipo_contacto_id(id, clave, etiqueta, icono, color)
      `)
      .single()

    if (insertError) {
      console.error('Error al crear contacto:', insertError)
      return NextResponse.json({ error: 'Error al crear contacto' }, { status: 500 })
    }

    // Auto-asignar creador como responsable y seguidor
    await Promise.all([
      admin.from('contacto_responsables').insert({
        contacto_id: contacto.id,
        usuario_id: user.id,
      }),
      admin.from('contacto_seguidores').insert({
        contacto_id: contacto.id,
        usuario_id: user.id,
      }),
    ])

    // Crear dirección y vinculaciones en paralelo
    const insercionesExtra: PromiseLike<unknown>[] = []

    if (body.direccion) {
      insercionesExtra.push(
        admin.from('contacto_direcciones').insert({
          contacto_id: contacto.id,
          ...body.direccion,
        }).then()
      )
    }

    if (body.vinculaciones?.length) {
      const vinculaciones = body.vinculaciones.flatMap((v: { vinculado_id: string; tipo_relacion_id?: string; puesto?: string; recibe_documentos?: boolean }) => [
        {
          empresa_id: empresaId,
          contacto_id: contacto.id,
          vinculado_id: v.vinculado_id,
          tipo_relacion_id: v.tipo_relacion_id || null,
          puesto: v.puesto || null,
          recibe_documentos: v.recibe_documentos || false,
        },
        {
          empresa_id: empresaId,
          contacto_id: v.vinculado_id,
          vinculado_id: contacto.id,
          tipo_relacion_id: v.tipo_relacion_id || null,
          puesto: null,
          recibe_documentos: false,
        },
      ])
      insercionesExtra.push(
        admin.from('contacto_vinculaciones').insert(vinculaciones).then()
      )
    }

    if (insercionesExtra.length > 0) await Promise.all(insercionesExtra)

    // Registrar en historial de recientes (fire-and-forget)
    const tipoCtRaw = contacto.tipo_contacto as unknown
    const tipoCt = Array.isArray(tipoCtRaw) ? tipoCtRaw[0] : tipoCtRaw
    const tipoCtEtiqueta = tipoCt && typeof tipoCt === 'object' && 'etiqueta' in tipoCt ? (tipoCt as { etiqueta: string }).etiqueta : null
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'contacto',
      entidadId: contacto.id,
      titulo: [contacto.nombre, contacto.apellido].filter(Boolean).join(' ') || 'Sin nombre',
      subtitulo: tipoCtEtiqueta || undefined,
      accion: 'creado',
    })

    return NextResponse.json(contacto, { status: 201 })
  } catch (err) {
    registrarError(err, { ruta: '/api/contactos', accion: 'crear' })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

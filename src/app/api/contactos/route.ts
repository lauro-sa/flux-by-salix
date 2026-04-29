import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { esEmailValido, esUrlValida, esIdentificacionValida, sanitizarBusqueda, normalizarAcentos } from '@/lib/validaciones'
import { resolverListaDesdeBody } from '@/lib/contacto-telefonos'
import { inicioRangoFechaISO } from '@/lib/presets-fecha'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarError } from '@/lib/logger'
import { registrarReciente } from '@/lib/recientes'
import { enriquecerContactos } from '@/lib/enriquecer-contactos'

/**
 * GET /api/contactos — Listar contactos de la empresa activa.
 * Soporta: búsqueda, filtros por tipo/activo/etiqueta, paginación, ordenamiento.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permisos de visibilidad con una sola query a BD
    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'contactos')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso para ver contactos' }, { status: 403 })
    const soloPropio = visibilidad.soloPropio

    // Visibilidad de contactos vinculados a miembros (datos personales del equipo).
    // Solo visible si el caller tiene permiso 'usuarios.ver'. Excepción: tu propio
    // contacto vinculado siempre es visible aunque no tengas el permiso.
    // (El cliente admin se crea acá porque lo necesitamos también para esta query.)
    const adminTmp = crearClienteAdmin()
    const { permitido: puedeVerUsuarios } = await obtenerYVerificarPermiso(user.id, empresaId, 'usuarios', 'ver')
    let miMiembroIdParaVisibilidad: string | null = null
    if (!puedeVerUsuarios) {
      const { data: miMiembro } = await adminTmp
        .from('miembros')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .maybeSingle()
      miMiembroIdParaVisibilidad = miMiembro?.id || null
    }

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
    // Filtros nuevos ——
    // etiquetas_multi: multi-select de etiquetas (cualquiera coincide). Formato: csv.
    const etiquetas_multi = params.get('etiquetas_multi')?.split(',').filter(Boolean) || []
    // rubros: multi-select de rubros por nombre (cualquiera coincide). Formato: csv.
    const rubros_multi = params.get('rubros')?.split(',').filter(Boolean) || []
    // relaciones: multi-select de tipo_relacion_id en contacto_vinculaciones. Formato: csv.
    const relaciones_multi = params.get('relaciones')?.split(',').filter(Boolean) || []
    // tiene_canales: contactos con alguno/todos los canales indicados. Formato: csv (correo,telefono,whatsapp,direccion).
    const tiene_canales = params.get('tiene_canales')?.split(',').filter(Boolean) || []
    // presupuesto: 'con_aceptado' | 'sin_aceptado' — filtra por existencia de presupuesto aceptado del contacto.
    const presupuesto = params.get('presupuesto')
    // estado_presupuesto: csv de estados (borrador,enviado,aceptado,rechazado,vencido,cancelado) — filtra contactos con presupuestos en esos estados.
    const estado_presupuesto = params.get('estado_presupuesto')?.split(',').filter(Boolean) || []
    // actividades: 'con_pendientes' | 'sin_pendientes' — filtra por existencia de actividad pendiente del contacto.
    const actividades = params.get('actividades')
    // provincia / ciudad — filtra por match en alguna direccion del contacto.
    const provincia = params.get('provincia')
    const ciudad = params.get('ciudad')
    // creado_rango: 'hoy' | '7d' | '30d' | '90d' | 'este_ano'
    const creado_rango = params.get('creado_rango')
    // ultima_interaccion: '7d' | '30d' | 'dormidos_30' | 'dormidos_90'
    const ultima_interaccion = params.get('ultima_interaccion')
    const orden_campo = params.get('orden_campo') || 'codigo'
    const orden_dir = params.get('orden_dir') === 'asc' ? true : false
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    // Query base: campos selectivos (sin datos_fiscales, notas, etc. innecesarios para la lista).
    // telefono/whatsapp legacy se mantienen sincronizadas por trigger; telefonos[] es la lista
    // canónica nueva.
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
        direcciones:contacto_direcciones(id, tipo, calle, numero, texto, ciudad, provincia, codigo_postal, es_principal, origen),
        telefonos:contacto_telefonos(id, tipo, valor, es_whatsapp, es_principal, etiqueta, orden, origen),
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

    // Restringir contactos vinculados a miembros si no tiene permiso 'usuarios.ver'.
    // Excepción: tu propio contacto vinculado siempre visible.
    if (!puedeVerUsuarios) {
      if (miMiembroIdParaVisibilidad) {
        query = query.or(`miembro_id.is.null,miembro_id.eq.${miMiembroIdParaVisibilidad}`)
      } else {
        query = query.is('miembro_id', null)
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

    // Filtro por etiquetas múltiples (overlap — el contacto tiene al menos una de las etiquetas).
    if (etiquetas_multi.length > 0) {
      query = query.overlaps('etiquetas', etiquetas_multi)
    }

    // Filtro por rubros (multi) — coincide si contactos.rubro ∈ lista.
    if (rubros_multi.length > 0) {
      query = query.in('rubro', rubros_multi)
    }

    // Filtro por tipo de relación (multi) — contactos que participan en alguna
    // vinculación cuyo tipo_relacion_id ∈ lista (como origen o destino).
    if (relaciones_multi.length > 0) {
      const { data: vinc } = await admin
        .from('contacto_vinculaciones')
        .select('contacto_id, vinculado_id')
        .eq('empresa_id', empresaId)
        .in('tipo_relacion_id', relaciones_multi)
      const idsRelacion = [...new Set((vinc || []).flatMap(v => [v.contacto_id, v.vinculado_id]).filter(Boolean))]
      if (idsRelacion.length > 0) query = query.in('id', idsRelacion)
      else return NextResponse.json({ contactos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
    }

    // Filtro por canales disponibles — el contacto DEBE tener TODOS los canales marcados
    // (si marco correo+whatsapp, quiero contactos con ambos).
    if (tiene_canales.length > 0) {
      if (tiene_canales.includes('correo')) query = query.not('correo', 'is', null)
      if (tiene_canales.includes('telefono')) query = query.not('telefono', 'is', null)
      if (tiene_canales.includes('whatsapp')) query = query.not('whatsapp', 'is', null)
      if (tiene_canales.includes('direccion')) {
        // Ver si tiene al menos 1 dirección asociada a un contacto de la empresa activa.
        // Hacemos join implícito via contactos.empresa_id para evitar data leak entre empresas.
        const { data: conDireccion } = await admin
          .from('contacto_direcciones')
          .select('contacto_id, contactos!inner(empresa_id)')
          .eq('contactos.empresa_id', empresaId)
        const idsDir = [...new Set((conDireccion || []).map(d => d.contacto_id))]
        if (idsDir.length > 0) query = query.in('id', idsDir)
        else return NextResponse.json({ contactos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
      }
    }

    // Filtro por presupuesto aceptado (con_aceptado / sin_aceptado).
    if (presupuesto === 'con_aceptado') {
      const { data: conPresAcept } = await admin
        .from('presupuestos')
        .select('contacto_id')
        .eq('empresa_id', empresaId)
        .eq('estado', 'aceptado')
        .eq('en_papelera', false)
        .not('contacto_id', 'is', null)
      const ids = [...new Set((conPresAcept || []).map(p => p.contacto_id).filter(Boolean))]
      if (ids.length > 0) query = query.in('id', ids)
      else return NextResponse.json({ contactos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
    } else if (presupuesto === 'sin_aceptado') {
      const { data: conPresAcept } = await admin
        .from('presupuestos')
        .select('contacto_id')
        .eq('empresa_id', empresaId)
        .eq('estado', 'aceptado')
        .eq('en_papelera', false)
        .not('contacto_id', 'is', null)
      const ids = [...new Set((conPresAcept || []).map(p => p.contacto_id).filter(Boolean))]
      if (ids.length > 0) query = query.not('id', 'in', `(${ids.join(',')})`)
    }

    // Filtro por estado de presupuesto — contactos con presupuestos en los estados indicados.
    if (estado_presupuesto.length > 0) {
      const { data: conPres } = await admin
        .from('presupuestos')
        .select('contacto_id')
        .eq('empresa_id', empresaId)
        .in('estado', estado_presupuesto)
        .eq('en_papelera', false)
        .not('contacto_id', 'is', null)
      const ids = [...new Set((conPres || []).map(p => p.contacto_id).filter(Boolean))]
      if (ids.length > 0) query = query.in('id', ids)
      else return NextResponse.json({ contactos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
    }

    // Filtro por actividades pendientes (con_pendientes / sin_pendientes).
    // Las actividades usan vinculo_ids (text array) con GIN index.
    if (actividades === 'con_pendientes') {
      const { data: actPend } = await admin
        .from('actividades')
        .select('vinculo_ids')
        .eq('empresa_id', empresaId)
        .eq('estado_clave', 'pendiente')
        .eq('en_papelera', false)
      const idsContacto = [...new Set((actPend || []).flatMap(a => (a.vinculo_ids || []) as string[]))]
      if (idsContacto.length > 0) query = query.in('id', idsContacto)
      else return NextResponse.json({ contactos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
    } else if (actividades === 'sin_pendientes') {
      const { data: actPend } = await admin
        .from('actividades')
        .select('vinculo_ids')
        .eq('empresa_id', empresaId)
        .eq('estado_clave', 'pendiente')
        .eq('en_papelera', false)
      const idsContacto = [...new Set((actPend || []).flatMap(a => (a.vinculo_ids || []) as string[]))]
      if (idsContacto.length > 0) query = query.not('id', 'in', `(${idsContacto.join(',')})`)
    }

    // Filtro por provincia / ciudad (match en cualquier dirección del contacto, acotado a la empresa).
    if (provincia || ciudad) {
      let qDir = admin
        .from('contacto_direcciones')
        .select('contacto_id, contactos!inner(empresa_id)')
        .eq('contactos.empresa_id', empresaId)
      if (provincia) qDir = qDir.ilike('provincia', `%${provincia}%`)
      if (ciudad) qDir = qDir.ilike('ciudad', `%${ciudad}%`)
      const { data: dirs } = await qDir
      const idsUbic = [...new Set((dirs || []).map(d => d.contacto_id))]
      if (idsUbic.length > 0) query = query.in('id', idsUbic)
      else return NextResponse.json({ contactos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
    }

    // Filtro por rango de creación (ver src/lib/presets-fecha.ts)
    if (creado_rango) {
      const { data: emp } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
      const desdeISO = inicioRangoFechaISO(creado_rango, new Date(), (emp?.zona_horaria as string) || undefined)
      if (desdeISO) query = query.gte('creado_en', desdeISO)
    }

    // Filtro por última interacción — usa MAX(conversaciones.ultimo_mensaje_en) por contacto.
    // Para dormidos: contactos con última actividad ANTES de X días (o sin actividad).
    if (ultima_interaccion) {
      const ahora = Date.now()
      const MS_DIA = 24 * 60 * 60 * 1000
      const { data: ultimasConv } = await admin
        .from('conversaciones')
        .select('contacto_id, ultimo_mensaje_en')
        .eq('empresa_id', empresaId)
        .not('contacto_id', 'is', null)
        .not('ultimo_mensaje_en', 'is', null)
      // Map contacto_id -> timestamp más reciente
      const ultimaPorContacto = new Map<string, number>()
      for (const c of (ultimasConv || [])) {
        if (!c.contacto_id || !c.ultimo_mensaje_en) continue
        const ts = new Date(c.ultimo_mensaje_en).getTime()
        const prev = ultimaPorContacto.get(c.contacto_id) || 0
        if (ts > prev) ultimaPorContacto.set(c.contacto_id, ts)
      }
      if (ultima_interaccion === '7d' || ultima_interaccion === '30d') {
        const dias = ultima_interaccion === '7d' ? 7 : 30
        const limite = ahora - dias * MS_DIA
        const ids = [...ultimaPorContacto.entries()].filter(([, ts]) => ts >= limite).map(([id]) => id)
        if (ids.length > 0) query = query.in('id', ids)
        else return NextResponse.json({ contactos: [], total: 0, pagina, por_pagina, total_paginas: 0 })
      } else if (ultima_interaccion === 'dormidos_30' || ultima_interaccion === 'dormidos_90') {
        const dias = ultima_interaccion === 'dormidos_30' ? 30 : 90
        const limite = ahora - dias * MS_DIA
        // Dormidos = interacción anterior al límite, o contactos sin conversaciones activas
        const idsActivos = [...ultimaPorContacto.entries()].filter(([, ts]) => ts >= limite).map(([id]) => id)
        if (idsActivos.length > 0) query = query.not('id', 'in', `(${idsActivos.join(',')})`)
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

    // Búsqueda full-text + direcciones + teléfonos (normalizada sin acentos)
    if (busqueda.trim()) {
      const busquedaNorm = normalizarAcentos(busqueda)

      // Buscar en direcciones (calle, ciudad, provincia) para obtener IDs de contactos, acotado a la empresa.
      const { data: dirMatches } = await admin
        .from('contacto_direcciones')
        .select('contacto_id, contactos!inner(empresa_id)')
        .eq('contactos.empresa_id', empresaId)
        .or(`calle.ilike.%${busquedaNorm}%,ciudad.ilike.%${busquedaNorm}%,provincia.ilike.%${busquedaNorm}%,barrio.ilike.%${busquedaNorm}%,texto.ilike.%${busquedaNorm}%`)

      const idsDirecciones = [...new Set((dirMatches || []).map(d => d.contacto_id))]

      // Detectar si la búsqueda contiene dígitos (posible teléfono)
      const soloDigitos = busquedaNorm.replace(/\D/g, '')
      const pareceNumero = soloDigitos.length >= 3

      // Pre-query teléfonos: si parece un número, buscar fragmento en contacto_telefonos.valor.
      let idsTelefonos: string[] = []
      if (pareceNumero) {
        const { data: telMatches } = await admin
          .from('contacto_telefonos')
          .select('contacto_id')
          .eq('empresa_id', empresaId)
          .ilike('valor', `%${soloDigitos}%`)
          .limit(500)
        idsTelefonos = [...new Set((telMatches || []).map(t => t.contacto_id))]
      }

      const idsExtra = [...new Set([...idsDirecciones, ...idsTelefonos])]

      if (busqueda.length <= 2) {
        const filtroTexto = `nombre.ilike.%${busquedaNorm}%,apellido.ilike.%${busquedaNorm}%,correo.ilike.%${busquedaNorm}%,codigo.ilike.%${busquedaNorm}%`
        if (idsExtra.length > 0) {
          query = query.or(`${filtroTexto},id.in.(${idsExtra.join(',')})`)
        } else {
          query = query.or(filtroTexto)
        }
      } else {
        const terminos = busquedaNorm.trim().split(/\s+/).map(t => `${t}:*`).join(' & ')
        if (idsExtra.length > 0) {
          query = query.or(`busqueda.fts(spanish_unaccent).${terminos},id.in.(${idsExtra.join(',')})`)
        } else {
          query = query.or(`busqueda.fts(spanish_unaccent).${terminos}`)
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

    // Enriquecer con la última etapa, actividades activas agrupadas por tipo
    // y visitas programadas. La lógica vive en un helper compartido con el
    // SSR de page.tsx para que ambos devuelvan la misma forma de datos.
    const contactoIds = (data || []).map(c => c.id).filter(Boolean)
    const enriquecimiento = await enriquecerContactos(admin, empresaId, contactoIds)

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
      ...(enriquecimiento[c.id] ?? { ultima_etapa: null, actividades_activas: [], cantidad_visitas_activas: 0 }),
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
    const { user } = await obtenerUsuarioRuta()
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

    // Resolver lista de teléfonos: prioriza body.telefonos array, fallback a body.telefono/whatsapp legacy.
    // Normaliza cada valor, deduplica y garantiza un solo principal.
    const telefonosNorm = resolverListaDesdeBody(body)

    // Validar al menos un dato de contacto (edificios necesitan nombre + dirección)
    const esEdificio = tipoExiste.clave === 'edificio'
    const tieneDireccion = !!(body.direccion?.calle?.trim() || body.direcciones?.some((d: { calle?: string }) => d.calle?.trim()))
    const tieneDatoContacto = !!(
      body.correo?.trim() ||
      telefonosNorm.length > 0 ||
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

    // Detección de duplicados — checks en paralelo (identificación, correo, teléfonos)
    if (!body.ignorar_duplicados) {
      type ResultadoDup = { campo: string; duplicado: { id: string; nombre: string; codigo: string } | null }
      const checksParalelos: PromiseLike<ResultadoDup>[] = []

      if (body.numero_identificacion) {
        checksParalelos.push(
          admin.from('contactos').select('id, nombre, codigo').eq('empresa_id', empresaId)
            .eq('numero_identificacion', body.numero_identificacion).eq('en_papelera', false).maybeSingle()
            .then(({ data }): ResultadoDup => ({ campo: 'identificación', duplicado: data }))
        )
      }
      if (body.correo) {
        checksParalelos.push(
          admin.from('contactos').select('id, nombre, codigo').eq('empresa_id', empresaId)
            .eq('correo', body.correo.toLowerCase().trim()).eq('en_papelera', false).maybeSingle()
            .then(({ data }): ResultadoDup => ({ campo: 'correo', duplicado: data }))
        )
      }
      // Dedup por teléfonos: un solo check contra contacto_telefonos.valor IN (lista normalizada).
      // Cubre cualquier teléfono del contacto, no solo el principal — más estricto que el modelo legacy.
      if (telefonosNorm.length > 0) {
        const valores = telefonosNorm.map(t => t.valor)
        checksParalelos.push(
          admin.from('contacto_telefonos')
            .select('valor, contactos!inner(id, nombre, codigo, en_papelera)')
            .eq('empresa_id', empresaId)
            .in('valor', valores)
            .eq('contactos.en_papelera', false)
            .limit(1)
            .then(({ data }): ResultadoDup => {
              const fila = (data || [])[0]
              if (!fila) return { campo: 'teléfono', duplicado: null }
              const c = fila.contactos as unknown as { id: string; nombre: string; codigo: string }
              return { campo: 'teléfono', duplicado: { id: c.id, nombre: c.nombre, codigo: c.codigo } }
            })
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

    // Construir el registro. NO se incluyen telefono/whatsapp: el trigger de sync los rellena
    // automáticamente al insertar las filas en contacto_telefonos más abajo.
    const nuevoContacto = {
      empresa_id: empresaId,
      tipo_contacto_id: tipoContactoId,
      codigo: codigoData as string,
      nombre: body.nombre.trim(),
      apellido: body.apellido?.trim() || null,
      titulo: body.titulo || null,
      correo: body.correo?.toLowerCase().trim() || null,
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

    // Insertar la lista de teléfonos. El trigger sync_contacto_principal_telefonos
    // sincroniza contactos.telefono / contactos.whatsapp después de cada insert.
    if (telefonosNorm.length > 0) {
      const { error: telError } = await admin.from('contacto_telefonos').insert(
        telefonosNorm.map(t => ({
          empresa_id: empresaId,
          contacto_id: contacto.id,
          tipo: t.tipo,
          valor: t.valor,
          es_whatsapp: t.es_whatsapp,
          es_principal: t.es_principal,
          etiqueta: t.etiqueta,
          orden: t.orden,
          creado_por: user.id,
        }))
      )
      if (telError) {
        // Rollback: borrar el contacto recién creado para no dejar huérfanos sin teléfonos.
        await admin.from('contactos').delete().eq('id', contacto.id)
        registrarError(telError, { ruta: '/api/contactos', accion: 'crear_insertar_telefonos', empresaId })
        return NextResponse.json({ error: 'Error al guardar teléfonos del contacto' }, { status: 500 })
      }
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

    // Re-leer el contacto si se insertaron teléfonos: el trigger de sync actualizó
    // contactos.telefono / contactos.whatsapp, y queremos devolver esos valores
    // junto con la lista completa de teléfonos al cliente.
    let contactoFinal = contacto
    if (telefonosNorm.length > 0) {
      const { data: relectura } = await admin
        .from('contactos')
        .select(`
          *,
          tipo_contacto:tipos_contacto!tipo_contacto_id(id, clave, etiqueta, icono, color),
          telefonos:contacto_telefonos(id, tipo, valor, es_whatsapp, es_principal, etiqueta, orden, origen)
        `)
        .eq('id', contacto.id)
        .single()
      if (relectura) contactoFinal = relectura
    }

    // Registrar en historial de recientes (fire-and-forget)
    const tipoCtRaw = contactoFinal.tipo_contacto as unknown
    const tipoCt = Array.isArray(tipoCtRaw) ? tipoCtRaw[0] : tipoCtRaw
    const tipoCtEtiqueta = tipoCt && typeof tipoCt === 'object' && 'etiqueta' in tipoCt ? (tipoCt as { etiqueta: string }).etiqueta : null
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'contacto',
      entidadId: contactoFinal.id,
      titulo: [contactoFinal.nombre, contactoFinal.apellido].filter(Boolean).join(' ') || 'Sin nombre',
      subtitulo: tipoCtEtiqueta || undefined,
      accion: 'creado',
    })

    return NextResponse.json(contactoFinal, { status: 201 })
  } catch (err) {
    registrarError(err, { ruta: '/api/contactos', accion: 'crear' })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

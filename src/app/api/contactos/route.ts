import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { esEmailValido, esTelefonoValido, esUrlValida, esIdentificacionValida, sanitizarBusqueda } from '@/lib/validaciones'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { registrarError } from '@/lib/logger'

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
    const orden_campo = params.get('orden_campo') || 'creado_en'
    const orden_dir = params.get('orden_dir') === 'asc' ? true : false
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    // Query base con JOIN a tipo_contacto
    let query = admin
      .from('contactos')
      .select(`
        *,
        tipo_contacto:tipos_contacto!tipo_contacto_id(id, clave, etiqueta, icono, color),
        responsables:contacto_responsables(usuario_id),
        direcciones:contacto_direcciones(id, tipo, calle, texto, ciudad, provincia, es_principal),
        vinculaciones:contacto_vinculaciones!contacto_vinculaciones_contacto_id_fkey(puesto, vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(id, nombre, apellido, correo, telefono))
      `, { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('en_papelera', en_papelera)

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

    // Búsqueda full-text + direcciones
    if (busqueda.trim()) {
      // Buscar en direcciones (calle, ciudad, provincia) para obtener IDs de contactos
      const { data: dirMatches } = await admin
        .from('contacto_direcciones')
        .select('contacto_id')
        .or(`calle.ilike.%${busqueda}%,ciudad.ilike.%${busqueda}%,provincia.ilike.%${busqueda}%,barrio.ilike.%${busqueda}%,texto.ilike.%${busqueda}%`)

      const idsDirecciones = [...new Set((dirMatches || []).map(d => d.contacto_id))]

      if (busqueda.length <= 2) {
        const filtroTexto = `nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,correo.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`
        if (idsDirecciones.length > 0) {
          query = query.or(`${filtroTexto},id.in.(${idsDirecciones.join(',')})`)
        } else {
          query = query.or(filtroTexto)
        }
      } else {
        const terminos = busqueda.trim().split(/\s+/).map(t => `${t}:*`).join(' & ')
        if (idsDirecciones.length > 0) {
          // Combinar full-text con IDs de direcciones
          query = query.or(`busqueda.fts(spanish).${terminos},id.in.(${idsDirecciones.join(',')})`)
        } else {
          query = query.textSearch('busqueda', terminos, { config: 'spanish' })
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

    return NextResponse.json({
      contactos: data || [],
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
    console.log('[POST /api/contactos] Inicio')
    const supabase = await crearClienteServidor()
    console.log('[POST /api/contactos] Cliente servidor OK')
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[POST /api/contactos] getUser OK, user:', !!user)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de crear contactos
    console.log('[POST /api/contactos] Verificando permiso para', user.id, empresaId)
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'contactos', 'crear')
    console.log('[POST /api/contactos] Permiso:', permitido)
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para crear contactos' }, { status: 403 })

    const body = await request.json()
    console.log('[POST /api/contactos] Body OK, tipo:', body.tipo_contacto_id)
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
      .select('id')
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

    // Validar al menos un dato de contacto (se puede saltar con es_provisorio)
    const tieneDatoContacto = !!(
      body.correo?.trim() ||
      body.telefono?.trim() ||
      body.whatsapp?.trim() ||
      body.direccion?.calle?.trim() ||
      body.direcciones?.some((d: { calle?: string }) => d.calle?.trim())
    )
    if (!tieneDatoContacto && !body.es_provisorio) {
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

    // Detección de duplicados (por identificación o correo)
    if (body.numero_identificacion) {
      const { data: duplicado } = await admin
        .from('contactos')
        .select('id, nombre, codigo')
        .eq('empresa_id', empresaId)
        .eq('numero_identificacion', body.numero_identificacion)
        .eq('en_papelera', false)
        .maybeSingle()

      if (duplicado && !body.ignorar_duplicados) {
        return NextResponse.json({
          error: 'duplicado',
          duplicado: { id: duplicado.id, nombre: duplicado.nombre, codigo: duplicado.codigo },
          mensaje: `Ya existe un contacto con esa identificación: ${duplicado.nombre} (${duplicado.codigo})`,
        }, { status: 409 })
      }
    }

    if (body.correo) {
      const { data: duplicado } = await admin
        .from('contactos')
        .select('id, nombre, codigo')
        .eq('empresa_id', empresaId)
        .eq('correo', body.correo.toLowerCase().trim())
        .eq('en_papelera', false)
        .maybeSingle()

      if (duplicado && !body.ignorar_duplicados) {
        return NextResponse.json({
          error: 'duplicado',
          duplicado: { id: duplicado.id, nombre: duplicado.nombre, codigo: duplicado.codigo },
          mensaje: `Ya existe un contacto con ese correo: ${duplicado.nombre} (${duplicado.codigo})`,
        }, { status: 409 })
      }
    }

    // Duplicado por teléfono
    if (body.telefono?.trim()) {
      const { data: duplicado } = await admin
        .from('contactos')
        .select('id, nombre, codigo')
        .eq('empresa_id', empresaId)
        .eq('telefono', body.telefono.trim())
        .eq('en_papelera', false)
        .maybeSingle()

      if (duplicado && !body.ignorar_duplicados) {
        return NextResponse.json({
          error: 'duplicado',
          duplicado: { id: duplicado.id, nombre: duplicado.nombre, codigo: duplicado.codigo },
          mensaje: `Ya existe un contacto con ese teléfono: ${duplicado.nombre} (${duplicado.codigo})`,
          campo: 'telefono',
        }, { status: 409 })
      }
    }

    // Duplicado por WhatsApp
    if (body.whatsapp?.trim()) {
      const { data: duplicado } = await admin
        .from('contactos')
        .select('id, nombre, codigo')
        .eq('empresa_id', empresaId)
        .eq('whatsapp', body.whatsapp.trim())
        .eq('en_papelera', false)
        .maybeSingle()

      if (duplicado && !body.ignorar_duplicados) {
        return NextResponse.json({
          error: 'duplicado',
          duplicado: { id: duplicado.id, nombre: duplicado.nombre, codigo: duplicado.codigo },
          mensaje: `Ya existe un contacto con ese WhatsApp: ${duplicado.nombre} (${duplicado.codigo})`,
          campo: 'whatsapp',
        }, { status: 409 })
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

    // Crear dirección si se envió
    if (body.direccion) {
      await admin.from('contacto_direcciones').insert({
        contacto_id: contacto.id,
        ...body.direccion,
      })
    }

    // Crear vinculaciones si se enviaron
    if (body.vinculaciones?.length) {
      const vinculaciones = body.vinculaciones.flatMap((v: { vinculado_id: string; tipo_relacion_id?: string; puesto?: string; recibe_documentos?: boolean }) => [
        // A → B
        {
          empresa_id: empresaId,
          contacto_id: contacto.id,
          vinculado_id: v.vinculado_id,
          tipo_relacion_id: v.tipo_relacion_id || null,
          puesto: v.puesto || null,
          recibe_documentos: v.recibe_documentos || false,
        },
        // B → A (bidireccional)
        {
          empresa_id: empresaId,
          contacto_id: v.vinculado_id,
          vinculado_id: contacto.id,
          tipo_relacion_id: v.tipo_relacion_id || null,
          puesto: null, // el puesto inverso se define desde el otro lado
          recibe_documentos: false,
        },
      ])
      await admin.from('contacto_vinculaciones').insert(vinculaciones)
    }

    return NextResponse.json(contacto, { status: 201 })
  } catch (err) {
    registrarError(err, { ruta: '/api/contactos', accion: 'crear' })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

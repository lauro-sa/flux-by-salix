import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

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

    const params = request.nextUrl.searchParams
    const tipo_canal = params.get('tipo_canal') // 'whatsapp', 'correo', 'interno'
    const estado = params.get('estado') // 'abierta', 'en_espera', 'resuelta', 'spam'
    const asignado_a = params.get('asignado_a') // usuario_id o 'sin_asignar'
    const canal_id = params.get('canal_id')
    const busqueda = params.get('busqueda') || ''
    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '50'), 100)
    const desde = (pagina - 1) * por_pagina

    const admin = crearClienteAdmin()

    let query = admin
      .from('conversaciones')
      .select(`
        *,
        canal:canales_inbox!canal_id(id, nombre, tipo, proveedor)
      `, { count: 'exact' })
      .eq('empresa_id', empresaId)

    // Filtros
    if (tipo_canal) query = query.eq('tipo_canal', tipo_canal)
    if (estado) query = query.eq('estado', estado)
    if (canal_id) query = query.eq('canal_id', canal_id)

    if (asignado_a === 'sin_asignar') {
      query = query.is('asignado_a', null)
    } else if (asignado_a) {
      query = query.eq('asignado_a', asignado_a)
    }

    // Búsqueda por nombre de contacto o asunto
    if (busqueda) {
      query = query.or(`contacto_nombre.ilike.%${busqueda}%,asunto.ilike.%${busqueda}%,identificador_externo.ilike.%${busqueda}%`)
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
    return NextResponse.json({ conversaciones: data || [], total: count || 0 })
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

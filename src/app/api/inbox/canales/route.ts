import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { cifrar } from '@/lib/cifrado'

/**
 * GET /api/inbox/canales — Listar canales de la empresa.
 * Filtros opcionales: tipo ('whatsapp', 'correo', 'interno')
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de ver configuración del inbox (canales son parte de config)
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_inbox', 'ver')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso para ver canales' }, { status: 403 })
    }

    const tipo = request.nextUrl.searchParams.get('tipo')
    const admin = crearClienteAdmin()

    let query = admin
      .from('canales_inbox')
      .select(`
        *,
        agentes:canal_agentes(usuario_id, rol_canal)
      `)
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: true })

    if (tipo) query = query.eq('tipo', tipo)

    const { data, error } = await query
    if (error) {
      // Si la tabla no existe aún, devolver vacío
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ canales: [] })
      }
      throw error
    }

    return NextResponse.json({ canales: data || [] })
  } catch (err) {
    console.error('Error al obtener canales:', err)
    return NextResponse.json({ canales: [] })
  }
}

/**
 * POST /api/inbox/canales — Crear un nuevo canal.
 * Solo admins pueden crear canales.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de editar configuración del inbox (crear canales requiere editar)
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_inbox', 'editar')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso para crear canales' }, { status: 403 })
    }

    const body = await request.json()
    const { tipo, nombre, proveedor, config_conexion, agentes } = body

    // Cifrar password IMAP si existe
    if (config_conexion?.password_cifrada && typeof config_conexion.password_cifrada === 'string') {
      config_conexion.password_cifrada = cifrar(config_conexion.password_cifrada)
    }

    if (!tipo || !nombre) {
      return NextResponse.json({ error: 'tipo y nombre son requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el módulo esté activo
    const moduloKey = `inbox_${tipo}`
    const { data: modulo } = await admin
      .from('modulos_empresa')
      .select('activo')
      .eq('empresa_id', empresaId)
      .eq('modulo', moduloKey)
      .single()

    if (!modulo?.activo) {
      return NextResponse.json({ error: `El módulo ${tipo} no está activo para esta empresa` }, { status: 403 })
    }

    // Crear canal
    const { data: canal, error } = await admin
      .from('canales_inbox')
      .insert({
        empresa_id: empresaId,
        tipo,
        nombre,
        proveedor: proveedor || null,
        config_conexion: config_conexion || {},
        creado_por: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Asignar agentes si se proporcionan
    if (agentes && agentes.length > 0) {
      const agentesData = agentes.map((a: { usuario_id: string; rol_canal?: string }) => ({
        canal_id: canal.id,
        usuario_id: a.usuario_id,
        rol_canal: a.rol_canal || 'agente',
      }))
      await admin.from('canal_agentes').insert(agentesData)
    }

    return NextResponse.json({ canal }, { status: 201 })
  } catch (err) {
    console.error('Error al crear canal:', err)
    return NextResponse.json({ error: 'Error al crear canal' }, { status: 500 })
  }
}

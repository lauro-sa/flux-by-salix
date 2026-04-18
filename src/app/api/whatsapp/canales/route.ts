import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

// GET /api/whatsapp/canales — listar canales WhatsApp de la empresa
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_whatsapp', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const modulo = request.nextUrl.searchParams.get('modulo')
    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('canales_whatsapp')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: true })

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ canales: [] })
      }
      throw error
    }

    // Resolver agentes manualmente (canal_id es polimórfico, sin FK)
    let canales = data || []
    if (canales.length > 0) {
      const ids = canales.map(c => c.id)
      const { data: agentes } = await admin
        .from('canal_agentes')
        .select('canal_id, usuario_id, rol_canal')
        .in('canal_id', ids)
      const agentesPorCanal = new Map<string, Array<{ usuario_id: string; rol_canal: string }>>()
      for (const a of agentes || []) {
        const lista = agentesPorCanal.get(a.canal_id) || []
        lista.push({ usuario_id: a.usuario_id, rol_canal: a.rol_canal })
        agentesPorCanal.set(a.canal_id, lista)
      }
      canales = canales.map(c => ({ ...c, agentes: agentesPorCanal.get(c.id) || [] }))
    }
    if (modulo) {
      canales = canales.filter((c: { modulos_disponibles?: string[] }) => {
        const mods = c.modulos_disponibles || []
        return mods.length === 0 || mods.includes(modulo)
      })
    }

    const canalesConTipo = canales.map((c: Record<string, unknown>) => ({
      ...c,
      tipo: 'whatsapp',
    }))

    return NextResponse.json({ canales: canalesConTipo })
  } catch (err) {
    console.error('Error al obtener canales de WhatsApp:', err)
    return NextResponse.json({ canales: [] })
  }
}

// POST /api/whatsapp/canales — crear canal WhatsApp
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_whatsapp', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = await request.json()
    const { nombre, proveedor, config_conexion, agentes, modulos_disponibles } = body

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    const { data: modulo } = await admin
      .from('modulos_empresa')
      .select('activo')
      .eq('empresa_id', empresaId)
      .eq('modulo', 'inbox_whatsapp')
      .single()

    if (!modulo?.activo) {
      return NextResponse.json({ error: 'El módulo de WhatsApp no está activo' }, { status: 403 })
    }

    const { data: canal, error } = await admin
      .from('canales_whatsapp')
      .insert({
        empresa_id: empresaId,
        nombre,
        proveedor: proveedor || null,
        config_conexion: config_conexion || {},
        modulos_disponibles: Array.isArray(modulos_disponibles) ? modulos_disponibles : [],
        creado_por: user.id,
      })
      .select()
      .single()

    if (error) throw error

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
    console.error('Error al crear canal de WhatsApp:', err)
    return NextResponse.json({ error: 'Error al crear canal' }, { status: 500 })
  }
}

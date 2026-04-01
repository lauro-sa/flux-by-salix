import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/inbox/internos — Listar canales internos del usuario.
 * Incluye: canales públicos + privados donde es miembro + DMs.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de ver canales internos
    const { permitido: verTodos } = await obtenerYVerificarPermiso(user.id, empresaId, 'inbox_interno', 'ver_todos')
    if (!verTodos) {
      const { permitido: verPropio } = await obtenerYVerificarPermiso(user.id, empresaId, 'inbox_interno', 'ver_propio')
      if (!verPropio) {
        return NextResponse.json({ error: 'Sin permiso para ver canales internos' }, { status: 403 })
      }
    }

    const admin = crearClienteAdmin()

    // Canales públicos de la empresa
    const { data: publicos } = await admin
      .from('canales_internos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'publico')
      .eq('archivado', false)
      .order('nombre')

    // Canales donde el usuario es miembro (privados + DMs)
    const { data: membresiaIds } = await admin
      .from('canal_interno_miembros')
      .select('canal_id')
      .eq('usuario_id', user.id)

    let privados: typeof publicos = []
    if (membresiaIds && membresiaIds.length > 0) {
      const { data } = await admin
        .from('canales_internos')
        .select('*')
        .eq('empresa_id', empresaId)
        .in('id', membresiaIds.map(m => m.canal_id))
        .neq('tipo', 'publico')
        .eq('archivado', false)
        .order('ultimo_mensaje_en', { ascending: false, nullsFirst: false })

      privados = data || []
    }

    return NextResponse.json({
      canales: publicos || [],
      privados: privados || [],
    })
  } catch (err) {
    console.error('Error al obtener canales internos:', err)
    return NextResponse.json({ error: 'Error al obtener canales internos' }, { status: 500 })
  }
}

/**
 * POST /api/inbox/internos — Crear canal interno.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de enviar (crear canales internos requiere permiso de enviar)
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'inbox_interno', 'enviar')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso para crear canales internos' }, { status: 403 })
    }

    const body = await request.json()
    const { nombre, descripcion, tipo = 'publico', icono, color, miembros = [] } = body

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Para DMs, verificar si ya existe entre estos dos usuarios
    if (tipo === 'directo' && miembros.length === 1) {
      const participantes = [user.id, miembros[0]].sort()
      const { data: existente } = await admin
        .from('canales_internos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'directo')
        .contains('participantes_dm', participantes)
        .single()

      if (existente) {
        return NextResponse.json({ canal: existente })
      }
    }

    // Crear canal
    const participantes_dm = tipo === 'directo'
      ? [user.id, ...(miembros || [])].sort()
      : null

    const { data: canal, error } = await admin
      .from('canales_internos')
      .insert({
        empresa_id: empresaId,
        nombre,
        descripcion: descripcion || null,
        tipo,
        icono: icono || null,
        color: color || null,
        participantes_dm,
        creado_por: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Agregar creador como admin del canal
    const miembrosData = [
      { canal_id: canal.id, usuario_id: user.id, rol: 'admin' },
      ...(miembros || []).map((uid: string) => ({
        canal_id: canal.id,
        usuario_id: uid,
        rol: 'miembro',
      })),
    ]
    await admin.from('canal_interno_miembros').insert(miembrosData)

    return NextResponse.json({ canal }, { status: 201 })
  } catch (err) {
    console.error('Error al crear canal interno:', err)
    return NextResponse.json({ error: 'Error al crear canal interno' }, { status: 500 })
  }
}

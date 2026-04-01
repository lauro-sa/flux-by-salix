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

    // Obtener membresías del usuario (para filtrar canales y obtener silenciado)
    const { data: membresias } = await admin
      .from('canal_interno_miembros')
      .select('canal_id, silenciado')
      .eq('usuario_id', user.id)

    const membresiaMap = new Map((membresias || []).map(m => [m.canal_id, m]))
    const membresiaIds = (membresias || []).map(m => m.canal_id)

    // Canales públicos de la empresa
    const { data: publicos } = await admin
      .from('canales_internos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'publico')
      .eq('archivado', false)
      .order('nombre')

    // Canales donde el usuario es miembro (privados + grupos + DMs)
    let privados: typeof publicos = []
    let grupos: typeof publicos = []
    if (membresiaIds.length > 0) {
      const { data } = await admin
        .from('canales_internos')
        .select('*')
        .eq('empresa_id', empresaId)
        .in('id', membresiaIds)
        .neq('tipo', 'publico')
        .eq('archivado', false)
        .order('ultimo_mensaje_en', { ascending: false, nullsFirst: false })

      // Separar grupos de privados/DMs
      for (const canal of data || []) {
        if (canal.tipo === 'grupo') grupos.push(canal)
        else privados.push(canal)
      }
    }

    // Inyectar silenciado a cada canal
    const inyectarSilenciado = (canales: typeof publicos) =>
      (canales || []).map(c => ({ ...c, silenciado: membresiaMap.get(c.id)?.silenciado ?? false }))

    return NextResponse.json({
      canales: inyectarSilenciado(publicos),
      grupos: inyectarSilenciado(grupos),
      privados: inyectarSilenciado(privados),
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
    const { nombre, descripcion, tipo = 'publico', icono, color, miembros = [], sector_ids = [] } = body

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

    // Expandir sectores a usuario_ids
    let todosLosIds = new Set<string>(miembros)
    if (sector_ids.length > 0) {
      const { data: miembrosSector } = await admin
        .from('miembros_sectores')
        .select('miembro_id')
        .in('sector_id', sector_ids)

      if (miembrosSector && miembrosSector.length > 0) {
        const { data: miembrosEmpresa } = await admin
          .from('miembros')
          .select('usuario_id')
          .in('id', miembrosSector.map(ms => ms.miembro_id))
          .eq('empresa_id', empresaId)
          .eq('activo', true)

        for (const m of miembrosEmpresa || []) {
          todosLosIds.add(m.usuario_id)
        }
      }
    }
    // Quitar al creador del set (se agrega como admin aparte)
    todosLosIds.delete(user.id)

    // Agregar creador como admin + miembros
    const miembrosData = [
      { canal_id: canal.id, usuario_id: user.id, rol: 'admin' },
      ...[...todosLosIds].map((uid: string) => ({
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

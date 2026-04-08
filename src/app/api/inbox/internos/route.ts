import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'

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

    // Verificar permiso de ver canales internos (1 sola query)
    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'inbox_interno')
    if (!visibilidad) {
      return NextResponse.json({ error: 'Sin permiso para ver canales internos' }, { status: 403 })
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

    // Para DMs: resolver el nombre del OTRO participante
    const dmCanales = privados?.filter(c => c.tipo === 'directo') || []
    const otrosIds = new Set<string>()
    for (const dm of dmCanales) {
      const participantes = (dm.participantes_dm || []) as string[]
      for (const pid of participantes) {
        if (pid !== user.id) otrosIds.add(pid)
      }
    }

    let perfilesMap = new Map<string, { nombre: string; apellido: string }>()
    if (otrosIds.size > 0) {
      const { data: perfiles } = await admin
        .from('perfiles')
        .select('id, nombre, apellido')
        .in('id', [...otrosIds])
      for (const p of perfiles || []) {
        perfilesMap.set(p.id, { nombre: p.nombre || '', apellido: p.apellido || '' })
      }
    }

    // Inyectar silenciado + nombre correcto para DMs
    const inyectarExtras = (canales: typeof publicos) =>
      (canales || []).map(c => {
        const extras: Record<string, unknown> = { silenciado: membresiaMap.get(c.id)?.silenciado ?? false }
        // Para DMs: mostrar el nombre del OTRO participante
        if (c.tipo === 'directo' && c.participantes_dm) {
          const otroId = (c.participantes_dm as string[]).find(pid => pid !== user.id)
          if (otroId && perfilesMap.has(otroId)) {
            const perfil = perfilesMap.get(otroId)!
            extras.nombre = `${perfil.nombre} ${perfil.apellido}`.trim()
          }
        }
        return { ...c, ...extras }
      })

    return NextResponse.json({
      canales: inyectarExtras(publicos),
      grupos: inyectarExtras(grupos),
      privados: inyectarExtras(privados),
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
      // Buscar DM existente que contenga AMBOS participantes
      const { data: candidatos } = await admin
        .from('canales_internos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'directo')
        .contains('participantes_dm', participantes)

      // Verificar igualdad exacta (contains solo chequea inclusión)
      const existente = (candidatos || []).find(c => {
        const dm = ((c.participantes_dm || []) as string[]).sort()
        return dm.length === participantes.length && dm.every((v, i) => v === participantes[i])
      })

      if (existente) {
        // Si el DM estaba archivado, desarchivarlo al reabrir
        if (existente.archivado) {
          await admin
            .from('canales_internos')
            .update({ archivado: false, actualizado_en: new Date().toISOString() })
            .eq('id', existente.id)
          // También reabrir la conversación asociada
          await admin
            .from('conversaciones')
            .update({ estado: 'abierta', actualizado_en: new Date().toISOString() })
            .eq('canal_interno_id', existente.id)
          existente.archivado = false
        }
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

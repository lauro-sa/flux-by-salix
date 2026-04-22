import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/internos/[id]/miembros — Listar miembros del canal.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('inbox_interno', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Verificar que el canal pertenece a la empresa
    const { data: canal } = await admin
      .from('canales_internos')
      .select('id, empresa_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    // Listar miembros con datos del perfil
    const { data: miembros } = await admin
      .from('canal_interno_miembros')
      .select('canal_id, usuario_id, rol, silenciado, ultimo_leido_en, unido_en')
      .eq('canal_id', id)

    // Obtener perfiles de los miembros
    if (miembros && miembros.length > 0) {
      const ids = miembros.map(m => m.usuario_id)
      const { data: perfiles } = await admin
        .from('perfiles')
        .select('id, nombre, apellido, avatar_url')
        .in('id', ids)

      const perfilMap = new Map((perfiles || []).map(p => [p.id, p]))
      const resultado = miembros.map(m => ({
        ...m,
        nombre: perfilMap.get(m.usuario_id)?.nombre || '',
        apellido: perfilMap.get(m.usuario_id)?.apellido || '',
        avatar_url: perfilMap.get(m.usuario_id)?.avatar_url || null,
      }))

      return NextResponse.json({ miembros: resultado })
    }

    return NextResponse.json({ miembros: [] })
  } catch (err) {
    console.error('Error al listar miembros:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/inbox/internos/[id]/miembros — Agregar miembros al canal.
 * Body: { usuario_ids?: string[], sector_ids?: string[] }
 * Solo admins del canal pueden agregar miembros.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('inbox_interno', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    // Verificar canal y que el usuario es admin
    const { data: canal } = await admin
      .from('canales_internos')
      .select('id, tipo, empresa_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const { data: miembroActual } = await admin
      .from('canal_interno_miembros')
      .select('rol')
      .eq('canal_id', id)
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (miembroActual?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden agregar miembros' }, { status: 403 })
    }

    const body = await request.json()
    const { usuario_ids = [], sector_ids = [] } = body

    // Expandir sectores a usuario_ids
    let idsFinales = new Set<string>(usuario_ids)

    if (sector_ids.length > 0) {
      // miembros_sectores → miembros.usuario_id
      const { data: miembrosSector } = await admin
        .from('miembros_sectores')
        .select('miembro_id')
        .in('sector_id', sector_ids)

      if (miembrosSector && miembrosSector.length > 0) {
        const miembroIds = miembrosSector.map(ms => ms.miembro_id)
        const { data: miembrosEmpresa } = await admin
          .from('miembros')
          .select('usuario_id')
          .in('id', miembroIds)
          .eq('empresa_id', empresaId)
          .eq('activo', true)

        for (const m of miembrosEmpresa || []) {
          idsFinales.add(m.usuario_id)
        }
      }
    }

    // Obtener miembros existentes para no duplicar
    const { data: existentes } = await admin
      .from('canal_interno_miembros')
      .select('usuario_id')
      .eq('canal_id', id)

    const existentesSet = new Set((existentes || []).map(e => e.usuario_id))
    const nuevos = [...idsFinales].filter(uid => !existentesSet.has(uid))

    if (nuevos.length > 0) {
      await admin.from('canal_interno_miembros').insert(
        nuevos.map(uid => ({
          canal_id: id,
          usuario_id: uid,
          rol: 'miembro' as const,
        }))
      )

      // Notificar a los nuevos miembros
      try {
        const { crearNotificacionesBatch } = await import('@/lib/notificaciones')
        const { data: canalInfo } = await admin
          .from('canales_internos')
          .select('nombre')
          .eq('id', id)
          .single()

        await crearNotificacionesBatch(
          nuevos.map(uid => ({
            empresaId,
            usuarioId: uid,
            tipo: 'mensaje_interno',
            titulo: `💬 Te agregaron a un canal`,
            cuerpo: `Mensaje · ${canalInfo?.nombre || 'Canal'} · Ya podés enviar y recibir mensajes`,
            icono: 'Hash',
            color: 'var(--canal-interno)',
            url: '/inbox?tab=interno',
            referenciaTipo: 'conversacion',
            referenciaId: id,
          }))
        )
      } catch { /* no bloquear */ }
    }

    return NextResponse.json({ agregados: nuevos.length })
  } catch (err) {
    console.error('Error al agregar miembros:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/internos/[id]/miembros — Salir o quitar miembro del canal.
 * Body: { usuario_id?: string }
 * - Sin usuario_id: el usuario actual sale (solo grupos)
 * - Con usuario_id: admin quita a otro miembro
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('inbox_interno', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const { data: canal } = await admin
      .from('canales_internos')
      .select('id, tipo')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const usuarioObjetivo = body.usuario_id || user.id
    const esSalirPropio = usuarioObjetivo === user.id

    if (esSalirPropio) {
      // Salir del canal: solo permitido en grupos
      if (canal.tipo !== 'grupo') {
        return NextResponse.json({
          error: canal.tipo === 'directo'
            ? 'No podés salir de un mensaje directo'
            : 'No podés salir de un canal administrado',
        }, { status: 400 })
      }
    } else {
      // Quitar a otro: solo admins
      const { data: miembroActual } = await admin
        .from('canal_interno_miembros')
        .select('rol')
        .eq('canal_id', id)
        .eq('usuario_id', user.id)
        .maybeSingle()

      if (miembroActual?.rol !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden quitar miembros' }, { status: 403 })
      }
    }

    await admin
      .from('canal_interno_miembros')
      .delete()
      .eq('canal_id', id)
      .eq('usuario_id', usuarioObjetivo)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al gestionar miembro:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

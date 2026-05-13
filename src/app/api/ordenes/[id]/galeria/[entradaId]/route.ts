import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { resolverPermisosGaleriaOT } from '@/lib/permisos-galeria-ot'
import type { AdjuntoChatter, MetadataChatter, SubtipoChatter } from '@/tipos/chatter'

/**
 * Editar / eliminar una entrada de galería de OT.
 *
 * Permisos:
 *   - subtipo='relevamiento' → solo `puedeGestionar` puede editar o
 *     eliminar (cualquier entrada). Los asignados sin gestión no tocan
 *     el relevamiento de la visita.
 *   - subtipo='bitacora'     → autor propio O `puedeGestionar`.
 */

async function cargarEntrada(
  admin: ReturnType<typeof crearClienteAdmin>,
  empresaId: string,
  ordenId: string,
  entradaId: string,
) {
  const { data } = await admin
    .from('chatter')
    .select('id, entidad_tipo, entidad_id, autor_id, contenido, adjuntos, metadata')
    .eq('id', entradaId)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!data) return null
  // Sanity check: la entrada tiene que pertenecer a la OT del path.
  if (data.entidad_tipo !== 'orden_trabajo' || data.entidad_id !== ordenId) return null

  const meta = (data.metadata ?? {}) as MetadataChatter
  const subtipo = (meta.subtipo ?? null) as SubtipoChatter | null
  if (subtipo !== 'relevamiento' && subtipo !== 'bitacora') return null

  return { ...data, subtipo, metadata: meta }
}

function autorizadoEditar(
  subtipo: SubtipoChatter,
  permisos: Awaited<ReturnType<typeof resolverPermisosGaleriaOT>>,
  autorEntrada: string | null,
  usuarioId: string,
): boolean {
  if (subtipo === 'relevamiento') {
    return permisos.puedeGestionar
  }
  // bitacora: el autor o un gestor.
  return permisos.puedeGestionar || autorEntrada === usuarioId
}

/**
 * PATCH /api/ordenes/[id]/galeria/[entradaId]
 * Body: { contenido?, adjuntos? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entradaId: string }> },
) {
  try {
    const { id: ordenId, entradaId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const [entrada, permisos] = await Promise.all([
      cargarEntrada(admin, empresaId, ordenId, entradaId),
      resolverPermisosGaleriaOT(admin, user, empresaId, ordenId),
    ])

    if (!permisos.orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    if (!entrada) return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })

    if (!autorizadoEditar(entrada.subtipo!, permisos, entrada.autor_id, user.id)) {
      return NextResponse.json({ error: 'Sin permiso para editar esta entrada' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {
      editado_en: new Date().toISOString(),
    }

    if (typeof body.contenido === 'string') {
      updates.contenido = body.contenido.trim()
    }
    if (Array.isArray(body.adjuntos)) {
      updates.adjuntos = body.adjuntos as AdjuntoChatter[]
    }

    // Si después de aplicar updates queda todo vacío, rechazamos.
    const contenidoFinal = (updates.contenido as string | undefined) ?? entrada.contenido ?? ''
    const adjuntosFinal = (updates.adjuntos as AdjuntoChatter[] | undefined) ?? (entrada.adjuntos as AdjuntoChatter[] | null) ?? []
    if (contenidoFinal.trim().length === 0 && adjuntosFinal.length === 0) {
      return NextResponse.json({ error: 'No se puede dejar la entrada vacía' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('chatter')
      .update(updates)
      .eq('id', entradaId)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) {
      console.error('[galeria-ot PATCH] error:', error)
      return NextResponse.json({ error: 'Error al editar' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[galeria-ot PATCH] error interno:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/ordenes/[id]/galeria/[entradaId]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entradaId: string }> },
) {
  try {
    const { id: ordenId, entradaId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const [entrada, permisos] = await Promise.all([
      cargarEntrada(admin, empresaId, ordenId, entradaId),
      resolverPermisosGaleriaOT(admin, user, empresaId, ordenId),
    ])

    if (!permisos.orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    if (!entrada) return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })

    if (!autorizadoEditar(entrada.subtipo!, permisos, entrada.autor_id, user.id)) {
      return NextResponse.json({ error: 'Sin permiso para eliminar esta entrada' }, { status: 403 })
    }

    const { error } = await admin
      .from('chatter')
      .delete()
      .eq('id', entradaId)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('[galeria-ot DELETE] error:', error)
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[galeria-ot DELETE] error interno:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

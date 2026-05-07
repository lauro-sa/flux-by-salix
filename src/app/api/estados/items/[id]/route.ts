import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { TABLA_ESTADOS_POR_ENTIDAD } from '@/lib/estados/mapeo'
import { esEntidadConEstado, esGrupoEstado } from '@/tipos/estados'

/**
 * PATCH /api/estados/items/[id]?entidad_tipo=X — Editar un estado propio.
 *
 * Body: { etiqueta?, grupo?, icono?, color?, orden?, activo? }
 *
 * Solo se pueden editar estados PROPIOS de la empresa actual (no los del
 * sistema). Las RLS policies bloquean updates a estados con `es_sistema=true`,
 * pero igual hacemos el check explícito acá para devolver mejor mensaje.
 *
 * NO se permite editar `clave` ni `es_sistema` (campos inmutables después
 * del INSERT, para no romper referencias en datos existentes).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const entidadTipo = request.nextUrl.searchParams.get('entidad_tipo')
    if (!entidadTipo || !esEntidadConEstado(entidadTipo)) {
      return NextResponse.json({ error: `entidad_tipo inválida: "${entidadTipo}"` }, { status: 400 })
    }
    const tabla = TABLA_ESTADOS_POR_ENTIDAD[entidadTipo]
    if (!tabla) {
      return NextResponse.json({ error: `Entidad "${entidadTipo}" no soportada todavía` }, { status: 400 })
    }

    const body = await request.json()
    const cambios: Record<string, unknown> = {}

    if (body.etiqueta !== undefined) {
      if (typeof body.etiqueta !== 'string' || !body.etiqueta.trim()) {
        return NextResponse.json({ error: 'etiqueta inválida' }, { status: 400 })
      }
      cambios.etiqueta = body.etiqueta.trim()
    }
    if (body.grupo !== undefined) {
      if (!esGrupoEstado(body.grupo)) {
        return NextResponse.json({ error: 'grupo inválido' }, { status: 400 })
      }
      cambios.grupo = body.grupo
    }
    if (body.icono !== undefined) cambios.icono = body.icono
    if (body.color !== undefined) cambios.color = body.color
    if (typeof body.orden === 'number') cambios.orden = body.orden
    if (typeof body.activo === 'boolean') cambios.activo = body.activo

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: 'Sin cambios para aplicar' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Validar que el estado es propio (no del sistema) y de la empresa actual.
    const { data: actual } = await admin
      .from(tabla)
      .select('id, empresa_id, es_sistema')
      .eq('id', id)
      .maybeSingle()

    if (!actual) return NextResponse.json({ error: 'Estado no encontrado' }, { status: 404 })
    if (actual.es_sistema) {
      return NextResponse.json({ error: 'Los estados del sistema no se pueden editar' }, { status: 403 })
    }
    if (actual.empresa_id !== empresaId) {
      return NextResponse.json({ error: 'Estado no encontrado' }, { status: 404 })
    }

    const { data, error } = await admin
      .from(tabla)
      .update(cambios)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ estado: data })
  } catch (err) {
    console.error('Error PATCH /api/estados/items/[id]:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/estados/items/[id]?entidad_tipo=X — Eliminar un estado propio.
 *
 * Solo elimina estados propios de la empresa (no de sistema). Si hay
 * entidades activas usando este estado, deja la decisión a la UI: la
 * empresa puede pedir reasignar primero (regla de negocio que se puede
 * agregar más adelante con un flujo de migración).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const entidadTipo = request.nextUrl.searchParams.get('entidad_tipo')
    if (!entidadTipo || !esEntidadConEstado(entidadTipo)) {
      return NextResponse.json({ error: `entidad_tipo inválida: "${entidadTipo}"` }, { status: 400 })
    }
    const tabla = TABLA_ESTADOS_POR_ENTIDAD[entidadTipo]
    if (!tabla) {
      return NextResponse.json({ error: `Entidad "${entidadTipo}" no soportada todavía` }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    const { data: actual } = await admin
      .from(tabla)
      .select('id, empresa_id, es_sistema')
      .eq('id', id)
      .maybeSingle()

    if (!actual) return NextResponse.json({ error: 'Estado no encontrado' }, { status: 404 })
    if (actual.es_sistema) {
      return NextResponse.json({ error: 'Los estados del sistema no se pueden eliminar' }, { status: 403 })
    }
    if (actual.empresa_id !== empresaId) {
      return NextResponse.json({ error: 'Estado no encontrado' }, { status: 404 })
    }

    const { error } = await admin
      .from(tabla)
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error DELETE /api/estados/items/[id]:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

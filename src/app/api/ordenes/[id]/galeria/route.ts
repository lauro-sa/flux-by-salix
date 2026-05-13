import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { resolverPermisosGaleriaOT } from '@/lib/permisos-galeria-ot'
import type { AdjuntoChatter, MetadataChatter, SubtipoChatter } from '@/tipos/chatter'

/**
 * Endpoints de galería de OT (relevamiento + bitácora).
 * Las entradas viven en la tabla `chatter` con metadata.subtipo='relevamiento'
 * o metadata.subtipo='bitacora'. Esta API encapsula el ABM con las reglas
 * de permisos específicas de OT.
 */

const SUBTIPOS_VALIDOS: ReadonlySet<SubtipoChatter> = new Set<SubtipoChatter>([
  'relevamiento',
  'bitacora',
])

function parsearSubtipo(valor: string | null): SubtipoChatter | null {
  if (valor && SUBTIPOS_VALIDOS.has(valor as SubtipoChatter)) {
    return valor as SubtipoChatter
  }
  return null
}

/**
 * GET /api/ordenes/[id]/galeria?tipo=relevamiento|bitacora
 * Lista entradas de chatter de la OT con el subtipo indicado.
 *   - relevamiento → orden ASC (cronológico, refleja la visita).
 *   - bitacora     → orden DESC (más nuevo primero, feed de avances).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ordenId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const tipo = parsearSubtipo(new URL(request.url).searchParams.get('tipo'))
    if (!tipo) {
      return NextResponse.json({ error: 'Parámetro tipo inválido' }, { status: 400 })
    }

    const vis = await verificarVisibilidad(user.id, empresaId, 'ordenes_trabajo')
    if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()
    const permisos = await resolverPermisosGaleriaOT(admin, user, empresaId, ordenId)
    if (!permisos.orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    // ver_propio: el actor tiene que ser creador o asignado para ver la OT.
    if (vis.soloPropio) {
      const esCreador = permisos.orden.creado_por === user.id
      if (!esCreador && !permisos.esAsignado) {
        return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
      }
    }

    // Filtrar por subtipo a nivel jsonb. Como Postgres jsonb soporta `->>`
    // pero el cliente de Supabase no expone esa sintaxis con tipos seguros,
    // filtramos client-side después de pedir todo el chatter de la OT.
    // La OT tiene volumen acotado de entradas (decenas), no escala mal.
    const { data, error } = await admin
      .from('chatter')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('entidad_tipo', 'orden_trabajo')
      .eq('entidad_id', ordenId)
      .order('creado_en', { ascending: tipo === 'relevamiento' })

    if (error) {
      console.error('[galeria-ot GET] error:', error)
      return NextResponse.json({ error: 'Error al listar' }, { status: 500 })
    }

    const entradas = (data ?? []).filter(e => {
      const meta = (e.metadata ?? {}) as MetadataChatter
      return meta.subtipo === tipo
    })

    return NextResponse.json({
      entradas,
      puedeGestionar: permisos.puedeGestionar,
      esAsignado: permisos.esAsignado,
    })
  } catch (err) {
    console.error('[galeria-ot GET] error interno:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/ordenes/[id]/galeria
 * Body: { tipo: 'relevamiento'|'bitacora', contenido: string, adjuntos?: AdjuntoChatter[] }
 *
 * Permisos:
 *   - tipo='relevamiento' → solo `puedeGestionar`.
 *   - tipo='bitacora'     → `esAsignado` o `puedeGestionar` (los asignados
 *     pueden cargar avances aunque no tengan editar del módulo).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ordenId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const tipo = parsearSubtipo(body.tipo)
    if (!tipo) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }

    const contenido = typeof body.contenido === 'string' ? body.contenido.trim() : ''
    const adjuntos = Array.isArray(body.adjuntos) ? (body.adjuntos as AdjuntoChatter[]) : []

    if (contenido.length === 0 && adjuntos.length === 0) {
      return NextResponse.json({ error: 'Se requiere contenido o adjuntos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const permisos = await resolverPermisosGaleriaOT(admin, user, empresaId, ordenId)
    if (!permisos.orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    const autorizado =
      tipo === 'relevamiento'
        ? permisos.puedeGestionar
        : permisos.puedeGestionar || permisos.esAsignado

    if (!autorizado) {
      return NextResponse.json(
        {
          error:
            tipo === 'relevamiento'
              ? 'Solo administradores, creador o cabecilla pueden editar el relevamiento'
              : 'Solo asignados y gestores pueden cargar avances de bitácora',
        },
        { status: 403 },
      )
    }

    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, avatar_url')
      .eq('id', user.id)
      .single()
    const autorNombre = perfil ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() : 'Usuario'

    const metadata: MetadataChatter = {
      subtipo: tipo,
      accion: tipo === 'bitacora' ? 'bitacora_creada' : 'relevamiento_sembrado',
    }

    const { data, error } = await admin
      .from('chatter')
      .insert({
        empresa_id: empresaId,
        entidad_tipo: 'orden_trabajo',
        entidad_id: ordenId,
        tipo: 'nota_interna',
        contenido,
        autor_id: user.id,
        autor_nombre: autorNombre || 'Usuario',
        autor_avatar_url: perfil?.avatar_url ?? null,
        adjuntos,
        metadata,
      })
      .select()
      .single()

    if (error) {
      console.error('[galeria-ot POST] error:', error)
      return NextResponse.json({ error: 'Error al crear entrada' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[galeria-ot POST] error interno:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

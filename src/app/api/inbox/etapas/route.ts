import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import {
  ETAPAS_DEFAULT_WHATSAPP,
  ETAPAS_DEFAULT_CORREO,
  type TipoCanal,
} from '@/tipos/inbox'

/**
 * Obtiene las etapas predefinidas según el tipo de canal.
 * Se usa en: GET (auto-inserción), restablecer.
 */
function obtenerEtapasDefault(tipoCanal: TipoCanal) {
  if (tipoCanal === 'whatsapp') return ETAPAS_DEFAULT_WHATSAPP
  if (tipoCanal === 'correo') return ETAPAS_DEFAULT_CORREO
  return []
}

/**
 * GET /api/inbox/etapas — Listar etapas de conversación de la empresa.
 * Query params opcionales: tipo_canal ('whatsapp' | 'correo')
 * Si no existen etapas para la empresa+tipo_canal, auto-inserta los predefinidos.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_inbox', 'ver')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso para ver etapas' }, { status: 403 })
    }

    const tipoCanalParam = request.nextUrl.searchParams.get('tipo_canal') as TipoCanal | null
    const admin = crearClienteAdmin()

    // Construir query base
    let query = admin
      .from('etapas_conversacion')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true })

    if (tipoCanalParam) {
      query = query.eq('tipo_canal', tipoCanalParam)
    }

    const { data, error } = await query
    if (error) {
      // Si la tabla no existe aún, devolver vacío
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ etapas: [] })
      }
      throw error
    }

    // Auto-insertar predefinidos si no hay etapas para el tipo_canal solicitado
    if ((!data || data.length === 0) && tipoCanalParam) {
      const defaults = obtenerEtapasDefault(tipoCanalParam)
      if (defaults.length > 0) {
        const registros = defaults.map((e) => ({
          empresa_id: empresaId,
          ...e,
        }))

        const { data: insertados, error: errorInsert } = await admin
          .from('etapas_conversacion')
          .insert(registros)
          .select()

        if (errorInsert) throw errorInsert
        return NextResponse.json({ etapas: insertados || [] })
      }
    }

    return NextResponse.json({ etapas: data || [] })
  } catch (err) {
    console.error('Error al obtener etapas:', err)
    return NextResponse.json({ error: 'Error al obtener etapas' }, { status: 500 })
  }
}

/**
 * POST /api/inbox/etapas — Crear una nueva etapa personalizada.
 * Body: { tipo_canal, clave, etiqueta, color, icono?, orden? }
 * Siempre se crea como es_predefinida: false.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_inbox', 'editar')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso para crear etapas' }, { status: 403 })
    }

    const body = await request.json()
    const { tipo_canal, clave, etiqueta, color, icono, orden } = body

    if (!tipo_canal || !clave || !etiqueta || !color) {
      return NextResponse.json(
        { error: 'tipo_canal, clave, etiqueta y color son requeridos' },
        { status: 400 }
      )
    }

    const admin = crearClienteAdmin()

    // Si no se proporciona orden, calcular el siguiente
    let ordenFinal = orden
    if (ordenFinal === undefined || ordenFinal === null) {
      const { data: ultima } = await admin
        .from('etapas_conversacion')
        .select('orden')
        .eq('empresa_id', empresaId)
        .eq('tipo_canal', tipo_canal)
        .order('orden', { ascending: false })
        .limit(1)
        .single()

      ordenFinal = (ultima?.orden ?? -1) + 1
    }

    const { data: etapa, error } = await admin
      .from('etapas_conversacion')
      .insert({
        empresa_id: empresaId,
        tipo_canal,
        clave,
        etiqueta,
        color,
        icono: icono || null,
        orden: ordenFinal,
        es_predefinida: false,
        activa: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ etapa }, { status: 201 })
  } catch (err) {
    console.error('Error al crear etapa:', err)
    return NextResponse.json({ error: 'Error al crear etapa' }, { status: 500 })
  }
}

/**
 * PATCH /api/inbox/etapas — Actualizar una etapa existente.
 * Body: { id, etiqueta?, color?, icono?, orden?, activa? }
 * No se puede cambiar clave ni tipo_canal.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_inbox', 'editar')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso para editar etapas' }, { status: 403 })
    }

    const body = await request.json()
    const { id, etiqueta, color, icono, orden, activa } = body

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    // Construir objeto de actualización solo con los campos proporcionados
    const actualizacion: Record<string, unknown> = {}
    if (etiqueta !== undefined) actualizacion.etiqueta = etiqueta
    if (color !== undefined) actualizacion.color = color
    if (icono !== undefined) actualizacion.icono = icono
    if (orden !== undefined) actualizacion.orden = orden
    if (activa !== undefined) actualizacion.activa = activa

    if (Object.keys(actualizacion).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    const { data: etapa, error } = await admin
      .from('etapas_conversacion')
      .update(actualizacion)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    if (!etapa) {
      return NextResponse.json({ error: 'Etapa no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ etapa })
  } catch (err) {
    console.error('Error al actualizar etapa:', err)
    return NextResponse.json({ error: 'Error al actualizar etapa' }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/etapas — Eliminar una etapa por id.
 * Query param: id
 * Si es predefinida, no se elimina sino que se desactiva (activa: false).
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_inbox', 'editar')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso para eliminar etapas' }, { status: 403 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id es requerido como query param' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Primero obtener la etapa para verificar si es predefinida
    const { data: etapa, error: errorBuscar } = await admin
      .from('etapas_conversacion')
      .select('id, es_predefinida')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (errorBuscar || !etapa) {
      return NextResponse.json({ error: 'Etapa no encontrada' }, { status: 404 })
    }

    if (etapa.es_predefinida) {
      // No se puede eliminar una predefinida, solo desactivar
      const { data: desactivada, error: errorDesactivar } = await admin
        .from('etapas_conversacion')
        .update({ activa: false })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (errorDesactivar) throw errorDesactivar

      return NextResponse.json({
        etapa: desactivada,
        mensaje: 'Etapa predefinida desactivada (no se puede eliminar)',
      })
    }

    // Eliminar etapa personalizada (FK ON DELETE SET NULL cuida las conversaciones)
    const { error: errorEliminar } = await admin
      .from('etapas_conversacion')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (errorEliminar) throw errorEliminar

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar etapa:', err)
    return NextResponse.json({ error: 'Error al eliminar etapa' }, { status: 500 })
  }
}

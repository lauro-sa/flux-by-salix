import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import {
  ETAPAS_DEFAULT_WHATSAPP,
  ETAPAS_DEFAULT_CORREO,
  type TipoCanal,
} from '@/tipos/inbox'

/**
 * Obtiene las etapas predefinidas según el tipo de canal.
 * Se usa en: restablecer etapas a valores predeterminados.
 */
function obtenerEtapasDefault(tipoCanal: TipoCanal) {
  if (tipoCanal === 'whatsapp') return ETAPAS_DEFAULT_WHATSAPP
  if (tipoCanal === 'correo') return ETAPAS_DEFAULT_CORREO
  return []
}

/**
 * POST /api/inbox/etapas/restablecer — Restablecer etapas predefinidas.
 * Body: { tipo_canal: 'whatsapp' | 'correo' }
 *
 * - Elimina todas las etapas personalizadas (no predefinidas) del tipo_canal
 * - Reactiva y actualiza las predefinidas a sus valores originales
 * - Las conversaciones con etapa_id de etapas eliminadas quedan con etapa_id = NULL
 *   (manejado por FK ON DELETE SET NULL en la BD)
 */
export async function POST(request: Request) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_inbox', 'editar')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso para restablecer etapas' }, { status: 403 })
    }

    const body = await request.json()
    const tipoCanal = body.tipo_canal as TipoCanal

    if (!tipoCanal || !['whatsapp', 'correo'].includes(tipoCanal)) {
      return NextResponse.json(
        { error: 'tipo_canal debe ser "whatsapp" o "correo"' },
        { status: 400 }
      )
    }

    const defaults = obtenerEtapasDefault(tipoCanal)
    if (defaults.length === 0) {
      return NextResponse.json({ error: 'No hay etapas predefinidas para este tipo de canal' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // 1. Eliminar todas las etapas personalizadas (no predefinidas) de este tipo_canal
    //    FK ON DELETE SET NULL se encarga de limpiar etapa_id en conversaciones
    const { error: errorEliminar } = await admin
      .from('etapas_conversacion')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('tipo_canal', tipoCanal)
      .eq('es_predefinida', false)

    if (errorEliminar) throw errorEliminar

    // 2. Eliminar las predefinidas existentes para re-insertarlas limpias
    const { error: errorEliminarPred } = await admin
      .from('etapas_conversacion')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('tipo_canal', tipoCanal)
      .eq('es_predefinida', true)

    if (errorEliminarPred) throw errorEliminarPred

    // 3. Re-insertar todas las etapas predefinidas con valores originales
    const registros = defaults.map((e) => ({
      empresa_id: empresaId,
      ...e,
    }))

    const { data: etapasRestauradas, error: errorInsertar } = await admin
      .from('etapas_conversacion')
      .insert(registros)
      .select()

    if (errorInsertar) throw errorInsertar

    return NextResponse.json({ etapas: etapasRestauradas || [] })
  } catch (err) {
    console.error('Error al restablecer etapas:', err)
    return NextResponse.json({ error: 'Error al restablecer etapas' }, { status: 500 })
  }
}

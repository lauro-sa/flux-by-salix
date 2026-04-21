import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/whatsapp/plantillas/[id]/historial — Devuelve la línea de tiempo
 * de eventos de una plantilla (creada, editada, enviada_a_meta, aprobada,
 * rechazada, etc.) para mostrar en el editor.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Verificar pertenencia
    const { data: plantilla } = await admin
      .from('plantillas_whatsapp')
      .select('id, creado_en, creado_por_nombre, estado_meta, ultima_sincronizacion')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!plantilla) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const { data: historial } = await admin
      .from('historial_plantillas_whatsapp')
      .select('*')
      .eq('plantilla_id', id)
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: true })

    const eventos = historial || []

    // Si no hay ningún evento registrado todavía (plantillas creadas antes de
    // introducir el historial), sintetizamos los hitos mínimos a partir de los
    // timestamps de la plantilla para que la línea de tiempo nunca aparezca
    // vacía.
    if (eventos.length === 0) {
      const sintetico: Array<Record<string, unknown>> = []
      sintetico.push({
        id: `sint-creada-${plantilla.id}`,
        plantilla_id: plantilla.id,
        evento: 'creada',
        estado_previo: null,
        estado_nuevo: 'BORRADOR',
        detalle: null,
        usuario_nombre: plantilla.creado_por_nombre,
        creado_en: plantilla.creado_en,
        metadata: { sintetico: true },
      })
      if (plantilla.ultima_sincronizacion && plantilla.estado_meta !== 'BORRADOR') {
        sintetico.push({
          id: `sint-sync-${plantilla.id}`,
          plantilla_id: plantilla.id,
          evento: plantilla.estado_meta === 'APPROVED' ? 'aprobada'
            : plantilla.estado_meta === 'REJECTED' ? 'rechazada'
            : plantilla.estado_meta === 'DISABLED' ? 'deshabilitada'
            : plantilla.estado_meta === 'PAUSED' ? 'pausada'
            : 'enviada_a_meta',
          estado_previo: null,
          estado_nuevo: plantilla.estado_meta,
          detalle: 'Estado heredado (antes del registro de historial)',
          usuario_nombre: null,
          creado_en: plantilla.ultima_sincronizacion,
          metadata: { sintetico: true },
        })
      }
      return NextResponse.json({ eventos: sintetico })
    }

    return NextResponse.json({ eventos })
  } catch (err) {
    console.error('Error al obtener historial de plantilla WA:', err)
    return NextResponse.json({ eventos: [] })
  }
}

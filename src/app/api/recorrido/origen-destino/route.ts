import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/recorrido/origen-destino — Guardar origen y destino de un recorrido.
 * Body: { recorrido_id, origen?, destino? }
 * Cada uno puede ser: { lat, lng, texto } o null para limpiar.
 * Se usa en: ModalRecorrido (coordinador configura de dónde sale y a dónde vuelve el visitador).
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { recorrido_id, origen, destino } = body as {
      recorrido_id: string
      origen?: { lat: number; lng: number; texto: string } | null
      destino?: { lat: number; lng: number; texto: string } | null
    }

    if (!recorrido_id) {
      return NextResponse.json({ error: 'recorrido_id requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que pertenece a la empresa
    const { data: recorrido } = await admin
      .from('recorridos')
      .select('id')
      .eq('id', recorrido_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!recorrido) {
      return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })
    }

    // Armar update: origen en campos propios, destino en config
    const update: Record<string, unknown> = {
      actualizado_en: new Date().toISOString(),
    }

    // Origen: campos dedicados en la tabla
    if (origen !== undefined) {
      update.origen_lat = origen?.lat ?? null
      update.origen_lng = origen?.lng ?? null
      update.origen_texto = origen?.texto ?? null
    }

    // Destino: guardado en config (la tabla no tiene campos dedicados)
    if (destino !== undefined) {
      const { data: actual } = await admin
        .from('recorridos')
        .select('config')
        .eq('id', recorrido_id)
        .single()

      const configActual = (actual?.config || {}) as Record<string, unknown>
      update.config = { ...configActual, destino: destino ?? null }
    }

    const { error } = await admin
      .from('recorridos')
      .update(update)
      .eq('id', recorrido_id)

    if (error) {
      return NextResponse.json({ error: 'Error al guardar', detalle: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en PATCH /api/recorrido/origen-destino:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

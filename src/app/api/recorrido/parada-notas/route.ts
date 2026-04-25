import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/recorrido/parada-notas — Actualizar la nota libre de una parada
 * genérica del recorrido (tipo='parada'). Las notas viven en `recorrido_paradas.notas`
 * y son visibles sólo para el visitador dentro de su recorrido — no se espejan al
 * chatter ni a ninguna otra entidad (son observaciones personales del trayecto,
 * ej: "paré a cargar nafta", "reunión con Juan").
 *
 * Body: { parada_id: string, notas: string | null }
 * Se usa en: tarjeta de parada genérica (tanto en vivo como en el resumen del día).
 */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'registrar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const { parada_id, notas } = await request.json() as {
      parada_id: string
      notas: string | null
    }

    if (!parada_id) {
      return NextResponse.json({ error: 'parada_id es requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que la parada pertenece a un recorrido de la empresa
    const { data: parada } = await admin
      .from('recorrido_paradas')
      .select('id, recorrido_id, tipo')
      .eq('id', parada_id)
      .maybeSingle()

    if (!parada) {
      return NextResponse.json({ error: 'Parada no encontrada' }, { status: 404 })
    }
    if (parada.tipo !== 'parada') {
      return NextResponse.json({ error: 'Sólo paradas genéricas admiten notas libres' }, { status: 400 })
    }

    const { data: recorridoOwner } = await admin
      .from('recorridos')
      .select('id')
      .eq('id', parada.recorrido_id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!recorridoOwner) {
      return NextResponse.json({ error: 'Recorrido no pertenece a la empresa' }, { status: 403 })
    }

    const { error } = await admin
      .from('recorrido_paradas')
      .update({ notas: notas && notas.trim() ? notas.trim() : null })
      .eq('id', parada_id)

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar nota', detalle: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en PATCH /api/recorrido/parada-notas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

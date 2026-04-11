import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * PATCH /api/recorrido/reordenar — Reordenar paradas del recorrido.
 * Body: { recorrido_id, paradas: [{ id, orden }] }
 * Se usa en: ListaParadas (mobile, drag & drop propio) y PanelPlanificacion (coordinador).
 * Acepta IDs de parada o IDs de visita (busca la parada correspondiente).
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { recorrido_id, paradas } = body as {
      recorrido_id: string
      paradas: { id: string; orden: number }[]
    }

    if (!recorrido_id || !paradas?.length) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el recorrido pertenece a la empresa
    const { data: recorrido } = await admin
      .from('recorridos')
      .select('id, asignado_a')
      .eq('id', recorrido_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!recorrido) {
      return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })
    }

    // Si no es el dueño del recorrido, verificar permiso de coordinador
    if (recorrido.asignado_a !== user.id) {
      const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'asignar')
      if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    // Obtener paradas existentes para mapear visita_id → parada_id
    const { data: paradasExistentes } = await admin
      .from('recorrido_paradas')
      .select('id, visita_id')
      .eq('recorrido_id', recorrido_id)

    const mapaVisitaAParada = new Map(
      (paradasExistentes || []).map(p => [p.visita_id, p.id])
    )
    const idsParadasExistentes = new Set(
      (paradasExistentes || []).map(p => p.id)
    )

    // Actualizar orden de cada parada (acepta ID de parada o ID de visita)
    const promesas = paradas.map(({ id, orden }) => {
      const paradaId = idsParadasExistentes.has(id) ? id : mapaVisitaAParada.get(id)
      if (!paradaId) return Promise.resolve()
      return admin
        .from('recorrido_paradas')
        .update({ orden })
        .eq('id', paradaId)
        .eq('recorrido_id', recorrido_id)
    })

    await Promise.all(promesas)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en PATCH /api/recorrido/reordenar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * PATCH /api/recorrido/config — Actualizar config de permisos de un recorrido.
 * Body: { recorrido_id, config: { puede_reordenar, puede_cambiar_duracion, ... } }
 * Solo coordinadores con permiso 'visitas.asignar' pueden cambiar esto.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'asignar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = await request.json()
    const { recorrido_id, config } = body as {
      recorrido_id: string
      config: Record<string, boolean>
    }

    if (!recorrido_id || !config) {
      return NextResponse.json({ error: 'recorrido_id y config son obligatorios' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el recorrido pertenece a la empresa
    const { data: recorrido } = await admin
      .from('recorridos')
      .select('id')
      .eq('id', recorrido_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!recorrido) {
      return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })
    }

    // Sanitizar config — solo campos válidos
    const configLimpia = {
      puede_reordenar: !!config.puede_reordenar,
      puede_cambiar_duracion: !!config.puede_cambiar_duracion,
      puede_agregar_paradas: !!config.puede_agregar_paradas,
      puede_quitar_paradas: !!config.puede_quitar_paradas,
      puede_cancelar: !!config.puede_cancelar,
    }

    const { error } = await admin
      .from('recorridos')
      .update({ config: configLimpia, actualizado_en: new Date().toISOString() })
      .eq('id', recorrido_id)

    if (error) {
      console.error('Error al actualizar config recorrido:', error)
      return NextResponse.json({ error: 'Error al actualizar config' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, config: configLimpia })
  } catch (err) {
    console.error('Error en PATCH /api/recorrido/config:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

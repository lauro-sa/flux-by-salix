import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * PATCH /api/visitas/permisos-recorrido-default
 *
 * Actualiza los permisos por DEFAULT del visitador para sus recorridos
 * (puede_reordenar, puede_cambiar_duracion, puede_agregar_paradas,
 * puede_quitar_paradas, puede_cancelar). Estos defaults se aplican al crear
 * un nuevo recorrido; el coordinador puede sobreescribirlos por día desde
 * `recorridos.config`.
 *
 * Body: { usuario_id: string, permisos: { ... } }
 *
 * Permiso requerido: visitas.asignar (coordinador).
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'asignar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para gestionar permisos del recorrido' }, { status: 403 })

    const body = await request.json() as {
      usuario_id?: string
      permisos?: Record<string, boolean>
    }
    if (!body.usuario_id) return NextResponse.json({ error: 'Falta usuario_id' }, { status: 400 })
    if (!body.permisos || typeof body.permisos !== 'object') {
      return NextResponse.json({ error: 'Falta permisos' }, { status: 400 })
    }

    // Sanitizar: solo aceptar las claves conocidas
    const clavesPermitidas = ['puede_reordenar', 'puede_cambiar_duracion', 'puede_agregar_paradas', 'puede_quitar_paradas', 'puede_cancelar']
    const permisosLimpios: Record<string, boolean> = {}
    for (const k of clavesPermitidas) {
      if (typeof body.permisos[k] === 'boolean') permisosLimpios[k] = body.permisos[k]
    }

    const admin = crearClienteAdmin()
    const { error } = await admin
      .from('miembros')
      .update({ permisos_recorrido_default: permisosLimpios })
      .eq('empresa_id', empresaId)
      .eq('usuario_id', body.usuario_id)

    if (error) {
      console.error('Error al actualizar permisos_recorrido_default:', error)
      return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, permisos: permisosLimpios })
  } catch (err) {
    console.error('Error en PATCH /api/visitas/permisos-recorrido-default:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

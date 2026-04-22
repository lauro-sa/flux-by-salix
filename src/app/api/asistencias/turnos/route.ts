import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/asistencias/turnos — Listar turnos laborales.
 */
export async function GET() {
  try {
    // Los turnos son config de asistencias — cualquiera con ver de la config
    // puede consultarlos (los selects de horario dependen de esta lista).
    const guard = await requerirPermisoAPI('config_asistencias', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('turnos_laborales')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true })
      .order('creado_en', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ turnos: data || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/asistencias/turnos — Crear turno laboral.
 * También acepta { accion: 'reordenar', ordenes: [{id, orden}, ...] }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_asistencias', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Reordenar en lote
    if (body.accion === 'reordenar' && Array.isArray(body.ordenes)) {
      await Promise.all(body.ordenes.map((o: { id: string; orden: number }) =>
        admin
          .from('turnos_laborales')
          .update({ orden: o.orden, actualizado_en: new Date().toISOString() })
          .eq('id', o.id)
          .eq('empresa_id', empresaId),
      ))
      return NextResponse.json({ ok: true })
    }

    // Si se marca como default, quitar default de los demás
    if (body.es_default) {
      await admin
        .from('turnos_laborales')
        .update({ es_default: false })
        .eq('empresa_id', empresaId)
        .eq('es_default', true)
    }

    const { data, error } = await admin
      .from('turnos_laborales')
      .insert({
        empresa_id: empresaId,
        nombre: body.nombre,
        es_default: body.es_default || false,
        flexible: body.flexible || false,
        tolerancia_min: body.tolerancia_min ?? 10,
        dias: body.dias,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/asistencias/turnos — Actualizar turno laboral.
 * Body: { id: string, ...campos }
 */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_asistencias', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const { id, ...campos } = body
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Si se marca como default, quitar default de los demás
    if (campos.es_default) {
      await admin
        .from('turnos_laborales')
        .update({ es_default: false })
        .eq('empresa_id', empresaId)
        .eq('es_default', true)
    }

    const { data, error } = await admin
      .from('turnos_laborales')
      .update({ ...campos, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/asistencias/turnos — Eliminar turno laboral.
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_asistencias', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const admin = crearClienteAdmin()

    // No permitir eliminar si es el único turno default
    const turno = await admin.from('turnos_laborales').select('es_default').eq('id', body.id).single()
    if (turno.data?.es_default) {
      return NextResponse.json({ error: 'No se puede eliminar el turno predeterminado' }, { status: 400 })
    }

    // Limpiar referencias en sectores y miembros
    await Promise.all([
      admin.from('sectores').update({ turno_id: null }).eq('empresa_id', empresaId).eq('turno_id', body.id),
      admin.from('miembros').update({ turno_id: null }).eq('empresa_id', empresaId).eq('turno_id', body.id),
    ])

    const { error } = await admin
      .from('turnos_laborales')
      .delete()
      .eq('id', body.id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

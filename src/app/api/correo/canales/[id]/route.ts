import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

// PATCH /api/correo/canales/[id] — actualizar canal de correo
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const camposPermitidos = ['nombre', 'activo', 'config_conexion', 'estado_conexion', 'ultimo_error', 'modulos_disponibles', 'es_principal']
    const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() }

    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) cambios[campo] = body[campo]
    }

    const admin = crearClienteAdmin()

    if (body.es_principal === true) {
      await admin
        .from('canales_correo')
        .update({ es_principal: false })
        .eq('empresa_id', empresaId)
        .eq('es_principal', true)
        .neq('id', id)
    }

    // Solo actualizar canales_correo si hay campos que tocar (evita UPDATE con solo actualizado_en).
    let canalActualizado: Record<string, unknown> | null = null
    if (Object.keys(cambios).length > 1) {
      const { data, error } = await admin
        .from('canales_correo')
        .update(cambios)
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()
      if (error) throw error
      canalActualizado = data
    }

    // Si llegan 'agentes' (array de usuario_id) → reemplazar la lista completa.
    // No se mezcla con los otros campos para mantener la semántica clara.
    if (Array.isArray(body.agentes)) {
      await admin.from('canal_agentes').delete().eq('canal_id', id)
      if (body.agentes.length > 0) {
        const registros = body.agentes.map((usuarioId: string) => ({
          canal_id: id,
          usuario_id: usuarioId,
          rol_canal: 'agente',
        }))
        await admin.from('canal_agentes').insert(registros)
      }
    }

    return NextResponse.json({ canal: canalActualizado })
  } catch (err) {
    console.error('Error al actualizar canal de correo:', err)
    return NextResponse.json({ error: 'Error al actualizar canal' }, { status: 500 })
  }
}

// DELETE /api/correo/canales/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    const { error } = await admin
      .from('canales_correo')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar canal de correo:', err)
    return NextResponse.json({ error: 'Error al eliminar canal' }, { status: 500 })
  }
}

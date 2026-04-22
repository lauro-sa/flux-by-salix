import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/correo/plantillas/[id]/restaurar — Restaurar plantilla de sistema al original.
 * Reemplaza asunto y contenido_html con los valores originales guardados.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Obtener la plantilla y verificar que sea de sistema
    const { data: plantilla, error: errorBuscar } = await admin
      .from('plantillas_correo')
      .select('es_sistema, contenido_original_html, asunto_original')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (errorBuscar || !plantilla) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
    }

    if (!plantilla.es_sistema) {
      return NextResponse.json({ error: 'Solo se pueden restaurar plantillas del sistema' }, { status: 400 })
    }

    if (!plantilla.contenido_original_html || !plantilla.asunto_original) {
      return NextResponse.json({ error: 'No hay contenido original para restaurar' }, { status: 400 })
    }

    // Restaurar al original
    const { data, error } = await admin
      .from('plantillas_correo')
      .update({
        asunto: plantilla.asunto_original,
        contenido_html: plantilla.contenido_original_html,
        contenido: plantilla.contenido_original_html.replace(/<[^>]*>/g, '').trim(),
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plantilla: data })
  } catch (err) {
    console.error('Error al restaurar plantilla:', err)
    return NextResponse.json({ error: 'Error al restaurar plantilla' }, { status: 500 })
  }
}

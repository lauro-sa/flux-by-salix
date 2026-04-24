import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/inbox/correo/programar — Programar envío de correo.
 * GET /api/inbox/correo/programar — Listar correos programados.
 * DELETE /api/inbox/correo/programar?id=xxx — Cancelar correo programado.
 */

export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_correo', 'enviar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const {
      canal_id, conversacion_id,
      correo_para, correo_cc, correo_cco, correo_asunto,
      texto, html, correo_in_reply_to, correo_references,
      adjuntos_ids, enviar_en,
      // Contexto extra para que el cron reproduzca el envío idéntico a uno inmediato.
      tipo, pdf_url, pdf_nombre, pdf_congelado_url,
      entidad_tipo, entidad_id, incluir_enlace_portal,
    } = body

    if (!canal_id || !correo_para?.length || !enviar_en) {
      return NextResponse.json({ error: 'canal_id, correo_para y enviar_en son requeridos' }, { status: 400 })
    }

    const fechaEnvio = new Date(enviar_en)
    if (fechaEnvio <= new Date()) {
      return NextResponse.json({ error: 'La fecha de envío debe ser futura' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('correos_programados')
      .insert({
        empresa_id: empresaId,
        canal_id,
        conversacion_id: conversacion_id || null,
        creado_por: user.id,
        correo_para,
        correo_cc: correo_cc || null,
        correo_cco: correo_cco || null,
        correo_asunto: correo_asunto || '(Sin asunto)',
        texto: texto || null,
        html: html || null,
        correo_in_reply_to: correo_in_reply_to || null,
        correo_references: correo_references || null,
        adjuntos_ids: adjuntos_ids || null,
        enviar_en: fechaEnvio.toISOString(),
        tipo: tipo || 'nuevo',
        pdf_url: pdf_url || null,
        pdf_nombre: pdf_nombre || null,
        pdf_congelado_url: pdf_congelado_url || null,
        entidad_tipo: entidad_tipo || null,
        entidad_id: entidad_id || null,
        incluir_enlace_portal: !!incluir_enlace_portal,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ programado: data }, { status: 201 })
  } catch (err) {
    console.error('Error programando correo:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(_request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_correo', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const supabase = await crearClienteServidor()
    const { data } = await supabase
      .from('correos_programados')
      .select('*')
      .eq('empresa_id', empresaId)
      .in('estado', ['pendiente'])
      .order('enviar_en', { ascending: true })

    return NextResponse.json({ programados: data || [] })
  } catch (err) {
    console.error('Error listando programados:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_correo', 'enviar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    const { error } = await admin
      .from('correos_programados')
      .update({ estado: 'cancelado' })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .eq('estado', 'pendiente')

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error cancelando programado:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

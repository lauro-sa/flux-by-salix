import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta, crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/inbox/correo/programar — Programar envío de correo.
 * GET /api/inbox/correo/programar — Listar correos programados.
 * DELETE /api/inbox/correo/programar?id=xxx — Cancelar correo programado.
 */

export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const {
      canal_id, conversacion_id,
      correo_para, correo_cc, correo_cco, correo_asunto,
      texto, html, correo_in_reply_to, correo_references,
      adjuntos_ids, enviar_en,
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

export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

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
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

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

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * API de mensajes de WhatsApp programados.
 * GET  — Listar programados de una conversación (pendiente/error)
 * POST — Programar un nuevo mensaje de WhatsApp
 * DELETE — Cancelar un mensaje programado (solo si está pendiente)
 *
 * Se usa en: PanelWhatsApp, SeccionWhatsApp (programar envíos diferidos).
 * El cron /api/cron/enviar-programados los envía cuando llega la hora.
 */

export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_whatsapp', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta

    const { searchParams } = new URL(request.url)
    const conversacionId = searchParams.get('conversacion_id')

    const supabase = await crearClienteServidor()

    // Sin conversacion_id: devolver el próximo programado por conversación
    if (!conversacionId) {
      const { data, error } = await supabase
        .from('whatsapp_programados')
        .select('conversacion_id, enviar_en')
        .eq('estado', 'pendiente')
        .order('enviar_en', { ascending: true })

      if (error) {
        console.error('Error al listar conversaciones con programados:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Agrupar: solo el más próximo por conversación
      const mapa: Record<string, string> = {}
      for (const p of data || []) {
        if (p.conversacion_id && !mapa[p.conversacion_id]) {
          mapa[p.conversacion_id] = p.enviar_en
        }
      }
      return NextResponse.json({ programados_por_conversacion: mapa })
    }

    // Con conversacion_id: devolver programados de esa conversación
    const { data, error } = await supabase
      .from('whatsapp_programados')
      .select('*')
      .eq('conversacion_id', conversacionId)
      .in('estado', ['pendiente', 'error'])
      .order('enviar_en', { ascending: true })

    if (error) {
      console.error('Error al listar WhatsApp programados:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ programados: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_whatsapp', 'enviar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const {
      conversacion_id,
      canal_id,
      destinatario,
      tipo_contenido,
      texto,
      media_url,
      media_nombre,
      plantilla_nombre,
      plantilla_idioma,
      plantilla_componentes,
      enviar_en,
    } = body

    // Validaciones básicas
    if (!conversacion_id) {
      return NextResponse.json({ error: 'conversacion_id es requerido' }, { status: 400 })
    }
    if (!canal_id) {
      return NextResponse.json({ error: 'canal_id es requerido' }, { status: 400 })
    }
    if (!destinatario) {
      return NextResponse.json({ error: 'destinatario es requerido' }, { status: 400 })
    }
    if (!enviar_en) {
      return NextResponse.json({ error: 'enviar_en es requerido' }, { status: 400 })
    }

    // Validar que la fecha de envío sea futura
    const fechaEnvio = new Date(enviar_en)
    if (fechaEnvio <= new Date()) {
      return NextResponse.json({ error: 'enviar_en debe ser una fecha futura' }, { status: 400 })
    }

    // Validar contenido según tipo
    const tipoFinal = tipo_contenido || 'texto'
    if (tipoFinal === 'texto' && !texto) {
      return NextResponse.json({ error: 'texto es requerido para mensajes de texto' }, { status: 400 })
    }
    if (['imagen', 'video', 'audio', 'documento'].includes(tipoFinal) && !media_url) {
      return NextResponse.json({ error: 'media_url es requerido para mensajes multimedia' }, { status: 400 })
    }
    if (tipoFinal === 'plantilla' && !plantilla_nombre) {
      return NextResponse.json({ error: 'plantilla_nombre es requerido para plantillas' }, { status: 400 })
    }

    const supabase = await crearClienteServidor()
    const { data, error } = await supabase
      .from('whatsapp_programados')
      .insert({
        empresa_id: empresaId,
        canal_id,
        conversacion_id,
        creado_por: user.id,
        destinatario,
        tipo_contenido: tipoFinal,
        texto: texto || null,
        media_url: media_url || null,
        media_nombre: media_nombre || null,
        plantilla_nombre: plantilla_nombre || null,
        plantilla_idioma: plantilla_idioma || null,
        plantilla_componentes: plantilla_componentes || null,
        enviar_en: fechaEnvio.toISOString(),
        estado: 'pendiente',
      })
      .select()
      .single()

    if (error) {
      console.error('Error al programar WhatsApp:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ programado: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_whatsapp', 'enviar')
    if ('respuesta' in guard) return guard.respuesta

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    // Verificar que existe y está pendiente (RLS filtra por empresa)
    const supabase = await crearClienteServidor()
    const { data: existente, error: errorBuscar } = await supabase
      .from('whatsapp_programados')
      .select('id, estado')
      .eq('id', id)
      .single()

    if (errorBuscar || !existente) {
      return NextResponse.json({ error: 'Mensaje programado no encontrado' }, { status: 404 })
    }

    if (existente.estado !== 'pendiente') {
      return NextResponse.json(
        { error: `No se puede cancelar un mensaje con estado "${existente.estado}"` },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('whatsapp_programados')
      .update({ estado: 'cancelado' })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error al cancelar WhatsApp programado:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ programado: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/mensajes — Listar mensajes de una conversación.
 * Requiere: conversacion_id como query param.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const conversacion_id = params.get('conversacion_id')
    if (!conversacion_id) {
      return NextResponse.json({ error: 'conversacion_id es requerido' }, { status: 400 })
    }

    const pagina = parseInt(params.get('pagina') || '1')
    const por_pagina = Math.min(parseInt(params.get('por_pagina') || '200'), 500)
    const desde = (pagina - 1) * por_pagina

    // Si se pide un hilo específico
    const hilo_raiz_id = params.get('hilo_raiz_id')

    const admin = crearClienteAdmin()

    // Verificar que la conversación pertenezca a la empresa del usuario
    const { data: convVerif } = await admin
      .from('conversaciones')
      .select('id')
      .eq('id', conversacion_id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!convVerif) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    let query = admin
      .from('mensajes')
      .select(`
        *,
        adjuntos:mensaje_adjuntos(*)
      `, { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('conversacion_id', conversacion_id)
      .is('eliminado_en', null)

    // Si es hilo, traer solo mensajes del hilo
    if (hilo_raiz_id) {
      query = query.or(`id.eq.${hilo_raiz_id},hilo_raiz_id.eq.${hilo_raiz_id}`)
    } else {
      // En vista principal, excluir respuestas de hilos (se cargan aparte)
      query = query.is('hilo_raiz_id', null)
    }

    const { data, count, error } = await query
      .order('creado_en', { ascending: true })
      .range(desde, desde + por_pagina - 1)

    if (error) throw error

    // Marcar como leídos los mensajes entrantes
    await admin
      .from('conversaciones')
      .update({ mensajes_sin_leer: 0 })
      .eq('id', conversacion_id)
      .eq('empresa_id', empresaId)

    return NextResponse.json({ mensajes: data || [], total: count || 0 })
  } catch (err) {
    console.error('Error al obtener mensajes:', err)
    return NextResponse.json({ error: 'Error al obtener mensajes' }, { status: 500 })
  }
}

/**
 * POST /api/inbox/mensajes — Enviar un mensaje.
 * Maneja: texto, adjuntos, respuestas en hilo, plantillas.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const {
      conversacion_id, tipo_contenido = 'texto', texto, html,
      correo_para, correo_cc, correo_cco, correo_asunto,
      respuesta_a_id, plantilla_id, es_nota_interna = false,
    } = body

    if (!conversacion_id) {
      return NextResponse.json({ error: 'conversacion_id es requerido' }, { status: 400 })
    }

    if (!texto && !html && tipo_contenido === 'texto') {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener nombre del remitente
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

    const nombreRemitente = perfil
      ? `${perfil.nombre} ${perfil.apellido || ''}`.trim()
      : 'Agente'

    // Determinar hilo_raiz_id si es respuesta
    let hilo_raiz_id = null
    if (respuesta_a_id) {
      const { data: msgPadre } = await admin
        .from('mensajes')
        .select('hilo_raiz_id')
        .eq('id', respuesta_a_id)
        .single()
      hilo_raiz_id = msgPadre?.hilo_raiz_id || respuesta_a_id
    }

    // Insertar mensaje
    const { data: mensaje, error } = await admin
      .from('mensajes')
      .insert({
        empresa_id: empresaId,
        conversacion_id,
        es_entrante: false,
        remitente_tipo: 'agente',
        remitente_id: user.id,
        remitente_nombre: nombreRemitente,
        tipo_contenido,
        texto: texto || null,
        html: html || null,
        correo_para: correo_para || null,
        correo_cc: correo_cc || null,
        correo_cco: correo_cco || null,
        correo_asunto: correo_asunto || null,
        respuesta_a_id: respuesta_a_id || null,
        hilo_raiz_id,
        plantilla_id: plantilla_id || null,
        es_nota_interna: es_nota_interna || false,
        estado: 'enviado',
      })
      .select()
      .single()

    if (error) throw error

    // Actualizar contador de respuestas del hilo
    if (hilo_raiz_id) {
      await admin.rpc('incrementar_respuestas_hilo', { mensaje_raiz_id: hilo_raiz_id })
    }

    // Actualizar último mensaje de la conversación (las notas internas no actualizan el preview)
    if (!es_nota_interna) {
      await admin
        .from('conversaciones')
        .update({
          ultimo_mensaje_texto: texto || `[${tipo_contenido}]`,
          ultimo_mensaje_en: new Date().toISOString(),
          ultimo_mensaje_es_entrante: false,
          actualizado_en: new Date().toISOString(),
          ...(body.es_primera_respuesta ? { primera_respuesta_en: new Date().toISOString() } : {}),
        })
        .eq('id', conversacion_id)
    }

    // ─── Notificación para mensajes internos ───
    // Notificar a los miembros del canal que no son el remitente
    if (!es_nota_interna) {
      try {
        const { data: conv } = await admin
          .from('conversaciones')
          .select('tipo_canal, canal_interno_id, asignado_a, contacto_nombre')
          .eq('id', conversacion_id)
          .single()

        if (conv?.tipo_canal === 'interno' && conv.canal_interno_id) {
          // Actualizar ultimo_mensaje en el canal interno (para orden en sidebar)
          await admin
            .from('canales_internos')
            .update({
              ultimo_mensaje_texto: texto || `[${tipo_contenido}]`,
              ultimo_mensaje_en: new Date().toISOString(),
              ultimo_mensaje_por: user.id,
            })
            .eq('id', conv.canal_interno_id)

          // Canal interno: notificar a los miembros del canal (excepto el remitente)
          const { data: miembrosCanal } = await admin
            .from('canal_interno_miembros')
            .select('usuario_id, silenciado')
            .eq('canal_id', conv.canal_interno_id)
            .neq('usuario_id', user.id)

          // Filtrar miembros silenciados — no reciben notificaciones
          const miembrosActivos = (miembrosCanal || []).filter(m => !m.silenciado)
          if (miembrosActivos.length > 0) {
            const { crearNotificacionesBatch } = await import('@/lib/notificaciones')
            await crearNotificacionesBatch(
              miembrosActivos.map((m) => ({
                empresaId,
                usuarioId: m.usuario_id,
                tipo: 'mensaje_interno',
                titulo: `💬 ${nombreRemitente} en ${conv.contacto_nombre || 'canal interno'}`,
                cuerpo: (texto || '').slice(0, 120),
                icono: 'MessageSquare',
                color: 'var(--canal-interno)',
                url: `/inbox?conv=${conversacion_id}&tab=interno`,
                referenciaTipo: 'conversacion',
                referenciaId: conversacion_id,
              }))
            )
          }
        }
      } catch {
        // No bloquear el envío del mensaje
      }
    }

    return NextResponse.json({ mensaje }, { status: 201 })
  } catch (err) {
    console.error('Error al enviar mensaje:', err)
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 })
  }
}

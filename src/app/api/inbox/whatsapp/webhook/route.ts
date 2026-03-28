import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  mapearTipoContenido, extraerTextoMensaje, textoPreviewMensaje,
  extraerMediaId, extraerMimeType, extraerNombreArchivo,
  obtenerUrlMedia, descargarMediaBuffer, verificarFirmaWebhook,
  type WebhookPayloadMeta, type MensajeEntranteMeta, type EstadoMensajeMeta,
} from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// Cliente admin inline — el webhook es público, no pasa por auth
function crearAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * GET /api/inbox/whatsapp/webhook — Verificación del webhook de Meta.
 * Meta envía un GET con hub.challenge para verificar el endpoint.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  // Validar parámetros básicos
  if (mode !== 'subscribe' || !token || !challenge) {
    return new Response('Parámetros inválidos', { status: 400 })
  }

  try {
    // Buscar la cuenta que tiene este token de verificación
    const admin = crearAdmin()
    const { data: canales, error } = await admin
      .from('canales_inbox')
      .select('id, config_conexion')
      .eq('tipo', 'whatsapp')

    if (error) {
      console.error('Error consultando canales:', error)
      // Si la BD falla, igual verificar — Meta necesita el challenge
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    // Verificar token manualmente
    const canalValido = canales?.find((c) => {
      const cfg = c.config_conexion as Record<string, unknown>
      return cfg?.tokenVerificacion === token
    })

    if (!canalValido) {
      console.error('Webhook verification: token no encontrado', { token })
      return new Response('Token inválido', { status: 403 })
    }

    // Meta espera el challenge como texto plano
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (err) {
    console.error('Error en verificación de webhook:', err)
    // Ante cualquier error, devolver el challenge para no bloquear la verificación
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
}

/**
 * POST /api/inbox/whatsapp/webhook — Recibir mensajes entrantes y actualizaciones de estado.
 * Meta envía mensajes, estados de entrega y actualizaciones de plantillas.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const payload: WebhookPayloadMeta = JSON.parse(rawBody)

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Objeto no soportado' }, { status: 400 })
    }

    const admin = crearAdmin()

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value

        // Identificar la cuenta por phone_number_id
        if (change.field === 'messages' && value.metadata) {
          const phoneNumberId = value.metadata.phone_number_id

          // Buscar canal por phoneNumberId
          const { data: canal } = await admin
            .from('canales_inbox')
            .select('id, empresa_id, config_conexion')
            .eq('tipo', 'whatsapp')
            .contains('config_conexion', { phoneNumberId })
            .limit(1)
            .single()

          if (!canal) {
            console.warn(`Canal no encontrado para phoneNumberId: ${phoneNumberId}`)
            continue
          }

          // Verificar firma HMAC si hay secreto configurado
          const secreto = (canal.config_conexion as Record<string, string>)?.secretoWebhook
          if (secreto) {
            const firma = request.headers.get('x-hub-signature-256') || ''
            const valida = await verificarFirmaWebhook(secreto, rawBody, firma)
            if (!valida) {
              console.warn('Firma de webhook inválida')
              return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })
            }
          }

          // Procesar mensajes entrantes
          if (value.messages) {
            for (const msg of value.messages) {
              const contactoMeta = value.contacts?.[0]
              await procesarMensajeEntrante(admin, canal, msg, contactoMeta)
            }
          }

          // Procesar actualizaciones de estado (sent, delivered, read)
          if (value.statuses) {
            for (const estado of value.statuses) {
              await procesarEstadoMensaje(admin, canal, estado)
            }
          }
        }

        // Actualizaciones de plantillas
        if (change.field === 'message_template_status_update') {
          await procesarEstadoPlantilla(admin, value)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en webhook WhatsApp:', err)
    return NextResponse.json({ ok: true }) // Siempre devolver 200 a Meta
  }
}

// ─── Procesar mensaje entrante ───

async function procesarMensajeEntrante(
  admin: ReturnType<typeof crearAdmin>,
  canal: { id: string; empresa_id: string; config_conexion: unknown },
  msg: MensajeEntranteMeta,
  contactoMeta?: { profile: { name: string }; wa_id: string },
) {
  const telefonoRemitente = msg.from
  const nombreRemitente = contactoMeta?.profile?.name || telefonoRemitente

  // Buscar o crear conversación
  let { data: conversacion } = await admin
    .from('conversaciones')
    .select('id, contacto_id')
    .eq('empresa_id', canal.empresa_id)
    .eq('canal_id', canal.id)
    .eq('identificador_externo', telefonoRemitente)
    .neq('estado', 'resuelta')
    .order('creado_en', { ascending: false })
    .limit(1)
    .single()

  if (!conversacion) {
    // Intentar vincular con contacto existente por WhatsApp
    const { data: contacto } = await admin
      .from('contactos')
      .select('id, nombre, apellido')
      .eq('empresa_id', canal.empresa_id)
      .or(`whatsapp.eq.${telefonoRemitente},telefono.eq.${telefonoRemitente}`)
      .limit(1)
      .single()

    const contactoNombre = contacto
      ? `${contacto.nombre} ${contacto.apellido || ''}`.trim()
      : nombreRemitente

    const { data: nuevaConv } = await admin
      .from('conversaciones')
      .insert({
        empresa_id: canal.empresa_id,
        canal_id: canal.id,
        tipo_canal: 'whatsapp',
        identificador_externo: telefonoRemitente,
        contacto_id: contacto?.id || null,
        contacto_nombre: contactoNombre,
        estado: 'abierta',
      })
      .select('id, contacto_id')
      .single()

    conversacion = nuevaConv
  }

  if (!conversacion) return

  // Insertar mensaje
  const tipoContenido = mapearTipoContenido(msg.type)
  const texto = extraerTextoMensaje(msg)

  const { data: mensajeInsertado } = await admin
    .from('mensajes')
    .insert({
      empresa_id: canal.empresa_id,
      conversacion_id: conversacion.id,
      es_entrante: true,
      remitente_tipo: 'contacto',
      remitente_nombre: nombreRemitente,
      tipo_contenido: tipoContenido,
      texto,
      wa_message_id: msg.id,
      wa_tipo_mensaje: msg.type,
      estado: 'enviado',
      metadata: msg,
    })
    .select('id')
    .single()

  // Actualizar conversación con preview descriptivo
  const preview = textoPreviewMensaje(msg)
  await admin
    .from('conversaciones')
    .update({
      ultimo_mensaje_texto: preview,
      ultimo_mensaje_en: new Date().toISOString(),
      ultimo_mensaje_es_entrante: true,
      mensajes_sin_leer: 1,
      tiempo_sin_respuesta_desde: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', conversacion.id)

  // Si tiene media, descargar ANTES de terminar (Vercel serverless corta el background)
  const mediaId = extraerMediaId(msg)
  if (mediaId && mensajeInsertado) {
    try {
      await descargarYGuardarMedia(admin, canal, msg, mensajeInsertado.id)
    } catch (err) {
      console.error('Error descargando media:', err)
    }
  }
}

// ─── Descargar media y guardar en Storage ───

async function descargarYGuardarMedia(
  admin: ReturnType<typeof crearAdmin>,
  canal: { id: string; empresa_id: string; config_conexion: unknown },
  msg: MensajeEntranteMeta,
  mensajeId: string,
) {
  const mediaId = extraerMediaId(msg)
  if (!mediaId) return

  const tokenAcceso = (canal.config_conexion as Record<string, string>)?.tokenAcceso
  if (!tokenAcceso) return

  try {
    console.log(`[MEDIA] Descargando ${msg.type} mediaId=${mediaId}`)
    // Obtener URL temporal de Meta
    const mediaInfo = await obtenerUrlMedia(mediaId, tokenAcceso)
    console.log(`[MEDIA] URL obtenida, size=${mediaInfo.file_size}`)

    // Descargar el archivo
    const { buffer, contentType } = await descargarMediaBuffer(mediaInfo.url, tokenAcceso)

    // Convertir ArrayBuffer a Uint8Array (compatible con Supabase Storage en edge)
    const bytes = new Uint8Array(buffer)

    // Subir a Supabase Storage
    const nombreArchivo = extraerNombreArchivo(msg)
    const storagePath = `inbox/${canal.empresa_id}/whatsapp/${mensajeId}/${nombreArchivo}`

    const { error: uploadError } = await admin.storage
      .from('adjuntos')
      .upload(storagePath, bytes, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      console.error('[MEDIA] Error subiendo a Storage:', JSON.stringify(uploadError))
      return
    }
    console.log(`[MEDIA] Subido OK: ${storagePath}`)

    // Obtener URL pública
    const { data: urlData } = admin.storage
      .from('adjuntos')
      .getPublicUrl(storagePath)

    // Insertar adjunto
    await admin.from('mensaje_adjuntos').insert({
      mensaje_id: mensajeId,
      empresa_id: canal.empresa_id,
      nombre_archivo: nombreArchivo,
      tipo_mime: extraerMimeType(msg),
      tamano_bytes: mediaInfo.file_size || buffer.byteLength,
      url: urlData.publicUrl,
      storage_path: storagePath,
      es_sticker: msg.type === 'sticker',
      es_animado: msg.sticker?.animated || false,
    })
  } catch (err) {
    console.error('Error procesando media:', err)
  }
}

// ─── Procesar estado de mensaje (sent/delivered/read) ───

async function procesarEstadoMensaje(
  admin: ReturnType<typeof crearAdmin>,
  canal: { id: string; empresa_id: string },
  estado: EstadoMensajeMeta,
) {
  const mapaEstado: Record<string, string> = {
    sent: 'enviado',
    delivered: 'entregado',
    read: 'leido',
    failed: 'fallido',
  }

  const nuevoEstado = mapaEstado[estado.status]
  if (!nuevoEstado) return

  await admin
    .from('mensajes')
    .update({
      wa_status: estado.status,
      estado: nuevoEstado,
      ...(estado.errors ? { error_envio: estado.errors[0]?.title } : {}),
    })
    .eq('wa_message_id', estado.id)
    .eq('empresa_id', canal.empresa_id)
}

// ─── Procesar actualización de estado de plantilla ───

async function procesarEstadoPlantilla(
  admin: ReturnType<typeof crearAdmin>,
  value: Record<string, unknown>,
) {
  const nombreApi = value.message_template_name as string
  const evento = value.event as string
  const razon = (value.reason || value.rejected_reason || '') as string

  if (!nombreApi || !evento) return

  // Mapear evento a estado local
  const mapaEstado: Record<string, string> = {
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    DISABLED: 'DISABLED',
    PENDING_DELETION: 'DISABLED',
  }

  const nuevoEstado = mapaEstado[evento]
  if (!nuevoEstado) return

  // Actualizar en todas las empresas que tengan esta plantilla
  // (Meta envía por WABA, no por empresa)
  await admin
    .from('plantillas_respuesta')
    .update({
      activo: nuevoEstado === 'APPROVED',
      actualizado_en: new Date().toISOString(),
    })
    .eq('canal', 'whatsapp')
    .ilike('contenido', `%${nombreApi}%`)
}

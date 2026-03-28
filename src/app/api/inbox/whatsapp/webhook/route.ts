import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  mapearTipoContenido, extraerTextoMensaje, textoPreviewMensaje,
  extraerMediaId, extraerMimeType, extraerNombreArchivo,
  obtenerUrlMedia, descargarMediaBuffer, verificarFirmaWebhook,
  enviarTextoWhatsApp,
  type WebhookPayloadMeta, type MensajeEntranteMeta, type EstadoMensajeMeta,
  type ConfigCuentaWhatsApp,
} from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Necesario para descargar archivos grandes de Meta

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

  // Buscar conversación existente (abierta o en espera)
  let esConversacionNueva = false
  let { data: conversacion } = await admin
    .from('conversaciones')
    .select('id, contacto_id, estado')
    .eq('empresa_id', canal.empresa_id)
    .eq('canal_id', canal.id)
    .eq('identificador_externo', telefonoRemitente)
    .in('estado', ['abierta', 'en_espera'])
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Si no hay abierta, buscar la más reciente resuelta y reabrirla
  if (!conversacion) {
    console.log('[WEBHOOK v2] No hay conversación abierta, buscando resuelta para reabrir...')
    const { data: resuelta, error: errResuelta } = await admin
      .from('conversaciones')
      .select('id, contacto_id, estado')
      .eq('empresa_id', canal.empresa_id)
      .eq('canal_id', canal.id)
      .eq('identificador_externo', telefonoRemitente)
      .eq('estado', 'resuelta')
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log('[WEBHOOK v2] Resuelta encontrada:', resuelta?.id, 'Error:', errResuelta?.message)

    if (resuelta) {
      // Reabrir la conversación resuelta
      await admin
        .from('conversaciones')
        .update({
          estado: 'abierta',
          cerrado_en: null,
          cerrado_por: null,
          chatbot_activo: true,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', resuelta.id)
      conversacion = resuelta
    }
  }

  if (!conversacion) {
    // Intentar vincular con contacto existente por WhatsApp
    let { data: contacto } = await admin
      .from('contactos')
      .select('id, nombre, apellido')
      .eq('empresa_id', canal.empresa_id)
      .eq('en_papelera', false)
      .or(`whatsapp.eq.${telefonoRemitente},telefono.eq.${telefonoRemitente}`)
      .limit(1)
      .single()

    // Si no existe contacto, crear uno provisorio automáticamente
    if (!contacto) {
      contacto = await crearContactoProvisorio(admin, canal.empresa_id, nombreRemitente, telefonoRemitente)
    }

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
      .select('id, contacto_id, estado')
      .single()

    conversacion = nuevaConv
    esConversacionNueva = true

    // Asignación automática de agente a la nueva conversación
    if (nuevaConv) {
      await asignarAgenteAutomatico(admin, canal.empresa_id, canal.id, nuevaConv.id)
    }
  } else if (!conversacion.contacto_id) {
    // Conversación existente sin contacto vinculado (fue eliminado)
    // → buscar o crear provisorio y vincular
    let { data: contacto } = await admin
      .from('contactos')
      .select('id, nombre, apellido')
      .eq('empresa_id', canal.empresa_id)
      .eq('en_papelera', false)
      .or(`whatsapp.eq.${telefonoRemitente},telefono.eq.${telefonoRemitente}`)
      .limit(1)
      .single()

    if (!contacto) {
      contacto = await crearContactoProvisorio(admin, canal.empresa_id, nombreRemitente, telefonoRemitente)
    }

    if (contacto) {
      const contactoNombre = `${contacto.nombre} ${contacto.apellido || ''}`.trim()
      await admin
        .from('conversaciones')
        .update({
          contacto_id: contacto.id,
          contacto_nombre: contactoNombre,
        })
        .eq('id', conversacion.id)
    }
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

  // ─── SLA: calcular vencimiento de primera respuesta para conversaciones nuevas ───
  if (esConversacionNueva) {
    try {
      // Obtener config de SLA de la empresa
      const { data: configInbox } = await admin
        .from('config_inbox')
        .select('sla_primera_respuesta_minutos')
        .eq('empresa_id', canal.empresa_id)
        .limit(1)
        .single()

      if (configInbox?.sla_primera_respuesta_minutos) {
        const ahora = new Date()
        const venceEn = new Date(ahora.getTime() + configInbox.sla_primera_respuesta_minutos * 60 * 1000)
        await admin
          .from('conversaciones')
          .update({ sla_primera_respuesta_vence_en: venceEn.toISOString() })
          .eq('id', conversacion.id)
      }
    } catch (err) {
      // Si las columnas no existen aún, falla silenciosamente
      console.warn('[SLA] Error calculando SLA primera respuesta:', err)
    }
  }

  // ─── Chatbot: respuestas automáticas ───
  try {
    await procesarChatbot(admin, canal, conversacion.id, telefonoRemitente, texto, esConversacionNueva)
  } catch (err) {
    console.warn('[CHATBOT] Error:', err)
  }

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

// ─── Asignación automática de agente ───

/**
 * Verifica si la empresa tiene asignación automática habilitada y, de ser así,
 * selecciona un agente según el algoritmo configurado (round_robin o por_carga)
 * y actualiza la conversación con el agente asignado.
 */
async function asignarAgenteAutomatico(
  admin: ReturnType<typeof crearAdmin>,
  empresaId: string,
  canalId: string,
  conversacionId: string,
) {
  try {
    // 1. Consultar config_inbox para verificar si la asignación automática está habilitada
    const { data: config } = await admin
      .from('config_inbox')
      .select('asignacion_automatica, algoritmo_asignacion')
      .eq('empresa_id', empresaId)
      .limit(1)
      .single()

    if (!config?.asignacion_automatica) return

    const algoritmo: string = config.algoritmo_asignacion || 'round_robin'

    // 2. Obtener la lista de agentes disponibles para este canal
    const agentes = await obtenerAgentesDisponibles(admin, empresaId, canalId)
    if (!agentes || agentes.length === 0) return

    // 3. Seleccionar agente según el algoritmo configurado
    let agenteSeleccionado: { id: string; nombre: string } | null = null

    if (algoritmo === 'por_carga') {
      agenteSeleccionado = await seleccionarPorCarga(admin, empresaId, agentes)
    } else {
      // round_robin por defecto
      agenteSeleccionado = await seleccionarRoundRobin(admin, empresaId, agentes)
    }

    if (!agenteSeleccionado) return

    // 4. Actualizar la conversación con el agente asignado
    await admin
      .from('conversaciones')
      .update({
        asignado_a: agenteSeleccionado.id,
        asignado_a_nombre: agenteSeleccionado.nombre,
      })
      .eq('id', conversacionId)

    console.log(
      `[ASIGNACIÓN] Conversación ${conversacionId} asignada a ${agenteSeleccionado.nombre} (${algoritmo})`
    )
  } catch (err) {
    // Si falla la asignación, la conversación queda sin asignar — no es crítico
    console.error('[ASIGNACIÓN] Error asignando agente automáticamente:', err)
  }
}

/**
 * Obtiene los agentes disponibles para un canal. Primero intenta buscar en
 * canal_agentes_asignados (agentes específicos del canal), y si no existe
 * o está vacía, usa todos los usuarios de la empresa como fallback.
 */
async function obtenerAgentesDisponibles(
  admin: ReturnType<typeof crearAdmin>,
  empresaId: string,
  canalId: string,
): Promise<{ id: string; nombre: string }[]> {
  // Intentar obtener agentes asignados específicamente al canal
  const { data: agentesCanal, error: errorCanal } = await admin
    .from('canal_agentes_asignados')
    .select('usuario_id, usuario_nombre')
    .eq('canal_id', canalId)
    .eq('empresa_id', empresaId)

  // Si la tabla existe y tiene registros, usar esos agentes
  if (!errorCanal && agentesCanal && agentesCanal.length > 0) {
    return agentesCanal.map((a) => ({
      id: a.usuario_id,
      nombre: a.usuario_nombre || 'Agente',
    }))
  }

  // Fallback: obtener todos los usuarios de la empresa
  const { data: usuarios } = await admin
    .from('usuarios_empresa')
    .select('usuario_id, nombre, apellido')
    .eq('empresa_id', empresaId)

  if (!usuarios || usuarios.length === 0) return []

  return usuarios.map((u) => ({
    id: u.usuario_id,
    nombre: `${u.nombre || ''} ${u.apellido || ''}`.trim() || 'Agente',
  }))
}

/**
 * Round Robin: selecciona el agente que fue asignado menos recientemente.
 * Busca la última asignación de cada agente y elige el que lleva más tiempo
 * sin recibir una conversación, o el que nunca ha sido asignado.
 */
async function seleccionarRoundRobin(
  admin: ReturnType<typeof crearAdmin>,
  empresaId: string,
  agentes: { id: string; nombre: string }[],
): Promise<{ id: string; nombre: string } | null> {
  if (agentes.length === 0) return null

  // Obtener las últimas asignaciones ordenadas por fecha descendente
  const idsAgentes = agentes.map((a) => a.id)
  const { data: ultimasAsignaciones } = await admin
    .from('conversaciones')
    .select('asignado_a, creado_en')
    .eq('empresa_id', empresaId)
    .in('asignado_a', idsAgentes)
    .order('creado_en', { ascending: false })

  // Construir mapa: para cada agente, guardar solo su asignación más reciente
  const ultimaAsignacion = new Map<string, string>()
  for (const conv of ultimasAsignaciones || []) {
    if (conv.asignado_a && !ultimaAsignacion.has(conv.asignado_a)) {
      ultimaAsignacion.set(conv.asignado_a, conv.creado_en)
    }
  }

  // Priorizar agentes sin asignaciones previas, luego por fecha más antigua
  const agentesOrdenados = [...agentes].sort((a, b) => {
    const fechaA = ultimaAsignacion.get(a.id)
    const fechaB = ultimaAsignacion.get(b.id)

    // Sin asignación previa va primero
    if (!fechaA && fechaB) return -1
    if (fechaA && !fechaB) return 1
    if (!fechaA && !fechaB) return 0

    // El que tiene la asignación más antigua va primero
    return fechaA!.localeCompare(fechaB!)
  })

  return agentesOrdenados[0]
}

/**
 * Por carga: selecciona el agente con menos conversaciones abiertas actualmente.
 * Cuenta conversaciones con estado 'abierta' agrupadas por agente asignado.
 */
async function seleccionarPorCarga(
  admin: ReturnType<typeof crearAdmin>,
  empresaId: string,
  agentes: { id: string; nombre: string }[],
): Promise<{ id: string; nombre: string } | null> {
  if (agentes.length === 0) return null

  // Obtener todas las conversaciones abiertas asignadas a estos agentes
  const idsAgentes = agentes.map((a) => a.id)
  const { data: conversacionesAbiertas } = await admin
    .from('conversaciones')
    .select('asignado_a')
    .eq('empresa_id', empresaId)
    .eq('estado', 'abierta')
    .in('asignado_a', idsAgentes)

  // Contar conversaciones por agente (inicializar todos en 0)
  const conteo = new Map<string, number>()
  for (const agente of agentes) {
    conteo.set(agente.id, 0)
  }
  for (const conv of conversacionesAbiertas || []) {
    if (conv.asignado_a) {
      conteo.set(conv.asignado_a, (conteo.get(conv.asignado_a) || 0) + 1)
    }
  }

  // Seleccionar el agente con menor carga
  const agentesOrdenados = [...agentes].sort((a, b) => {
    return (conteo.get(a.id) || 0) - (conteo.get(b.id) || 0)
  })

  return agentesOrdenados[0]
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

// ─── Crear contacto provisorio cuando llega un número desconocido ───

async function crearContactoProvisorio(
  admin: ReturnType<typeof crearAdmin>,
  empresaId: string,
  nombreWhatsApp: string,
  telefono: string,
): Promise<{ id: string; nombre: string; apellido: string | null } | null> {
  try {
    // Separar nombre y apellido del perfil de WhatsApp
    const partes = nombreWhatsApp.trim().split(/\s+/)
    // Limpiar emojis del nombre para el registro
    const limpiarEmojis = (t: string) => t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').trim()
    const nombre = limpiarEmojis(partes[0]) || telefono
    const apellido = partes.length > 1 ? limpiarEmojis(partes.slice(1).join(' ')) || null : null

    // Buscar tipo de contacto "Persona" para esta empresa (o el primero disponible)
    const { data: tipos } = await admin
      .from('tipos_contacto')
      .select('id, etiqueta')
      .eq('empresa_id', empresaId)
      .order('etiqueta')

    // Priorizar "Lead" para contactos provisorios de WhatsApp
    const tipoPersona = tipos?.find(t => t.etiqueta.toLowerCase() === 'lead')
      || tipos?.find(t => t.etiqueta.toLowerCase() === 'persona')
      || tipos?.[0]

    if (!tipoPersona) {
      console.warn('[PROVISORIO] No hay tipos de contacto configurados para la empresa')
      return null
    }

    const { data: nuevoContacto, error } = await admin
      .from('contactos')
      .insert({
        empresa_id: empresaId,
        nombre,
        apellido,
        whatsapp: telefono,
        telefono,
        tipo_contacto_id: tipoPersona.id,
        origen: 'whatsapp',
        es_provisorio: true,
        activo: true,
        codigo: null, // Sin código hasta que un agente lo acepte
        creado_por: '00000000-0000-0000-0000-000000000000', // Sistema
      })
      .select('id, nombre, apellido')
      .single()

    if (error) {
      console.error('[PROVISORIO] Error creando contacto:', error)
      return null
    }

    console.log(`[PROVISORIO] Contacto creado: ${nombre} ${apellido || ''} (${telefono})`)
    return nuevoContacto
  } catch (err) {
    console.error('[PROVISORIO] Error inesperado:', err)
    return null
  }
}

// ─── Utilidad: verificar si estamos fuera del horario de atención ───

function esFueraDeHorario(
  horaInicio?: string | null,
  horaFin?: string | null,
): boolean {
  // Si no hay horario configurado, no estamos "fuera de horario"
  if (!horaInicio || !horaFin) return false

  const ahora = new Date()
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes() // minutos desde medianoche

  const [inicioH, inicioM] = horaInicio.split(':').map(Number)
  const [finH, finM] = horaFin.split(':').map(Number)

  const inicioMinutos = inicioH * 60 + inicioM
  const finMinutos = finH * 60 + finM

  // Si el horario no cruza medianoche (ej: 09:00 - 18:00)
  if (inicioMinutos <= finMinutos) {
    return horaActual < inicioMinutos || horaActual >= finMinutos
  }

  // Si el horario cruza medianoche (ej: 22:00 - 06:00) — fuera = entre fin e inicio
  return horaActual >= finMinutos && horaActual < inicioMinutos
}

// ─── Chatbot: respuestas automáticas ───

interface OpcionMenuBot {
  numero: string
  etiqueta: string
  respuesta: string
}

interface PalabraClaveBot {
  palabras: string[]
  respuesta: string
  exacta: boolean
}

/**
 * Procesa la lógica del chatbot: bienvenida, menú, palabras clave, transferencia.
 * Solo responde si:
 * - El chatbot está activo para la empresa
 * - La conversación tiene chatbot_activo = true (no fue transferida a agente)
 * - Si modo = 'fuera_horario', solo responde fuera de horario
 */
async function procesarChatbot(
  admin: ReturnType<typeof crearAdmin>,
  canal: { id: string; empresa_id: string; config_conexion: unknown },
  conversacionId: string,
  telefono: string,
  textoCliente: string,
  esConversacionNueva: boolean,
) {
  // 1. Obtener config del chatbot
  const { data: configBot } = await admin
    .from('config_chatbot')
    .select('*')
    .eq('empresa_id', canal.empresa_id)
    .single()

  if (!configBot?.activo) return

  // 2. Verificar si la conversación tiene el bot activo
  const { data: conv } = await admin
    .from('conversaciones')
    .select('chatbot_activo')
    .eq('id', conversacionId)
    .single()

  if (!conv?.chatbot_activo) return

  // 3. Si modo fuera_horario, verificar horario
  if (configBot.modo === 'fuera_horario') {
    const { data: configInbox } = await admin
      .from('config_inbox')
      .select('horario_atencion_inicio, horario_atencion_fin')
      .eq('empresa_id', canal.empresa_id)
      .single()

    if (configInbox) {
      const fuera = esFueraDeHorario(configInbox.horario_atencion_inicio, configInbox.horario_atencion_fin)
      if (!fuera) return // En horario → no responde el bot
    }
  }

  const configConexion = canal.config_conexion as unknown as ConfigCuentaWhatsApp
  const textoNormalizado = textoCliente.trim().toLowerCase()

  // Helper: enviar mensaje del bot y registrarlo en BD
  const enviarRespuestaBot = async (mensaje: string) => {
    await enviarTextoWhatsApp(configConexion, telefono, mensaje)
    await admin.from('mensajes').insert({
      empresa_id: canal.empresa_id,
      conversacion_id: conversacionId,
      es_entrante: false,
      remitente_tipo: 'bot',
      remitente_nombre: 'Chatbot',
      tipo_contenido: 'texto',
      texto: mensaje,
      estado: 'enviado',
    })
  }

  // 4. Transferencia a agente
  if (configBot.palabra_transferir && textoNormalizado.includes(configBot.palabra_transferir.toLowerCase())) {
    // Desactivar bot en esta conversación
    await admin.from('conversaciones').update({ chatbot_activo: false }).eq('id', conversacionId)

    if (configBot.mensaje_transferencia) {
      await enviarRespuestaBot(configBot.mensaje_transferencia)
    }

    // Asignar agente automáticamente
    await asignarAgenteAutomatico(admin, canal.empresa_id, canal.id, conversacionId)
    return
  }

  // 5. Bienvenida — según frecuencia configurada
  if (configBot.bienvenida_activa && configBot.mensaje_bienvenida) {
    const frecuencia = configBot.bienvenida_frecuencia || 'dias_sin_contacto'
    let enviarBienvenida = false

    if (frecuencia === 'siempre') {
      // Siempre que escribe, verificar que no sea un mensaje seguido (evitar spam)
      const { data: ultimoBot } = await admin
        .from('mensajes')
        .select('creado_en')
        .eq('conversacion_id', conversacionId)
        .eq('remitente_tipo', 'bot')
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Solo enviar si no hubo mensaje del bot en los últimos 5 minutos
      if (!ultimoBot || Date.now() - new Date(ultimoBot.creado_en).getTime() > 5 * 60 * 1000) {
        enviarBienvenida = true
      }
    } else if (frecuencia === 'primera_vez') {
      enviarBienvenida = esConversacionNueva
    } else {
      // dias_sin_contacto: enviar si la conversación es nueva O si el último mensaje tiene más de X días
      if (esConversacionNueva) {
        enviarBienvenida = true
      } else {
        const dias = configBot.bienvenida_dias_sin_contacto || 30
        const { data: ultimoMsg } = await admin
          .from('mensajes')
          .select('creado_en')
          .eq('conversacion_id', conversacionId)
          .order('creado_en', { ascending: false })
          .range(1, 1) // Saltear el mensaje actual (recién insertado)
          .maybeSingle()

        if (!ultimoMsg || Date.now() - new Date(ultimoMsg.creado_en).getTime() > dias * 24 * 60 * 60 * 1000) {
          enviarBienvenida = true
        }
      }
    }

    if (enviarBienvenida) {
      await enviarRespuestaBot(configBot.mensaje_bienvenida)

      if (configBot.menu_activo && configBot.mensaje_menu) {
        await enviarRespuestaBot(configBot.mensaje_menu)
      }
      return
    }
  }

  // 6. Menú: si escribe "menu" o un número de opción
  if (configBot.menu_activo) {
    // Si escribe "menu", enviar el menú
    if (textoNormalizado === 'menu' || textoNormalizado === 'menú') {
      if (configBot.mensaje_menu) {
        await enviarRespuestaBot(configBot.mensaje_menu)
      }
      return
    }

    // Si escribe un número de opción
    const opciones = (configBot.opciones_menu || []) as OpcionMenuBot[]
    const opcionElegida = opciones.find(op => textoNormalizado === op.numero)
    if (opcionElegida) {
      // Si la opción no tiene respuesta, es transferencia a agente
      if (!opcionElegida.respuesta) {
        await admin.from('conversaciones').update({ chatbot_activo: false }).eq('id', conversacionId)
        if (configBot.mensaje_transferencia) {
          await enviarRespuestaBot(configBot.mensaje_transferencia)
        }
        await asignarAgenteAutomatico(admin, canal.empresa_id, canal.id, conversacionId)
        return
      }
      await enviarRespuestaBot(opcionElegida.respuesta)
      return
    }
  }

  // 7. Palabras clave
  const palabrasClave = (configBot.palabras_clave || []) as PalabraClaveBot[]
  for (const pc of palabrasClave) {
    const match = pc.exacta
      ? pc.palabras.some(p => textoNormalizado === p.toLowerCase())
      : pc.palabras.some(p => textoNormalizado.includes(p.toLowerCase()))

    if (match && pc.respuesta) {
      await enviarRespuestaBot(pc.respuesta)
      return
    }
  }

  // 8. Mensaje por defecto
  if (configBot.mensaje_defecto) {
    await enviarRespuestaBot(configBot.mensaje_defecto)
  }
}

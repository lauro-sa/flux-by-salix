/**
 * Procesador de mensajes de copilot vía WhatsApp.
 * Cuando un empleado escribe por WhatsApp, se activa Salix IA en vez del agente de clientes.
 *
 * Flujo: mensaje → transcribir audio (si aplica) → cargar historial → ejecutar pipeline → responder por WA.
 */

import { ejecutarSalixIA } from '@/lib/salix-ia/pipeline'
import { cargarConfigSalixIA } from '@/lib/salix-ia/contexto'
import { esMensajeCortesia } from '@/lib/salix-ia/es-cortesia'
import {
  asegurarConversacionEmpleado,
  registrarMensajeEmpleado,
} from '@/lib/conversaciones/empleados'
import type { MensajeSalixIA, MiembroSalixIA, SupabaseAdmin } from '@/tipos/salix-ia'

// Mensaje que reciben los empleados con Salix bloqueado (nivel='ninguno' o
// canal WA apagado) cuando mandan una consulta real (no cortesía). Garantiza
// que el empleado sepa que su mensaje fue recibido sin generar expectativa
// de respuesta inmediata — el admin contesta cuando pueda.
const MENSAJE_DERIVACION_ADMIN =
  'Hola 👋 Tu mensaje quedó registrado. Un administrador te va a responder en cuanto pueda.'

interface DatosEmpleado {
  miembro: MiembroSalixIA
  perfil: { nombre: string; apellido: string }
}

interface DatosCanal {
  id: string
  empresa_id: string
  config_conexion: Record<string, unknown>
}

interface MensajeWA {
  from: string
  id: string
  type: string
  text?: { body: string }
  audio?: { id: string; mime_type?: string }
  timestamp?: string
}

/**
 * Procesa un mensaje de WhatsApp de un empleado como Salix IA copilot.
 * @returns true si procesó el mensaje, false si debe seguir el flujo normal
 */
export async function procesarMensajeCopiloto(
  admin: SupabaseAdmin,
  canal: DatosCanal,
  msg: MensajeWA,
  empleado: DatosEmpleado,
  textoMensaje?: string
): Promise<boolean> {
  // Extraer texto del mensaje — transcribir audio si es necesario
  let texto = textoMensaje || msg.text?.body || ''

  if (!texto.trim() && msg.type === 'audio' && msg.audio?.id) {
    // Transcribir audio con Whisper
    texto = await transcribirAudioWA(admin, canal, msg.audio.id) || ''
    console.info(`[SALIX WA] Audio transcrito: "${texto.slice(0, 100)}"`)
  }

  if (!texto.trim()) {
    // Mensajes sin texto que no son audio (stickers, ubicaciones, etc.) — ignorar silenciosamente.
    // Retornar true para que no caiga a Valentina (es un empleado, no un cliente).
    return true
  }

  // ─── Conversación perpetua del empleado en la bandeja principal ───
  // Asegurar la conversación en `conversaciones` y registrar el mensaje entrante
  // ANTES de cualquier gate. Aún si Salix IA está apagada a nivel empresa o
  // para este miembro, el admin debe ver el mensaje en su inbox.
  const nombreEmpleado = `${empleado.perfil.nombre} ${empleado.perfil.apellido || ''}`.trim()
  const conversacionEmpleadoId = await asegurarConversacionEmpleado({
    admin,
    empresa_id: canal.empresa_id,
    miembro_id: empleado.miembro.id,
    tipo_canal: 'whatsapp',
    canal_id: canal.id,
    identificador_externo: msg.from,
    contacto_nombre: nombreEmpleado,
  })

  if (conversacionEmpleadoId) {
    await registrarMensajeEmpleado({
      admin,
      empresa_id: canal.empresa_id,
      conversacion_id: conversacionEmpleadoId,
      es_entrante: true,
      remitente_tipo: 'contacto',
      remitente_id: empleado.miembro.id,
      remitente_nombre: nombreEmpleado,
      texto,
      tipo_contenido: msg.type === 'audio' ? 'audio' : 'texto',
      wa_message_id: msg.id,
      estado: 'entregado',
    })
  }

  // Verificar que Salix IA y el copilot WhatsApp estén habilitados a nivel empresa.
  // Si están apagados, el mensaje ya quedó en la bandeja: el admin lo verá y
  // responderá manualmente. Retornamos true para que el webhook no caiga a Valentina.
  const config = await cargarConfigSalixIA(admin, canal.empresa_id)
  if (!config?.habilitado || !config?.whatsapp_copilot_habilitado) {
    return true
  }

  // ─── Gate de acceso: nivel_salix + canal WhatsApp ───
  // Este gate va DESPUÉS de registrar el mensaje entrante: el admin debe ver
  // siempre los mensajes del empleado en su inbox, aun si Salix está apagado.
  // Si está bloqueado:
  //   - Mensajes de cortesía ("gracias", "ok", "chao") → silencio total.
  //   - Consultas reales → respondemos derivando al admin y registramos esa
  //     respuesta en la conversación.
  // En ambos casos retornamos `true` para que el webhook no caiga a Valentina.
  const salixBloqueado = !empleado.miembro.salix_ia_whatsapp || empleado.miembro.nivel_salix === 'ninguno'
  if (salixBloqueado) {
    if (esMensajeCortesia(texto)) {
      console.info(`[SALIX WA] Empleado con Salix bloqueado mandó cortesía ("${texto.slice(0, 30)}"). Silencio.`)
      return true
    }
    console.info(`[SALIX WA] Empleado con Salix bloqueado mandó consulta. Derivando a admin.`)
    const waMessageId = await enviarRespuestaWA(canal, msg.from, MENSAJE_DERIVACION_ADMIN)
    if (conversacionEmpleadoId) {
      await registrarMensajeEmpleado({
        admin,
        empresa_id: canal.empresa_id,
        conversacion_id: conversacionEmpleadoId,
        es_entrante: false,
        remitente_tipo: 'sistema',
        remitente_nombre: 'Sistema',
        texto: MENSAJE_DERIVACION_ADMIN,
        wa_message_id: waMessageId,
        estado: waMessageId ? 'enviado' : 'fallido',
        error_envio: waMessageId ? null : 'No se obtuvo wa_message_id de Meta',
      })
    }
    return true
  }

  // ─── Conversación de contexto IA (JSONB diario) ───
  // No es duplicación: cada tabla tiene un propósito distinto.
  //   - `conversaciones` + `mensajes` (texto plano)  → bandeja del admin, tracking de
  //     status (sent/delivered/read), búsqueda, auditoría humana.
  //   - `conversaciones_salix_ia.mensajes` (JSONB)   → contexto del LLM, incluye
  //     bloques tool_use / tool_result que necesita Claude para razonar sobre
  //     herramientas ya ejecutadas. La tabla `mensajes` no soporta este formato
  //     porque guarda solo texto, así que el contexto IA vive aparte.
  // Si en el futuro se agrega `mensajes.metadata.contexto_ia` jsonb con los
  // bloques estructurados, esta tabla podría retirarse para WhatsApp también.
  const hoyInicio = new Date()
  hoyInicio.setHours(0, 0, 0, 0)

  let { data: conversacion } = await admin
    .from('conversaciones_salix_ia')
    .select('id, mensajes, actualizado_en')
    .eq('empresa_id', canal.empresa_id)
    .eq('usuario_id', empleado.miembro.usuario_id)
    .eq('canal', 'whatsapp')
    .gte('actualizado_en', hoyInicio.toISOString())
    .order('actualizado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  let convId = conversacion?.id
  const historial = (conversacion?.mensajes as MensajeSalixIA[] || [])

  // Ejecutar pipeline — SIEMPRE retornar true para que no caiga a Valentina
  try {
    const resultado = await ejecutarSalixIA({
      admin,
      empresa_id: canal.empresa_id,
      usuario_id: empleado.miembro.usuario_id,
      mensaje: texto,
      historial,
      conversacion_id: convId,
      canal: 'whatsapp',
    })

    // Persistir conversación legacy (JSONB)
    const nuevoHistorial = [...historial, ...resultado.mensajes_nuevos]

    if (convId) {
      await admin
        .from('conversaciones_salix_ia')
        .update({
          mensajes: nuevoHistorial,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', convId)
    } else {
      const { data: nueva } = await admin
        .from('conversaciones_salix_ia')
        .insert({
          empresa_id: canal.empresa_id,
          usuario_id: empleado.miembro.usuario_id,
          canal: 'whatsapp',
          titulo: texto.substring(0, 80),
          mensajes: nuevoHistorial,
        })
        .select('id')
        .single()

      convId = nueva?.id
    }

    // Enviar respuesta por WhatsApp y registrarla en la bandeja del empleado
    if (resultado.respuesta) {
      const waMessageId = await enviarRespuestaWA(canal, msg.from, resultado.respuesta)
      if (conversacionEmpleadoId) {
        await registrarMensajeEmpleado({
          admin,
          empresa_id: canal.empresa_id,
          conversacion_id: conversacionEmpleadoId,
          es_entrante: false,
          remitente_tipo: 'ia',
          remitente_nombre: 'Salix IA',
          texto: resultado.respuesta,
          wa_message_id: waMessageId,
          estado: waMessageId ? 'enviado' : 'fallido',
          error_envio: waMessageId ? null : 'No se obtuvo wa_message_id de Meta',
        })
      }
    }
  } catch (err) {
    // Si el pipeline falla, enviar mensaje de error al empleado por WA — NUNCA caer a Valentina
    console.error('[Salix IA WA] Error en pipeline:', err)
    const mensajeError = '⚠ _Salix IA no pudo procesar tu mensaje. Puede que no haya créditos en la API. Avisale al administrador._'
    const waMessageId = await enviarRespuestaWA(canal, msg.from, mensajeError)
    if (conversacionEmpleadoId) {
      await registrarMensajeEmpleado({
        admin,
        empresa_id: canal.empresa_id,
        conversacion_id: conversacionEmpleadoId,
        es_entrante: false,
        remitente_tipo: 'sistema',
        remitente_nombre: 'Salix IA',
        texto: mensajeError,
        wa_message_id: waMessageId,
        estado: waMessageId ? 'enviado' : 'fallido',
        error_envio: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return true // Siempre true — este número es un empleado, no un cliente
}

/**
 * Envía una respuesta por WhatsApp y devuelve el wa_message_id que asigna Meta
 * (necesario para el tracking de status sent/delivered/read en `mensajes`).
 * Devuelve null si el envío falló o si faltan credenciales.
 */
async function enviarRespuestaWA(
  canal: DatosCanal,
  destinatario: string,
  texto: string
): Promise<string | null> {
  const configConexion = canal.config_conexion as {
    tokenAcceso?: string
    phoneNumberId?: string
  }

  if (!configConexion?.tokenAcceso || !configConexion?.phoneNumberId) {
    return null
  }

  try {
    return await enviarTextoWhatsApp(
      configConexion.tokenAcceso,
      configConexion.phoneNumberId,
      destinatario,
      texto
    )
  } catch (err) {
    console.error('[Salix IA WA] Error enviando mensaje:', err)
    return null
  }
}

/** Transcribe un audio de WhatsApp usando Whisper (OpenAI) */
async function transcribirAudioWA(
  admin: SupabaseAdmin,
  canal: DatosCanal,
  mediaId: string
): Promise<string | null> {
  try {
    const configConexion = canal.config_conexion as { tokenAcceso?: string }
    const token = configConexion?.tokenAcceso
    if (!token) return null

    // 1. Obtener URL del audio desde Meta
    const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!mediaRes.ok) return null
    const mediaInfo = await mediaRes.json() as { url: string }

    // 2. Descargar el audio
    const audioRes = await fetch(mediaInfo.url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!audioRes.ok) return null
    const buffer = await audioRes.arrayBuffer()

    // 3. Obtener API key de OpenAI
    let apiKey = process.env.OPENAI_API_KEY || ''
    if (!apiKey) {
      const { data: configIA } = await admin
        .from('config_ia')
        .select('api_key_openai')
        .eq('empresa_id', canal.empresa_id)
        .single()
      apiKey = configIA?.api_key_openai || ''
    }
    if (!apiKey) return null

    // 4. Transcribir con Whisper
    const blob = new Blob([buffer], { type: 'audio/ogg' })
    const formData = new FormData()
    formData.append('file', blob, 'audio.ogg')
    formData.append('model', 'whisper-1')
    formData.append('language', 'es')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) return null
    const data = await whisperRes.json() as { text: string }
    return data.text?.trim() || null
  } catch (err) {
    console.error('[SALIX WA] Error transcribiendo audio:', err)
    return null
  }
}

/**
 * Envía un mensaje de texto simple por la API de Meta.
 * Retorna el wa_message_id asignado por Meta (o null si la respuesta no lo trae).
 */
async function enviarTextoWhatsApp(
  token: string,
  phoneNumberId: string,
  destinatario: string,
  texto: string
): Promise<string | null> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: destinatario,
      type: 'text',
      text: { body: texto },
    }),
  })

  if (!res.ok) return null
  try {
    const data = await res.json() as { messages?: { id: string }[] }
    return data.messages?.[0]?.id || null
  } catch {
    return null
  }
}

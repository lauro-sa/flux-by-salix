/**
 * Procesador de mensajes de copilot vía WhatsApp.
 * Cuando un empleado escribe por WhatsApp, se activa Salix IA en vez del agente de clientes.
 *
 * Flujo: mensaje → transcribir audio (si aplica) → cargar historial → ejecutar pipeline → responder por WA.
 */

import { ejecutarSalixIA } from '@/lib/salix-ia/pipeline'
import { cargarConfigSalixIA } from '@/lib/salix-ia/contexto'
import type { MensajeSalixIA, MiembroSalixIA, SupabaseAdmin } from '@/tipos/salix-ia'

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
  // Verificar que Salix IA y el copilot WhatsApp estén habilitados
  const config = await cargarConfigSalixIA(admin, canal.empresa_id)
  if (!config?.habilitado || !config?.whatsapp_copilot_habilitado) {
    return false
  }

  // Verificar que el miembro tenga Salix IA habilitado por WhatsApp (flag específico)
  if (!empleado.miembro.salix_ia_whatsapp) {
    return false
  }

  // Extraer texto del mensaje — transcribir audio si es necesario
  let texto = textoMensaje || msg.text?.body || ''

  if (!texto.trim() && msg.type === 'audio' && msg.audio?.id) {
    // Transcribir audio con Whisper
    texto = await transcribirAudioWA(admin, canal, msg.audio.id) || ''
    console.info(`[SALIX WA] Audio transcrito: "${texto.slice(0, 100)}"`)
  }

  if (!texto.trim()) {
    // Mensajes sin texto que no son audio (stickers, ubicaciones, etc.) — ignorar silenciosamente
    return true // Retornar true para que no caiga a Valentina
  }

  // Buscar conversación del día de hoy para este empleado vía WhatsApp.
  // Cada día se crea una conversación nueva — el contexto se mantiene durante todo el día.
  // Si necesita info de días anteriores, las herramientas de consulta la encuentran.
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

    // Persistir conversación
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

    // Enviar respuesta por WhatsApp
    if (resultado.respuesta) {
      await enviarRespuestaWA(canal, msg.from, resultado.respuesta)
    }
  } catch (err) {
    // Si el pipeline falla, enviar mensaje de error al empleado por WA — NUNCA caer a Valentina
    console.error('[Salix IA WA] Error en pipeline:', err)
    const mensajeError = '⚠ _Salix IA no pudo procesar tu mensaje. Puede que no haya créditos en la API. Avisale al administrador._'
    await enviarRespuestaWA(canal, msg.from, mensajeError)
  }

  return true // Siempre true — este número es un empleado, no un cliente
}

/** Helper para enviar respuesta por WhatsApp usando los datos del canal */
async function enviarRespuestaWA(
  canal: DatosCanal,
  destinatario: string,
  texto: string
): Promise<void> {
  const configConexion = canal.config_conexion as {
    tokenAcceso?: string
    phoneNumberId?: string
  }

  if (configConexion?.tokenAcceso && configConexion?.phoneNumberId) {
    try {
      await enviarTextoWhatsApp(
        configConexion.tokenAcceso,
        configConexion.phoneNumberId,
        destinatario,
        texto
      )
    } catch (err) {
      console.error('[Salix IA WA] Error enviando mensaje:', err)
    }
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

/** Envía un mensaje de texto simple por la API de Meta */
async function enviarTextoWhatsApp(
  token: string,
  phoneNumberId: string,
  destinatario: string,
  texto: string
): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`

  await fetch(url, {
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
}

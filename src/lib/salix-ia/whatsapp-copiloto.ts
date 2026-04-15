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

  // Verificar que el miembro tenga Salix IA habilitado
  if (!empleado.miembro.salix_ia_habilitado) {
    return false
  }

  // Extraer texto del mensaje (puede venir ya transcrito si es audio)
  const texto = textoMensaje || msg.text?.body || ''
  if (!texto.trim()) {
    return false // No procesar mensajes sin texto (stickers, ubicaciones, etc.)
  }

  // Buscar o crear conversación de Salix IA para este empleado via WhatsApp
  let { data: conversacion } = await admin
    .from('conversaciones_salix_ia')
    .select('id, mensajes')
    .eq('empresa_id', canal.empresa_id)
    .eq('usuario_id', empleado.miembro.usuario_id)
    .eq('canal', 'whatsapp')
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

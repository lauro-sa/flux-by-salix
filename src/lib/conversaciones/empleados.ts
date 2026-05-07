/**
 * Helpers para registrar conversaciones con empleados (miembros) en la
 * tabla principal `conversaciones` + `mensajes`.
 *
 * Una conversación con un empleado es perpetua: una sola fila en `conversaciones`
 * por (empresa_id, miembro_id, tipo_canal). Toda interacción —mensaje entrante
 * del empleado, respuesta de Salix IA, plantilla saliente de nómina, recordatorio—
 * se registra como un `mensaje` con su `wa_message_id` para que el tracking de
 * status (sent/delivered/read) funcione vía el webhook estándar.
 */

import type { SupabaseAdmin } from '@/tipos/salix-ia'

interface AsegurarConversacionParams {
  admin: SupabaseAdmin
  empresa_id: string
  miembro_id: string
  tipo_canal: 'whatsapp'
  canal_id: string | null
  identificador_externo: string | null
  contacto_nombre?: string | null
}

/**
 * Devuelve el id de la conversación perpetua del empleado para el canal indicado.
 * Si no existe, la crea. Si existe pero no tiene `canal_id`, lo actualiza.
 */
export async function asegurarConversacionEmpleado(
  params: AsegurarConversacionParams
): Promise<string | null> {
  const { admin, empresa_id, miembro_id, tipo_canal, canal_id, identificador_externo, contacto_nombre } = params

  const { data: existente } = await admin
    .from('conversaciones')
    .select('id, canal_id, identificador_externo')
    .eq('empresa_id', empresa_id)
    .eq('miembro_id', miembro_id)
    .eq('tipo_canal', tipo_canal)
    .maybeSingle()

  if (existente?.id) {
    // Sincronizar canal_id e identificador si llegamos a saberlo y faltaba.
    const updates: Record<string, unknown> = {}
    if (canal_id && !existente.canal_id) updates.canal_id = canal_id
    if (identificador_externo && existente.identificador_externo !== identificador_externo) {
      updates.identificador_externo = identificador_externo
    }
    if (Object.keys(updates).length > 0) {
      await admin.from('conversaciones').update(updates).eq('id', existente.id)
    }
    return existente.id
  }

  const { data: nueva, error } = await admin
    .from('conversaciones')
    .insert({
      empresa_id,
      tipo_canal,
      canal_id,
      miembro_id,
      identificador_externo,
      contacto_nombre: contacto_nombre || null,
      estado: 'abierta',
      // Conversaciones de empleados nunca deben gatillar al chatbot ni al
      // agente IA de clientes — la respuesta automática (si aplica) la maneja
      // el copiloto Salix IA, no el flujo de conversaciones con clientes.
      chatbot_activo: false,
      agente_ia_activo: false,
    })
    .select('id')
    .single()

  if (error || !nueva) {
    console.error('[conversaciones-empleado] Error creando conversación:', error?.message)
    return null
  }
  return nueva.id
}

interface RegistrarMensajeParams {
  admin: SupabaseAdmin
  empresa_id: string
  conversacion_id: string
  es_entrante: boolean
  remitente_tipo: 'contacto' | 'agente' | 'sistema' | 'ia'
  remitente_id?: string | null
  remitente_nombre?: string | null
  texto: string
  tipo_contenido?: 'texto' | 'imagen' | 'audio' | 'documento' | 'video' | 'sticker'
  wa_message_id?: string | null
  wa_status?: string | null
  plantilla_id?: string | null
  estado?: 'enviado' | 'entregado' | 'leído' | 'fallido'
  error_envio?: string | null
}

/**
 * Inserta un mensaje en `mensajes` y refresca el cache de la conversación
 * (último mensaje, tiene_mensaje_entrante, mensajes_sin_leer si aplica).
 * Retorna el id del mensaje insertado o null si falló.
 */
export async function registrarMensajeEmpleado(
  params: RegistrarMensajeParams
): Promise<string | null> {
  const {
    admin, empresa_id, conversacion_id, es_entrante, remitente_tipo,
    remitente_id, remitente_nombre, texto, tipo_contenido = 'texto',
    wa_message_id, wa_status, plantilla_id, estado = 'enviado', error_envio,
  } = params

  const ahora = new Date().toISOString()

  const { data: msg, error } = await admin
    .from('mensajes')
    .insert({
      empresa_id,
      conversacion_id,
      es_entrante,
      remitente_tipo,
      remitente_id: remitente_id || null,
      remitente_nombre: remitente_nombre || null,
      tipo_contenido,
      texto,
      wa_message_id: wa_message_id || null,
      wa_status: wa_status || null,
      plantilla_id: plantilla_id || null,
      estado,
      error_envio: error_envio || null,
      creado_en: ahora,
    })
    .select('id')
    .single()

  if (error || !msg) {
    console.error('[conversaciones-empleado] Error insertando mensaje:', error?.message)
    return null
  }

  // Refrescar cache en la conversación.
  // tiene_mensaje_entrante se vuelve true al primer entrante; nunca se baja.
  // mensajes_sin_leer: si estaba en -1 (marcado manual como leído), reinicia en 1; si no, incrementa.
  const updates: Record<string, unknown> = {
    ultimo_mensaje_texto: texto.slice(0, 500),
    ultimo_mensaje_en: ahora,
    ultimo_mensaje_es_entrante: es_entrante,
    actualizado_en: ahora,
  }
  if (es_entrante) {
    updates.tiene_mensaje_entrante = true
    const { data: convActual } = await admin
      .from('conversaciones')
      .select('mensajes_sin_leer')
      .eq('id', conversacion_id)
      .single()
    const noLeidos = convActual?.mensajes_sin_leer ?? 0
    updates.mensajes_sin_leer = noLeidos <= 0 ? 1 : noLeidos + 1
  }

  await admin.from('conversaciones').update(updates).eq('id', conversacion_id)
  return msg.id
}

/**
 * Pausa de automatizaciones de WhatsApp cuando responde un humano.
 *
 * Modos configurables por empresa (config_whatsapp):
 *  - 'siempre_activo' → nunca se pausa, el bot/IA responde siempre
 *  - 'manual'         → se pausa hasta que el humano lo reactive o se cierre la conversación
 *  - 'temporal'       → se pausa por N minutos tras la respuesta humana
 *
 * Se usa desde:
 *  - /api/whatsapp/enviar (cuando un agente humano manda un mensaje)
 *  - webhook (para decidir si reactivar una pausa temporal vencida)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ModoPausa = 'siempre_activo' | 'manual' | 'temporal'

export interface ConfigPausaEmpresa {
  pausa_chatbot_modo: ModoPausa
  pausa_chatbot_minutos: number | null
  pausa_agente_ia_modo: ModoPausa
  pausa_agente_ia_minutos: number | null
}

const DEFAULT_CONFIG: ConfigPausaEmpresa = {
  pausa_chatbot_modo: 'temporal',
  pausa_chatbot_minutos: 720,
  pausa_agente_ia_modo: 'temporal',
  pausa_agente_ia_minutos: 720,
}

/** Lee la config de pausa de la empresa, con defaults si no existe fila. */
export async function obtenerConfigPausa(
  admin: SupabaseClient,
  empresaId: string,
): Promise<ConfigPausaEmpresa> {
  const { data } = await admin
    .from('config_whatsapp')
    .select('pausa_chatbot_modo, pausa_chatbot_minutos, pausa_agente_ia_modo, pausa_agente_ia_minutos')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!data) return DEFAULT_CONFIG
  return {
    pausa_chatbot_modo: (data.pausa_chatbot_modo as ModoPausa) || DEFAULT_CONFIG.pausa_chatbot_modo,
    pausa_chatbot_minutos: data.pausa_chatbot_minutos ?? DEFAULT_CONFIG.pausa_chatbot_minutos,
    pausa_agente_ia_modo: (data.pausa_agente_ia_modo as ModoPausa) || DEFAULT_CONFIG.pausa_agente_ia_modo,
    pausa_agente_ia_minutos: data.pausa_agente_ia_minutos ?? DEFAULT_CONFIG.pausa_agente_ia_minutos,
  }
}

/**
 * Calcula los updates que deben aplicarse a la conversación cuando un humano envía un mensaje.
 * Devuelve un objeto parcial para concatenar al `.update({...})` de la conversación.
 * Si no hay cambios (modo 'siempre_activo' en ambos), devuelve {}.
 */
export function calcularPausaPorRespuestaHumana(config: ConfigPausaEmpresa): {
  chatbot_activo?: boolean
  chatbot_pausado_hasta?: string | null
  agente_ia_activo?: boolean
  ia_pausado_hasta?: string | null
} {
  const updates: ReturnType<typeof calcularPausaPorRespuestaHumana> = {}
  const ahora = new Date()

  // Chatbot
  if (config.pausa_chatbot_modo === 'manual') {
    updates.chatbot_activo = false
    updates.chatbot_pausado_hasta = null
  } else if (config.pausa_chatbot_modo === 'temporal') {
    const minutos = config.pausa_chatbot_minutos ?? 720
    const hasta = new Date(ahora.getTime() + minutos * 60_000)
    updates.chatbot_activo = false
    updates.chatbot_pausado_hasta = hasta.toISOString()
  }

  // Agente IA
  if (config.pausa_agente_ia_modo === 'manual') {
    updates.agente_ia_activo = false
    updates.ia_pausado_hasta = null
  } else if (config.pausa_agente_ia_modo === 'temporal') {
    const minutos = config.pausa_agente_ia_minutos ?? 720
    const hasta = new Date(ahora.getTime() + minutos * 60_000)
    updates.agente_ia_activo = false
    updates.ia_pausado_hasta = hasta.toISOString()
  }

  return updates
}

/**
 * Reactiva automatizaciones de una conversación si la pausa temporal ya venció.
 * Se llama al procesar un mensaje entrante, antes de decidir si corre el bot/IA.
 *
 * Devuelve los valores efectivos (post-reactivación) para que el webhook decida.
 */
export async function reactivarSiExpirada(
  admin: SupabaseClient,
  conversacionId: string,
  estado: {
    chatbot_activo: boolean
    chatbot_pausado_hasta: string | null
    agente_ia_activo: boolean | null
    ia_pausado_hasta: string | null
  },
): Promise<{ chatbot_activo: boolean; agente_ia_activo: boolean }> {
  const ahora = Date.now()
  const updates: Record<string, unknown> = {}

  let chatbotActivoFinal = estado.chatbot_activo
  let agenteIaActivoFinal = estado.agente_ia_activo ?? true

  // Si chatbot está pausado con timestamp futuro → sigue pausado
  // Si chatbot está pausado con timestamp vencido → reactivar
  // Si chatbot está pausado sin timestamp → pausa permanente, no reactivar
  if (!estado.chatbot_activo && estado.chatbot_pausado_hasta) {
    const hasta = new Date(estado.chatbot_pausado_hasta).getTime()
    if (ahora >= hasta) {
      updates.chatbot_activo = true
      updates.chatbot_pausado_hasta = null
      chatbotActivoFinal = true
    }
  }

  if (!agenteIaActivoFinal && estado.ia_pausado_hasta) {
    const hasta = new Date(estado.ia_pausado_hasta).getTime()
    if (ahora >= hasta) {
      updates.agente_ia_activo = true
      updates.ia_pausado_hasta = null
      agenteIaActivoFinal = true
    }
  }

  if (Object.keys(updates).length > 0) {
    await admin.from('conversaciones').update(updates).eq('id', conversacionId)
  }

  return { chatbot_activo: chatbotActivoFinal, agente_ia_activo: agenteIaActivoFinal }
}

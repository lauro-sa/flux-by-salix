import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConfigAgenteIA, ResultadoPipelineAgente, AccionAgente } from '@/tipos/inbox'
import { obtenerContextoCompleto, construirSystemPrompt } from './contexto'
import {
  nodoEtiquetar,
  nodoClasificar,
  nodoEscalar,
  nodoCrearActividad,
  nodoActualizarContacto,
  nodoSentimiento,
  nodoEnrutar,
  nodoResumir,
  type RespuestaLLM,
} from './nodos'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Pipeline principal del agente IA.
 * Orquesta: verificación → contexto → LLM → acciones → log.
 * Se invoca desde: webhook WhatsApp (post-chatbot) y API /agente-ia/ejecutar.
 */

export async function ejecutarPipelineAgente(params: {
  admin: SupabaseClient
  empresa_id: string
  conversacion_id: string
  mensaje_id: string
  canal_id: string
  forzar?: boolean
}): Promise<ResultadoPipelineAgente> {
  const { admin, empresa_id, conversacion_id, mensaje_id, canal_id, forzar } = params
  const inicio = Date.now()

  // 1. Cargar config del agente
  const config = await cargarConfigAgente(admin, empresa_id)
  if (!config || (!config.activo && !forzar)) {
    return { acciones_ejecutadas: [], escalado: false }
  }

  // 2. Verificar si debe actuar
  if (!forzar && !await verificarDebeActuar(admin, config, conversacion_id, canal_id)) {
    return { acciones_ejecutadas: [], escalado: false }
  }

  // 2.5. Delay configurable antes de responder
  if (config.delay_segundos > 0) {
    await new Promise(resolve => setTimeout(resolve, config.delay_segundos * 1000))
  }

  // 3. Obtener contexto completo
  const contexto = await obtenerContextoCompleto({
    admin, empresa_id, conversacion_id, mensaje_id, config,
  })

  if (!contexto.config_ia.apiKey) {
    console.warn('[AGENTE_IA] Sin API key configurada')
    return { acciones_ejecutadas: [], escalado: false }
  }

  // 4. Construir prompt y llamar al LLM
  const systemPrompt = construirSystemPrompt(contexto)
  let respuestaLLM: RespuestaLLM
  let tokensEntrada = 0
  let tokensSalida = 0

  try {
    const resultado = await llamarLLM(
      contexto.config_ia.proveedor,
      contexto.config_ia.apiKey,
      contexto.config_ia.modelo,
      systemPrompt,
    )
    respuestaLLM = resultado.respuesta
    tokensEntrada = resultado.tokensEntrada
    tokensSalida = resultado.tokensSalida
  } catch (err) {
    console.error('[AGENTE_IA] Error LLM:', err)
    await loggear(admin, {
      empresa_id, conversacion_id, mensaje_id,
      accion: 'responder', entrada: { prompt: systemPrompt },
      salida: {}, exito: false, error: String(err),
      proveedor: contexto.config_ia.proveedor, modelo: contexto.config_ia.modelo,
      tokensEntrada: 0, tokensSalida: 0, latenciaMs: Date.now() - inicio,
    })
    return { acciones_ejecutadas: [], escalado: false }
  }

  // 5. Procesar respuesta y ejecutar acciones
  const accionesEjecutadas: AccionAgente[] = []
  let escalado = false

  // Clasificar
  if (config.puede_clasificar && respuestaLLM.clasificacion) {
    await nodoClasificar.ejecutar(contexto, admin, { clasificacion: respuestaLLM.clasificacion })
    accionesEjecutadas.push('clasificar')
  }

  // Sentimiento
  if (config.puede_sentimiento && respuestaLLM.sentimiento) {
    contexto.resultados_previos.clasificacion = respuestaLLM.clasificacion
    await nodoSentimiento.ejecutar(contexto, admin, { sentimiento: respuestaLLM.sentimiento })
    accionesEjecutadas.push('sentimiento')
  }

  // Verificar escalamiento
  const debeEscalar = respuestaLLM.debe_escalar
    || (config.escalar_si_negativo && respuestaLLM.sentimiento?.valor === 'negativo')

  if (debeEscalar) {
    // Enviar mensaje de escalamiento y desactivar IA
    await enviarMensajeBot(admin, conversacion_id, config.mensaje_escalamiento, empresa_id, canal_id)
    await nodoEscalar.ejecutar(contexto, admin, { razon_escalamiento: respuestaLLM.razon_escalamiento })
    accionesEjecutadas.push('escalar')
    escalado = true
  } else if (config.puede_responder && respuestaLLM.respuesta) {
    // Enviar/guardar respuesta según modo
    await procesarRespuesta(admin, config, conversacion_id, respuestaLLM.respuesta, empresa_id, canal_id)
    accionesEjecutadas.push('responder')
  }

  // Etiquetar
  if (config.puede_etiquetar && respuestaLLM.etiquetas_sugeridas?.length > 0) {
    await nodoEtiquetar.ejecutar(contexto, admin, { etiquetas_sugeridas: respuestaLLM.etiquetas_sugeridas })
    accionesEjecutadas.push('etiquetar')
  }

  // Enrutar a agente/equipo
  if (config.puede_enrutar && !escalado) {
    await nodoEnrutar.ejecutar(contexto, admin, {})
    accionesEjecutadas.push('enrutar')
  }

  // Resumir conversación
  if (config.puede_resumir) {
    await nodoResumir.ejecutar(contexto, admin, {})
    accionesEjecutadas.push('resumir')
  }

  // Acciones sugeridas por el LLM
  if (respuestaLLM.acciones_sugeridas) {
    for (const accion of respuestaLLM.acciones_sugeridas) {
      if (accion.tipo === 'crear_actividad' && config.puede_crear_actividad) {
        await nodoCrearActividad.ejecutar(contexto, admin, accion.datos)
        accionesEjecutadas.push('crear_actividad')
      }
      if (accion.tipo === 'actualizar_contacto' && config.puede_actualizar_contacto) {
        await nodoActualizarContacto.ejecutar(contexto, admin, accion.datos)
        accionesEjecutadas.push('actualizar_contacto')
      }
    }
  }

  // 6. Loggear
  const latenciaMs = Date.now() - inicio
  await loggear(admin, {
    empresa_id, conversacion_id, mensaje_id,
    accion: escalado ? 'escalar' : 'responder',
    entrada: { prompt: systemPrompt.slice(0, 500) },
    salida: respuestaLLM as unknown as Record<string, unknown>,
    exito: true, error: null,
    proveedor: contexto.config_ia.proveedor, modelo: contexto.config_ia.modelo,
    tokensEntrada, tokensSalida, latenciaMs,
  })

  return {
    clasificacion: respuestaLLM.clasificacion ? {
      intencion: respuestaLLM.clasificacion.intencion,
      tema: respuestaLLM.clasificacion.tema,
      urgencia: respuestaLLM.clasificacion.urgencia as 'baja' | 'media' | 'alta' | 'critica',
      confianza: respuestaLLM.clasificacion.confianza,
    } : undefined,
    sentimiento: respuestaLLM.sentimiento,
    respuesta: respuestaLLM.respuesta ? {
      texto: respuestaLLM.respuesta,
    } : undefined,
    acciones_ejecutadas: accionesEjecutadas,
    escalado,
    razon_escalamiento: respuestaLLM.razon_escalamiento || undefined,
  }
}

// ─── Cargar config del agente ───

async function cargarConfigAgente(admin: SupabaseClient, empresaId: string): Promise<ConfigAgenteIA | null> {
  const { data } = await admin
    .from('config_agente_ia')
    .select('*')
    .eq('empresa_id', empresaId)
    .single()

  return data as ConfigAgenteIA | null
}

// ─── Verificar si el agente debe actuar ───

async function verificarDebeActuar(
  admin: SupabaseClient,
  config: ConfigAgenteIA,
  conversacionId: string,
  canalId: string,
): Promise<boolean> {
  // Verificar que el canal está en la lista de canales activos
  if (config.canales_activos.length > 0 && !config.canales_activos.includes(canalId)) {
    return false
  }

  // Verificar agente_ia_activo en la conversación
  const { data: conv } = await admin
    .from('conversaciones')
    .select('agente_ia_activo, chatbot_activo')
    .eq('id', conversacionId)
    .single()

  if (!conv?.agente_ia_activo) return false

  // Modo de activación
  if (config.modo_activacion === 'despues_chatbot') {
    // Solo actuar si el chatbot ya no está activo (terminó o no matcheó)
    if (conv.chatbot_activo) return false
  }

  if (config.modo_activacion === 'fuera_horario') {
    // Verificar si estamos fuera del horario de atención
    const { data: configInbox } = await admin
      .from('config_inbox')
      .select('horario_atencion_inicio, horario_atencion_fin')
      .eq('empresa_id', config.empresa_id)
      .single()

    if (configInbox) {
      const ahora = new Date()
      const horaActual = ahora.getHours() * 100 + ahora.getMinutes()
      const inicio = parseInt(configInbox.horario_atencion_inicio?.replace(':', '') || '900')
      const fin = parseInt(configInbox.horario_atencion_fin?.replace(':', '') || '1800')

      // Si estamos dentro del horario, NO actuar
      if (horaActual >= inicio && horaActual <= fin) return false
    }
  }

  if (config.modo_activacion === 'sin_asignar') {
    const { data: convCompleta } = await admin
      .from('conversaciones')
      .select('asignado_a')
      .eq('id', conversacionId)
      .single()

    if (convCompleta?.asignado_a) return false
  }

  // Verificar max_mensajes_auto (contar respuestas del agente IA en esta conversación)
  if (config.max_mensajes_auto > 0) {
    const { count } = await admin
      .from('log_agente_ia')
      .select('id', { count: 'exact', head: true })
      .eq('conversacion_id', conversacionId)
      .eq('accion', 'responder')
      .eq('exito', true)

    if ((count || 0) >= config.max_mensajes_auto) return false
  }

  return true
}

// ─── Llamar al LLM ───

async function llamarLLM(
  proveedor: string,
  apiKey: string,
  modelo: string,
  prompt: string,
): Promise<{ respuesta: RespuestaLLM; tokensEntrada: number; tokensSalida: number }> {
  if (proveedor === 'openai') {
    return llamarOpenAI(apiKey, modelo, prompt)
  }
  return llamarAnthropic(apiKey, modelo, prompt)
}

async function llamarAnthropic(
  apiKey: string,
  modelo: string,
  prompt: string,
): Promise<{ respuesta: RespuestaLLM; tokensEntrada: number; tokensSalida: number }> {
  const anthropic = new Anthropic({ apiKey })
  const resultado = await anthropic.messages.create({
    model: modelo,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const texto = resultado.content[0].type === 'text' ? resultado.content[0].text : ''
  const respuesta = parsearRespuestaLLM(texto)

  return {
    respuesta,
    tokensEntrada: resultado.usage.input_tokens,
    tokensSalida: resultado.usage.output_tokens,
  }
}

async function llamarOpenAI(
  apiKey: string,
  modelo: string,
  prompt: string,
): Promise<{ respuesta: RespuestaLLM; tokensEntrada: number; tokensSalida: number }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI error: ${JSON.stringify(err)}`)
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[]
    usage: { prompt_tokens: number; completion_tokens: number }
  }
  const texto = data.choices?.[0]?.message?.content || ''
  const respuesta = parsearRespuestaLLM(texto)

  return {
    respuesta,
    tokensEntrada: data.usage?.prompt_tokens || 0,
    tokensSalida: data.usage?.completion_tokens || 0,
  }
}

// ─── Parsear respuesta JSON del LLM ───

function parsearRespuestaLLM(texto: string): RespuestaLLM {
  // Intentar extraer JSON del texto (a veces viene con markdown)
  const jsonMatch = texto.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      respuesta: texto,
      clasificacion: { intencion: 'consulta', tema: 'general', urgencia: 'baja', confianza: 50 },
      sentimiento: { valor: 'neutro', confianza: 50 },
      debe_escalar: false,
      razon_escalamiento: null,
      etiquetas_sugeridas: [],
      acciones_sugeridas: [],
    }
  }

  try {
    return JSON.parse(jsonMatch[0]) as RespuestaLLM
  } catch {
    return {
      respuesta: texto,
      clasificacion: { intencion: 'consulta', tema: 'general', urgencia: 'baja', confianza: 50 },
      sentimiento: { valor: 'neutro', confianza: 50 },
      debe_escalar: false,
      razon_escalamiento: null,
      etiquetas_sugeridas: [],
      acciones_sugeridas: [],
    }
  }
}

// ─── Procesar respuesta según modo (automático, sugerir, borrador) ───

async function procesarRespuesta(
  admin: SupabaseClient,
  config: ConfigAgenteIA,
  conversacionId: string,
  textoRespuesta: string,
  empresaId: string,
  canalId: string,
) {
  if (config.modo_respuesta === 'automatico') {
    // Enviar como mensaje del bot directamente
    await enviarMensajeBot(admin, conversacionId, textoRespuesta, empresaId, canalId)
  } else if (config.modo_respuesta === 'sugerir') {
    // Guardar como sugerencia visible al agente humano
    await admin.from('mensajes').insert({
      conversacion_id: conversacionId,
      empresa_id: empresaId,
      canal_id: canalId,
      es_entrante: false,
      tipo_contenido: 'text',
      texto: textoRespuesta,
      es_nota_interna: true,
      remitente_nombre: `🤖 ${config.nombre} (sugerencia)`,
      metadata: { tipo: 'sugerencia_ia', estado: 'pendiente' },
    })
  } else if (config.modo_respuesta === 'borrador') {
    // Guardar como borrador
    await admin.from('mensajes').insert({
      conversacion_id: conversacionId,
      empresa_id: empresaId,
      canal_id: canalId,
      es_entrante: false,
      tipo_contenido: 'text',
      texto: textoRespuesta,
      es_nota_interna: true,
      remitente_nombre: `🤖 ${config.nombre} (borrador)`,
      metadata: { tipo: 'borrador_ia' },
    })
  }

  // Incrementar contador
  await admin
    .from('config_agente_ia')
    .update({ total_mensajes_enviados: (config.total_mensajes_enviados || 0) + 1 })
    .eq('empresa_id', empresaId)
}

// ─── Enviar mensaje como bot (modo automático / escalamiento) ───

async function enviarMensajeBot(
  admin: SupabaseClient,
  conversacionId: string,
  texto: string,
  empresaId: string,
  canalId: string,
) {
  // Obtener datos del canal para enviar vía WhatsApp API
  const { data: canal } = await admin
    .from('canales_inbox')
    .select('tipo, config_conexion')
    .eq('id', canalId)
    .single()

  // Obtener teléfono del contacto
  const { data: conv } = await admin
    .from('conversaciones')
    .select('contacto_telefono')
    .eq('id', conversacionId)
    .single()

  if (canal?.tipo === 'whatsapp' && conv?.contacto_telefono) {
    const config = canal.config_conexion as { phone_number_id?: string; token_acceso?: string }
    if (config.phone_number_id && config.token_acceso) {
      const { enviarTextoWhatsApp } = await import('@/lib/whatsapp')
      await enviarTextoWhatsApp(
        {
          phoneNumberId: config.phone_number_id,
          wabaId: '',
          tokenAcceso: config.token_acceso,
          numeroTelefono: '',
        },
        conv.contacto_telefono,
        texto,
      )
    }
  }

  // Guardar mensaje en BD
  await admin.from('mensajes').insert({
    conversacion_id: conversacionId,
    empresa_id: empresaId,
    canal_id: canalId,
    es_entrante: false,
    tipo_contenido: 'text',
    texto,
    remitente_tipo: 'bot',
    remitente_nombre: 'Agente IA',
  })
}

// ─── Loggear en log_agente_ia ───

async function loggear(admin: SupabaseClient, params: {
  empresa_id: string
  conversacion_id: string
  mensaje_id: string
  accion: string
  entrada: Record<string, unknown>
  salida: Record<string, unknown>
  exito: boolean
  error: string | null
  proveedor: string
  modelo: string
  tokensEntrada: number
  tokensSalida: number
  latenciaMs: number
}) {
  await admin.from('log_agente_ia').insert({
    empresa_id: params.empresa_id,
    conversacion_id: params.conversacion_id,
    mensaje_id: params.mensaje_id,
    accion: params.accion,
    entrada: params.entrada,
    salida: params.salida,
    exito: params.exito,
    error: params.error,
    proveedor: params.proveedor,
    modelo: params.modelo,
    tokens_entrada: params.tokensEntrada,
    tokens_salida: params.tokensSalida,
    latencia_ms: params.latenciaMs,
  })
}

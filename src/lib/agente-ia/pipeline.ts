import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConfigAgenteIA, ResultadoPipelineAgente, AccionAgente } from '@/tipos/inbox'
import { obtenerContextoCompleto, construirPrompts } from './contexto'
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

  // 2.5. Delay inteligente con doble verificación
  // Espera inicial (configurable, mínimo 8 seg) para dar tiempo a que el usuario termine de escribir
  // Después verifica si llegaron mensajes nuevos. Si llegaron, aborta.
  // Si no llegaron, espera un poco más y verifica de nuevo (por si estaba tipeando lento).
  const delayInicial = Math.max((config.delay_segundos || 8) * 1000, 8000)
  await new Promise(resolve => setTimeout(resolve, delayInicial))

  // Primera verificación: ¿llegaron mensajes nuevos?
  const verificarSigoSiendoUltimo = async (): Promise<boolean> => {
    const { data: ultimo } = await admin
      .from('mensajes')
      .select('id')
      .eq('conversacion_id', conversacion_id)
      .eq('es_entrante', true)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()
    return !ultimo || ultimo.id === mensaje_id
  }

  if (!await verificarSigoSiendoUltimo()) {
    return { acciones_ejecutadas: [], escalado: false }
  }

  // Segunda verificación después de 5 seg más (atrapa al que escribe lento)
  await new Promise(resolve => setTimeout(resolve, 5000))
  if (!await verificarSigoSiendoUltimo()) {
    return { acciones_ejecutadas: [], escalado: false }
  }

  // Verificar que no hayamos respondido en los últimos 10 segundos (evitar respuestas duplicadas)
  const { data: respuestaReciente } = await admin
    .from('mensajes')
    .select('id')
    .eq('conversacion_id', conversacion_id)
    .eq('es_entrante', false)
    .eq('remitente_tipo', 'bot')
    .gte('creado_en', new Date(Date.now() - 10000).toISOString())
    .limit(1)
    .maybeSingle()

  if (respuestaReciente) {
    return { acciones_ejecutadas: [], escalado: false }
  }

  // 3. Obtener contexto completo
  const contexto = await obtenerContextoCompleto({
    admin, empresa_id, conversacion_id, mensaje_id, config,
  })

  if (!contexto.config_ia.apiKey) {
    console.warn('[AGENTE_IA] Sin API key configurada')
    return { acciones_ejecutadas: [], escalado: false }
  }

  // 3.5. Pre-validar dirección con Google Places
  // Busca en los últimos mensajes del cliente si alguno parece una dirección
  try {
    const mensajesCliente = contexto.mensajes
      .filter(m => m.es_entrante && m.texto)
      .slice(-5)

    for (const msg of mensajesCliente.reverse()) {
      const texto = msg.texto || ''
      // Detectar si parece dirección: tiene un número de calle (2-5 dígitos)
      const pareceDir = /\d{2,5}/.test(texto) &&
        texto.length >= 5 && texto.length <= 150 &&
        // Excluir mensajes que son claramente otra cosa
        !/\$|pesos|hora|día|lunes|martes|miércoles|jueves|viernes/i.test(texto)

      if (pareceDir) {
        // Limpiar prefijos conversacionales antes de buscar en Google
        let textoLimpio = texto
          .replace(/^(es en|estoy en|queda en|está en|es por|es|la dirección es|dirección|en)\s+/i, '')
          .trim()

        // Buscar contexto de zona/ciudad en mensajes previos para mejorar la búsqueda
        const mensajesPrevios = contexto.mensajes
          .filter(m => m.es_entrante && m.texto)
          .map(m => m.texto!.toLowerCase())
        const mencionaCaba = mensajesPrevios.some(t =>
          /\bcaba\b|capital federal|ciudad autónoma|buenos aires ciudad/i.test(t)
        )
        const mencionaProvincia = mensajesPrevios.some(t =>
          /\bprovincia\b|gran buenos aires|gba|conurbano/i.test(t)
        )

        // Agregar contexto geográfico a la búsqueda
        if (mencionaCaba && !/caba|capital|buenos aires/i.test(textoLimpio)) {
          textoLimpio = `${textoLimpio}, CABA`
        } else if (mencionaProvincia && !/provincia|buenos aires/i.test(textoLimpio)) {
          textoLimpio = `${textoLimpio}, Buenos Aires`
        }

        console.log(`[AGENTE_IA] Intentando validar dirección: "${texto}" → limpio: "${textoLimpio}"`)

        const { validarDireccion } = await import('./validar-direccion')
        const validada = await validarDireccion(textoLimpio)
        if (validada?.textoCompleto && validada.calle) {
          contexto.resultados_previos.direccion_validada = validada.textoCompleto
          contexto.resultados_previos.direccion_barrio = validada.barrio
          contexto.resultados_previos.direccion_ciudad = validada.ciudad
          console.log(`[AGENTE_IA] Dirección validada OK: "${textoLimpio}" → "${validada.textoCompleto}"`)
          break
        } else {
          console.log(`[AGENTE_IA] Google no validó: "${textoLimpio}"`)
        }
      }
    }
  } catch (err) {
    console.warn('[AGENTE_IA] Error pre-validando dirección:', err)
  }

  // 4. Construir prompts separados (system + user) y llamar al LLM
  const { sistema, usuario } = construirPrompts(contexto)
  let respuestaLLM: RespuestaLLM
  let tokensEntrada = 0
  let tokensSalida = 0

  try {
    const resultado = await llamarLLM(
      contexto.config_ia.proveedor,
      contexto.config_ia.apiKey,
      contexto.config_ia.modelo,
      sistema,
      usuario,
    )
    respuestaLLM = resultado.respuesta
    tokensEntrada = resultado.tokensEntrada
    tokensSalida = resultado.tokensSalida
  } catch (err) {
    console.error('[AGENTE_IA] Error LLM:', err)
    await loggear(admin, {
      empresa_id, conversacion_id, mensaje_id,
      accion: 'responder', entrada: { prompt_usuario: usuario.slice(0, 500) },
      salida: {}, exito: false, error: String(err),
      proveedor: contexto.config_ia.proveedor, modelo: contexto.config_ia.modelo,
      tokensEntrada: 0, tokensSalida: 0, latenciaMs: Date.now() - inicio,
    })
    return { acciones_ejecutadas: [], escalado: false }
  }

  // 4.5. Guardar metadata enriquecida del LLM en la conversación
  if (respuestaLLM.tipo_contacto || respuestaLLM.fase_conversacion || respuestaLLM.datos_capturados) {
    try {
      // Leer metadata previa para merge acumulativo de datos_capturados
      const { data: convActual } = await admin
        .from('conversaciones')
        .select('metadata')
        .eq('id', conversacion_id)
        .single()

      const metadataPrev = (convActual?.metadata as Record<string, unknown>) || {}
      const metadataIA: Record<string, unknown> = { ...metadataPrev }

      if (respuestaLLM.tipo_contacto && respuestaLLM.tipo_contacto !== 'desconocido') {
        metadataIA.tipo_contacto = respuestaLLM.tipo_contacto
      }
      if (respuestaLLM.fase_conversacion) {
        metadataIA.fase_conversacion = respuestaLLM.fase_conversacion
      }
      if (respuestaLLM.datos_capturados) {
        const datosPrev = (metadataPrev.datos_capturados as Record<string, unknown>) || {}
        const datosNuevos = { ...datosPrev }
        for (const [k, v] of Object.entries(respuestaLLM.datos_capturados)) {
          if (v !== null && v !== false && v !== '') datosNuevos[k] = v
        }
        metadataIA.datos_capturados = datosNuevos
      }

      await admin
        .from('conversaciones')
        .update({ metadata: metadataIA })
        .eq('id', conversacion_id)
    } catch (err) {
      console.warn('[AGENTE_IA] Error guardando metadata enriquecida:', err)
    }
  }

  // 4.6. Guardar dirección validada en metadata si la hay
  if (respuestaLLM.datos_capturados?.direccion && contexto.resultados_previos.direccion_validada) {
    try {
      const { data: convDir } = await admin
        .from('conversaciones')
        .select('metadata')
        .eq('id', conversacion_id)
        .single()

      const metaDir = (convDir?.metadata as Record<string, unknown>) || {}
      const datosDir = (metaDir.datos_capturados as Record<string, unknown>) || {}
      datosDir.direccion_validada = contexto.resultados_previos.direccion_validada
      datosDir.barrio = contexto.resultados_previos.direccion_barrio || datosDir.barrio
      datosDir.ciudad = contexto.resultados_previos.direccion_ciudad || datosDir.ciudad
      metaDir.datos_capturados = datosDir

      await admin
        .from('conversaciones')
        .update({ metadata: metaDir })
        .eq('id', conversacion_id)
    } catch (err) {
      console.warn('[AGENTE_IA] Error guardando dirección validada:', err)
    }
  }

  // 4.7. Actualizar contacto con datos capturados (dirección, nombre, notas)
  if (respuestaLLM.datos_capturados) {
    try {
      const { data: convContacto } = await admin
        .from('conversaciones')
        .select('contacto_id')
        .eq('id', conversacion_id)
        .single()

      if (convContacto?.contacto_id) {
        const datos = respuestaLLM.datos_capturados
        const contactoId = convContacto.contacto_id

        // Actualizar nombre si lo capturó
        if (datos.nombre) {
          const partes = datos.nombre.split(' ')
          const nombre = partes[0]
          const apellido = partes.slice(1).join(' ') || null
          await admin
            .from('contactos')
            .update({
              nombre,
              ...(apellido ? { apellido } : {}),
              actualizado_en: new Date().toISOString(),
            })
            .eq('id', contactoId)
        }

        // Guardar/actualizar dirección validada en contacto_direcciones
        const direccionTexto = (contexto.resultados_previos.direccion_validada as string)
          || datos.direccion
        if (direccionTexto) {
          // Ver si ya tiene una dirección principal
          const { data: dirExistente } = await admin
            .from('contacto_direcciones')
            .select('id')
            .eq('contacto_id', contactoId)
            .eq('es_principal', true)
            .maybeSingle()

          const datosDir = {
            contacto_id: contactoId,
            tipo: 'principal',
            calle: direccionTexto,
            barrio: (contexto.resultados_previos.direccion_barrio as string) || datos.zona || '',
            ciudad: (contexto.resultados_previos.direccion_ciudad as string) || '',
            provincia: '',
            texto: direccionTexto,
            es_principal: true,
          }

          if (dirExistente) {
            await admin
              .from('contacto_direcciones')
              .update(datosDir)
              .eq('id', dirExistente.id)
          } else {
            await admin
              .from('contacto_direcciones')
              .insert(datosDir)
          }
        }

        // Actualizar notas del contacto con resumen del trabajo
        if (datos.tipo_trabajo) {
          const { data: contactoActual } = await admin
            .from('contactos')
            .select('notas')
            .eq('id', contactoId)
            .single()

          const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
          const notaNueva = `[${fecha}] Consulta: ${datos.tipo_trabajo}${datos.direccion ? ` en ${datos.direccion}` : ''}`
          const notasExistentes = contactoActual?.notas || ''
          // No duplicar si ya tiene la misma nota
          if (!notasExistentes.includes(datos.tipo_trabajo)) {
            await admin
              .from('contactos')
              .update({
                notas: notasExistentes ? `${notasExistentes}\n${notaNueva}` : notaNueva,
                actualizado_en: new Date().toISOString(),
              })
              .eq('id', contactoId)
          }
        }
      }
    } catch (err) {
      console.warn('[AGENTE_IA] Error actualizando contacto:', err)
    }
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
    entrada: { prompt_usuario: usuario.slice(0, 500) },
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
    // Verificar si estamos fuera del horario de atención (usando zona horaria de la empresa)
    const { data: configInbox } = await admin
      .from('config_inbox')
      .select('horario_atencion_inicio, horario_atencion_fin, zona_horaria')
      .eq('empresa_id', config.empresa_id)
      .single()

    if (configInbox) {
      // Usar zona horaria de la empresa, fallback a America/Argentina/Buenos_Aires
      const zonaHoraria = configInbox.zona_horaria || 'America/Argentina/Buenos_Aires'
      let horaActual: number
      try {
        const ahora = new Date()
        const formato = new Intl.DateTimeFormat('en-US', {
          timeZone: zonaHoraria,
          hour: 'numeric', minute: 'numeric', hour12: false,
        })
        const partes = formato.format(ahora).split(':')
        horaActual = parseInt(partes[0]) * 100 + parseInt(partes[1])
      } catch {
        // Si la zona horaria es inválida, usar hora del servidor
        const ahora = new Date()
        horaActual = ahora.getHours() * 100 + ahora.getMinutes()
      }

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

  // Verificar max_mensajes_auto (contar respuestas del agente IA en esta sesión)
  // Solo contar desde la última reapertura/creación de la conversación
  if (config.max_mensajes_auto > 0) {
    const { data: convDatos } = await admin
      .from('conversaciones')
      .select('actualizado_en')
      .eq('id', conversacionId)
      .single()

    let query = admin
      .from('log_agente_ia')
      .select('id', { count: 'exact', head: true })
      .eq('conversacion_id', conversacionId)
      .eq('accion', 'responder')
      .eq('exito', true)

    // Si hay fecha de última reapertura, solo contar desde ahí
    if (convDatos?.actualizado_en) {
      query = query.gte('creado_en', convDatos.actualizado_en)
    }

    const { count } = await query
    if ((count || 0) >= config.max_mensajes_auto) return false
  }

  return true
}

// ─── Llamar al LLM ───

async function llamarLLM(
  proveedor: string,
  apiKey: string,
  modelo: string,
  sistema: string,
  usuario: string,
): Promise<{ respuesta: RespuestaLLM; tokensEntrada: number; tokensSalida: number }> {
  if (proveedor === 'openai') {
    return llamarOpenAI(apiKey, modelo, sistema, usuario)
  }
  return llamarAnthropic(apiKey, modelo, sistema, usuario)
}

async function llamarAnthropic(
  apiKey: string,
  modelo: string,
  sistema: string,
  usuario: string,
): Promise<{ respuesta: RespuestaLLM; tokensEntrada: number; tokensSalida: number }> {
  const anthropic = new Anthropic({ apiKey })
  const resultado = await anthropic.messages.create({
    model: modelo,
    max_tokens: 1024,
    system: sistema,
    messages: [{ role: 'user', content: usuario }],
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
  sistema: string,
  usuario: string,
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
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
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

// ─── Extraer primer JSON balanceado del texto ───

function extraerJSON(texto: string): string | null {
  // Limpiar bloques de markdown (```json ... ```)
  const limpio = texto.replace(/```(?:json)?\s*/g, '').replace(/```/g, '')
  const inicio = limpio.indexOf('{')
  if (inicio === -1) return null

  let profundidad = 0
  let enString = false
  let escape = false

  for (let i = inicio; i < limpio.length; i++) {
    const c = limpio[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { enString = !enString; continue }
    if (enString) continue
    if (c === '{') profundidad++
    if (c === '}') {
      profundidad--
      if (profundidad === 0) return limpio.slice(inicio, i + 1)
    }
  }
  return null
}

// ─── Parsear respuesta JSON del LLM ───

const RESPUESTA_FALLBACK: RespuestaLLM = {
  respuesta: '',
  tipo_contacto: 'desconocido',
  fase_conversacion: 'identificacion',
  clasificacion: { intencion: 'consulta', tema: 'general', urgencia: 'baja', confianza: 50 },
  sentimiento: { valor: 'neutro', confianza: 50 },
  debe_escalar: false,
  razon_escalamiento: null,
  datos_capturados: null,
  etiquetas_sugeridas: [],
  acciones_sugeridas: [],
}

function parsearRespuestaLLM(texto: string): RespuestaLLM {
  const jsonStr = extraerJSON(texto)
  if (!jsonStr) {
    return { ...RESPUESTA_FALLBACK, respuesta: texto }
  }

  try {
    const parsed = JSON.parse(jsonStr) as Partial<RespuestaLLM>
    // Validar que tenga al menos el campo respuesta
    if (typeof parsed.respuesta !== 'string') {
      return { ...RESPUESTA_FALLBACK, respuesta: texto }
    }
    return {
      respuesta: parsed.respuesta,
      tipo_contacto: parsed.tipo_contacto ?? 'desconocido',
      fase_conversacion: parsed.fase_conversacion ?? 'identificacion',
      clasificacion: parsed.clasificacion ?? RESPUESTA_FALLBACK.clasificacion,
      sentimiento: parsed.sentimiento ?? RESPUESTA_FALLBACK.sentimiento,
      debe_escalar: parsed.debe_escalar ?? false,
      razon_escalamiento: parsed.razon_escalamiento ?? null,
      datos_capturados: parsed.datos_capturados ?? null,
      etiquetas_sugeridas: Array.isArray(parsed.etiquetas_sugeridas) ? parsed.etiquetas_sugeridas : [],
      acciones_sugeridas: Array.isArray(parsed.acciones_sugeridas) ? parsed.acciones_sugeridas : [],
    }
  } catch {
    return { ...RESPUESTA_FALLBACK, respuesta: texto }
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
      tipo_contenido: 'texto',
      texto: textoRespuesta,
      es_nota_interna: true,
      remitente_tipo: 'agente_ia',
      remitente_nombre: config.nombre,
      metadata: { tipo: 'sugerencia_ia', estado: 'pendiente', nombre_agente: config.nombre },
    })
  } else if (config.modo_respuesta === 'borrador') {
    // Guardar como borrador para que el agente humano lo edite y envíe
    await admin.from('mensajes').insert({
      conversacion_id: conversacionId,
      empresa_id: empresaId,
      canal_id: canalId,
      es_entrante: false,
      tipo_contenido: 'texto',
      texto: textoRespuesta,
      es_nota_interna: true,
      remitente_tipo: 'agente_ia',
      remitente_nombre: config.nombre,
      metadata: { tipo: 'borrador_ia', nombre_agente: config.nombre },
    })
  }

  // Incrementar contador (leer valor actual para evitar race condition)
  const { data: configActual } = await admin
    .from('config_agente_ia')
    .select('total_mensajes_enviados')
    .eq('empresa_id', empresaId)
    .single()

  await admin
    .from('config_agente_ia')
    .update({ total_mensajes_enviados: (configActual?.total_mensajes_enviados || 0) + 1 })
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

  // Obtener teléfono del contacto (via contacto_id → contactos.telefono)
  const { data: conv } = await admin
    .from('conversaciones')
    .select('contacto_id')
    .eq('id', conversacionId)
    .single()

  let telefonoContacto: string | null = null
  if (conv?.contacto_id) {
    const { data: contacto } = await admin
      .from('contactos')
      .select('telefono')
      .eq('id', conv.contacto_id)
      .single()
    telefonoContacto = contacto?.telefono || null
  }

  let enviadoPorWhatsApp = false
  if (canal?.tipo === 'whatsapp' && telefonoContacto) {
    const configWa = canal.config_conexion as { phoneNumberId?: string; tokenAcceso?: string; wabaId?: string }
    if (configWa.phoneNumberId && configWa.tokenAcceso) {
      try {
        const { enviarTextoWhatsApp } = await import('@/lib/whatsapp')
        await enviarTextoWhatsApp(
          {
            phoneNumberId: configWa.phoneNumberId,
            wabaId: configWa.wabaId || '',
            tokenAcceso: configWa.tokenAcceso,
            numeroTelefono: '',
          },
          telefonoContacto,
          texto,
        )
        enviadoPorWhatsApp = true
      } catch (err) {
        console.error('[AGENTE_IA] Error enviando WhatsApp:', err)
      }
    }
  }

  // Guardar mensaje en BD (marcar estado según si se envió o no)
  const { error: errorInsert } = await admin.from('mensajes').insert({
    conversacion_id: conversacionId,
    empresa_id: empresaId,
    canal_id: canalId,
    es_entrante: false,
    tipo_contenido: 'texto',
    texto,
    remitente_tipo: 'bot',
    remitente_nombre: 'Agente IA',
    estado: enviadoPorWhatsApp ? 'enviado' : 'error',
  })

  if (errorInsert) {
    console.error('[AGENTE_IA] Error guardando mensaje en BD:', errorInsert)
    // Reintentar sin canal_id por si es un FK inválido
    const { error: errorRetry } = await admin.from('mensajes').insert({
      conversacion_id: conversacionId,
      empresa_id: empresaId,
      es_entrante: false,
      tipo_contenido: 'texto',
      texto,
      remitente_tipo: 'bot',
      remitente_nombre: 'Agente IA',
      estado: enviadoPorWhatsApp ? 'enviado' : 'error',
    })
    if (errorRetry) console.error('[AGENTE_IA] Error en retry sin canal_id:', errorRetry)
  }
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

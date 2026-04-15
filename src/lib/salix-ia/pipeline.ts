/**
 * Pipeline principal de Salix IA.
 * Orquesta la conversación con Claude usando tool_use nativo.
 * Loop: mensaje → LLM → tool_use? → ejecutar → resultado → LLM → ... → respuesta texto.
 */

import Anthropic from '@anthropic-ai/sdk'
import { HERRAMIENTAS_SALIX_IA } from '@/lib/salix-ia/herramientas/definiciones'
import { obtenerEjecutor } from '@/lib/salix-ia/herramientas'
import { filtrarHerramientasPermitidas } from '@/lib/salix-ia/permisos'
import { construirContexto, cargarConfigSalixIA, cargarConfigIA, construirSystemPrompt } from '@/lib/salix-ia/contexto'
import { notificarErrorIA } from '@/lib/salix-ia/notificar-error-ia'
import type {
  ParamsPipeline,
  ResultadoPipeline,
  MensajeSalixIA,
  ConfigSalixIA,
  ConfigIA,
  ContextoSalixIA,
  SupabaseAdmin,
} from '@/tipos/salix-ia'

/**
 * Ejecuta el pipeline de Salix IA.
 * Maneja el loop completo de tool_use hasta obtener una respuesta de texto final.
 */
export async function ejecutarSalixIA(params: ParamsPipeline): Promise<ResultadoPipeline> {
  const inicio = Date.now()
  const { admin, empresa_id, usuario_id, mensaje, historial = [], canal = 'app' } = params

  // 1. Cargar contexto, config y miembro
  const ctx = await construirContexto(admin, empresa_id, usuario_id)
  if (!ctx) {
    return crearResultadoError('No se pudo cargar el contexto del usuario. Verificá que tu cuenta esté activa.')
  }

  const configSalix = await cargarConfigSalixIA(admin, empresa_id)
  if (!configSalix || !configSalix.habilitado) {
    return crearResultadoError('Salix IA no está habilitado para esta empresa.')
  }

  const configIA = await cargarConfigIA(admin, empresa_id)
  if (!configIA?.api_key_anthropic) {
    return crearResultadoError('No hay API key de Anthropic configurada. Contactá al administrador.')
  }

  // 2. Filtrar herramientas por permisos
  const herramientasPermitidas = filtrarHerramientasPermitidas(
    HERRAMIENTAS_SALIX_IA,
    ctx.miembro,
    configSalix
  )

  // 3. Cargar timezone de la empresa
  const { data: configInbox } = await admin
    .from('config_inbox')
    .select('zona_horaria')
    .eq('empresa_id', empresa_id)
    .maybeSingle()
  const zonaHoraria = configInbox?.zona_horaria || 'America/Argentina/Buenos_Aires'

  // 4. Construir system prompt con timezone correcta
  const nombresHerramientas = herramientasPermitidas.map((h) => h.nombre)
  const systemPrompt = construirSystemPrompt(ctx, configSalix, nombresHerramientas, zonaHoraria)

  // 4. Preparar tools para Anthropic
  const tools = herramientasPermitidas.map((h) => h.definicion)

  // 5. Construir mensajes para la API
  const mensajesAPI = construirMensajesAPI(historial, mensaje)

  // 6. Loop de tool_use
  const maxIteraciones = configSalix.max_iteraciones_herramientas || 5
  const herramientasUsadas: string[] = []
  const mensajesNuevos: MensajeSalixIA[] = [
    { role: 'user', content: mensaje, timestamp: new Date().toISOString() },
  ]

  let tokensEntrada = 0
  let tokensSalida = 0

  const anthropic = new Anthropic({ apiKey: configIA.api_key_anthropic })

  try {
  for (let iteracion = 0; iteracion < maxIteraciones; iteracion++) {
    // Llamar a Claude
    const respuesta = await anthropic.messages.create({
      model: configIA.modelo_anthropic || 'claude-sonnet-4-20250514',
      max_tokens: configIA.max_tokens || 4096,
      system: systemPrompt,
      tools: tools as Anthropic.Messages.Tool[],
      messages: mensajesAPI as Anthropic.Messages.MessageParam[],
    })

    tokensEntrada += respuesta.usage?.input_tokens || 0
    tokensSalida += respuesta.usage?.output_tokens || 0

    // Verificar si la respuesta es solo texto (fin del loop)
    const tieneToolUse = respuesta.content.some((b) => b.type === 'tool_use')

    if (!tieneToolUse) {
      // Extraer texto final
      const textoFinal = respuesta.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')

      mensajesNuevos.push({
        role: 'assistant',
        content: textoFinal,
        timestamp: new Date().toISOString(),
      })

      // Log de la interacción
      await registrarLog(admin, {
        empresa_id,
        usuario_id,
        conversacion_id: params.conversacion_id,
        canal,
        mensaje_usuario: mensaje.substring(0, 500),
        respuesta: textoFinal.substring(0, 1000),
        herramientas_usadas: herramientasUsadas,
        tokens_entrada: tokensEntrada,
        tokens_salida: tokensSalida,
        latencia_ms: Date.now() - inicio,
        proveedor: 'anthropic',
        modelo: configIA.modelo_anthropic,
        exito: true,
      })

      return {
        respuesta: textoFinal,
        herramientas_usadas: herramientasUsadas,
        mensajes_nuevos: mensajesNuevos,
        tokens_entrada: tokensEntrada,
        tokens_salida: tokensSalida,
        latencia_ms: Date.now() - inicio,
      }
    }

    // Hay tool_use — ejecutar herramientas
    // Agregar respuesta del assistant a los mensajes
    mensajesAPI.push({
      role: 'assistant',
      content: respuesta.content,
    })

    // Ejecutar cada herramienta y acumular resultados
    const toolResults: { type: 'tool_result'; tool_use_id: string; content: string }[] = []

    for (const bloque of respuesta.content) {
      if (bloque.type !== 'tool_use') continue

      herramientasUsadas.push(bloque.name)
      const ejecutor = obtenerEjecutor(bloque.name)

      let resultado: string
      if (!ejecutor) {
        resultado = JSON.stringify({ exito: false, error: `Herramienta "${bloque.name}" no encontrada` })
      } else {
        try {
          const res = await ejecutor(ctx, bloque.input as Record<string, unknown>)
          resultado = JSON.stringify(res)
        } catch (err) {
          resultado = JSON.stringify({
            exito: false,
            error: `Error ejecutando ${bloque.name}: ${err instanceof Error ? err.message : 'Error desconocido'}`,
          })
        }
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: bloque.id,
        content: resultado,
      })
    }

    // Agregar resultados de herramientas como mensaje del user
    mensajesAPI.push({
      role: 'user',
      content: toolResults,
    })
  }

  // Si llegamos aquí, se excedió el máximo de iteraciones
  const textoFallback = 'Necesité ejecutar muchas acciones para responder. ¿Podés reformular tu pedido de forma más específica?'
  mensajesNuevos.push({
    role: 'assistant',
    content: textoFallback,
    timestamp: new Date().toISOString(),
  })

  return {
    respuesta: textoFallback,
    herramientas_usadas: herramientasUsadas,
    mensajes_nuevos: mensajesNuevos,
    tokens_entrada: tokensEntrada,
    tokens_salida: tokensSalida,
    latencia_ms: Date.now() - inicio,
  }

  } catch (err) {
    // Error de la API o del pipeline — detectar tipo y mostrar mensaje útil
    const mensajeError = err instanceof Error ? err.message : 'Error inesperado'
    console.error('[Salix IA] Error en pipeline:', mensajeError)

    // Detectar errores conocidos de la API de Anthropic
    const respuestaUsuario = detectarErrorAPI(mensajeError)

    // Notificar a admins si es un error crítico (créditos, key inválida, etc.)
    notificarErrorIA(admin, { empresa_id, origen: 'salix_ia', mensajeError }).catch(() => {})

    await registrarLog(admin, {
      empresa_id,
      usuario_id,
      conversacion_id: params.conversacion_id,
      canal,
      mensaje_usuario: mensaje.substring(0, 500),
      respuesta: '',
      herramientas_usadas: herramientasUsadas,
      tokens_entrada: tokensEntrada,
      tokens_salida: tokensSalida,
      latencia_ms: Date.now() - inicio,
      proveedor: 'anthropic',
      modelo: configIA.modelo_anthropic,
      exito: false,
      error: mensajeError,
    })

    return {
      respuesta: respuestaUsuario,
      herramientas_usadas: herramientasUsadas,
      mensajes_nuevos: [
        { role: 'user', content: mensaje, timestamp: new Date().toISOString() },
        { role: 'assistant', content: respuestaUsuario, timestamp: new Date().toISOString() },
      ],
      tokens_entrada: tokensEntrada,
      tokens_salida: tokensSalida,
      latencia_ms: Date.now() - inicio,
    }
  }
}

/** Construye el array de mensajes para la API de Anthropic a partir del historial */
function construirMensajesAPI(
  historial: MensajeSalixIA[],
  mensajeNuevo: string
): { role: string; content: unknown }[] {
  const mensajes: { role: string; content: unknown }[] = []

  // Agregar historial previo
  for (const msg of historial) {
    mensajes.push({
      role: msg.role,
      content: msg.content,
    })
  }

  // Agregar mensaje nuevo del usuario
  mensajes.push({
    role: 'user',
    content: mensajeNuevo,
  })

  return mensajes
}

/** Crea un resultado de error sin llamar al LLM */
function crearResultadoError(error: string): ResultadoPipeline {
  return {
    respuesta: error,
    herramientas_usadas: [],
    mensajes_nuevos: [
      { role: 'assistant', content: error, timestamp: new Date().toISOString() },
    ],
    tokens_entrada: 0,
    tokens_salida: 0,
    latencia_ms: 0,
  }
}

/** Detecta errores conocidos de la API y retorna un mensaje claro para el usuario */
function detectarErrorAPI(mensajeError: string): string {
  const errorLower = mensajeError.toLowerCase()

  const linkConfig = '{{link:/configuracion?seccion=ia|Configuración → IA}}'

  // Sin créditos
  if (errorLower.includes('credit balance') || errorLower.includes('billing') || errorLower.includes('purchase credits')) {
    return `La API key de Anthropic no tiene créditos disponibles. Recargá créditos en console.anthropic.com o actualizá la key en ${linkConfig}.`
  }

  // API key inválida
  if (errorLower.includes('invalid api key') || errorLower.includes('authentication') || errorLower.includes('unauthorized') || errorLower.includes('401')) {
    return `La API key de Anthropic es inválida o fue revocada. Verificala en ${linkConfig}.`
  }

  // Rate limit
  if (errorLower.includes('rate limit') || errorLower.includes('too many requests') || errorLower.includes('429')) {
    return 'Se excedió el límite de solicitudes a la API. Esperá unos segundos e intentá de nuevo.'
  }

  // Modelo no encontrado
  if (errorLower.includes('model') && (errorLower.includes('not found') || errorLower.includes('does not exist'))) {
    return `El modelo de IA configurado no está disponible. Verificalo en ${linkConfig}.`
  }

  // Overloaded
  if (errorLower.includes('overloaded') || errorLower.includes('503')) {
    return 'El servicio de IA está temporalmente saturado. Intentá de nuevo en unos segundos.'
  }

  // Error genérico
  return 'Hubo un error al procesar tu consulta. Si el problema persiste, contactá al administrador.'
}

/** Registra la interacción en log_salix_ia */
async function registrarLog(
  admin: SupabaseAdmin,
  datos: {
    empresa_id: string
    usuario_id: string
    conversacion_id?: string
    canal: string
    mensaje_usuario: string
    respuesta: string
    herramientas_usadas: string[]
    tokens_entrada: number
    tokens_salida: number
    latencia_ms: number
    proveedor: string
    modelo: string
    exito: boolean
    error?: string
  }
): Promise<void> {
  try {
    await admin.from('log_salix_ia').insert(datos)
  } catch {
    // No fallar si el log falla
    console.error('[Salix IA] Error registrando log')
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/inbox/ia — Genera respuestas sugeridas y resúmenes con IA.
 * Prioridad de API key: config_inbox de la empresa > env ANTHROPIC_API_KEY (fallback global).
 * Soporta proveedores: Anthropic (Claude) y OpenAI (GPT).
 *
 * Body: { conversacion_id, accion: 'sugerir_respuesta' | 'resumir' | 'analizar_sentimiento' }
 */

// ─── Helper: llamar a Anthropic ───
async function llamarAnthropic(apiKey: string, modelo: string, prompt: string, maxTokens: number): Promise<string> {
  const anthropic = new Anthropic({ apiKey })
  const respuesta = await anthropic.messages.create({
    model: modelo,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  return respuesta.content[0].type === 'text' ? respuesta.content[0].text : ''
}

// ─── Helper: llamar a OpenAI ───
async function llamarOpenAI(apiKey: string, modelo: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI error: ${(err as Record<string, unknown>).error || res.statusText}`)
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices?.[0]?.message?.content || ''
}

// ─── Helper unificado: enviar prompt al proveedor configurado ───
async function generarConIA(
  proveedor: string,
  apiKey: string,
  modelo: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  if (proveedor === 'openai') {
    return llamarOpenAI(apiKey, modelo, prompt, maxTokens)
  }
  // Default: Anthropic
  return llamarAnthropic(apiKey, modelo, prompt, maxTokens)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { conversacion_id, accion, idioma = 'es' } = await request.json()

    if (!conversacion_id || !accion) {
      return NextResponse.json({ error: 'conversacion_id y accion son requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // ─── Verificar que la IA está habilitada para el inbox ───
    const { data: configInbox } = await admin
      .from('config_inbox')
      .select('ia_habilitada')
      .eq('empresa_id', empresaId)
      .single()

    if (configInbox && !configInbox.ia_habilitada) {
      return NextResponse.json({
        error: 'La IA no está habilitada para el inbox. Activala en Configuración del Inbox > General.',
      }, { status: 403 })
    }

    // ─── Obtener config IA de la empresa (tabla config_ia, misma que usa SeccionIA) ───
    const { data: configIA } = await admin
      .from('config_ia')
      .select('habilitado, proveedor_defecto, api_key_anthropic, api_key_openai, api_key_google, api_key_xai, modelo_anthropic, modelo_openai, modelo_google, modelo_xai')
      .eq('empresa_id', empresaId)
      .single()

    // Resolver proveedor, API key y modelo: config empresa > env global (fallback)
    let proveedor = 'anthropic'
    let apiKey = process.env.ANTHROPIC_API_KEY || ''
    let modelo = 'claude-haiku-4-5-20251001'

    if (configIA?.habilitado) {
      const prov = configIA.proveedor_defecto || 'anthropic'
      const keyMap: Record<string, string> = {
        anthropic: configIA.api_key_anthropic,
        openai: configIA.api_key_openai,
        google: configIA.api_key_google,
        xai: configIA.api_key_xai,
      }
      const modeloMap: Record<string, string> = {
        anthropic: configIA.modelo_anthropic || 'claude-haiku-4-5-20251001',
        openai: configIA.modelo_openai || 'gpt-4o-mini',
        google: configIA.modelo_google || 'gemini-2.0-flash',
        xai: configIA.modelo_xai || 'grok-3-mini',
      }

      if (keyMap[prov]) {
        proveedor = prov
        apiKey = keyMap[prov]
        modelo = modeloMap[prov]
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        error: 'IA no configurada. Configurá tu API key en Configuración > IA.',
      }, { status: 503 })
    }

    // Obtener conversación y últimos mensajes
    const { data: conversacion } = await admin
      .from('conversaciones')
      .select('*')
      .eq('id', conversacion_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!conversacion) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    const { data: mensajes } = await admin
      .from('mensajes')
      .select('es_entrante, remitente_nombre, texto, correo_asunto, es_nota_interna, creado_en')
      .eq('conversacion_id', conversacion_id)
      .eq('es_nota_interna', false) // Excluir notas internas del contexto IA
      .order('creado_en', { ascending: true })
      .limit(20)

    if (!mensajes || mensajes.length === 0) {
      return NextResponse.json({ error: 'Sin mensajes en la conversación' }, { status: 400 })
    }

    // Construir contexto de la conversación
    const hiloTexto = mensajes.map(m => {
      const dir = m.es_entrante ? 'Cliente' : 'Agente'
      const nombre = m.remitente_nombre || dir
      return `[${dir}] ${nombre}: ${m.texto || '(sin texto)'}`
    }).join('\n')

    let prompt = ''
    let resultado: Record<string, unknown> = {}

    switch (accion) {
      case 'sugerir_respuesta': {
        prompt = `Eres un asistente de atención al cliente profesional. Analiza esta conversación y sugiere 3 posibles respuestas cortas y profesionales en ${idioma === 'es' ? 'español' : idioma}.

Asunto: ${conversacion.asunto || '(sin asunto)'}
Contacto: ${conversacion.contacto_nombre || 'Desconocido'}

Conversación:
${hiloTexto}

Genera exactamente 3 respuestas sugeridas, cada una de 1-3 oraciones. Formato JSON:
{"sugerencias": ["respuesta 1", "respuesta 2", "respuesta 3"]}`

        const textoRespuesta = await generarConIA(proveedor, apiKey, modelo, prompt, 500)
        try {
          const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/)
          resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : { sugerencias: [] }
        } catch {
          resultado = { sugerencias: [textoRespuesta] }
        }
        break
      }

      case 'resumir': {
        prompt = `Resume esta conversación en 1-2 oraciones en ${idioma === 'es' ? 'español' : idioma}. Sé conciso y directo.

Asunto: ${conversacion.asunto || '(sin asunto)'}
Conversación:
${hiloTexto}`

        const resumen = await generarConIA(proveedor, apiKey, modelo, prompt, 200)
        resultado = { resumen }

        await admin
          .from('conversaciones')
          .update({ resumen_ia: resumen })
          .eq('id', conversacion_id)
        break
      }

      case 'analizar_sentimiento': {
        prompt = `Analiza el sentimiento del último mensaje del cliente en esta conversación. Responde con un JSON: {"sentimiento": "positivo"|"neutro"|"negativo"|"urgente", "confianza": 0-100, "resumen": "explicación breve"}

Conversación:
${hiloTexto}`

        const textoSent = await generarConIA(proveedor, apiKey, modelo, prompt, 200)
        try {
          const jsonMatch = textoSent.match(/\{[\s\S]*\}/)
          resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : { sentimiento: 'neutro' }
        } catch {
          resultado = { sentimiento: 'neutro' }
        }

        await admin
          .from('conversaciones')
          .update({ sentimiento: (resultado as { sentimiento: string }).sentimiento })
          .eq('id', conversacion_id)
        break
      }

      case 'extraer_datos': {
        // Escanear conversación y extraer datos estructurados del contacto
        prompt = `Eres un asistente experto en extraer datos de contacto de conversaciones. Analiza esta conversación de WhatsApp y extrae TODOS los datos que puedas identificar sobre el cliente/contacto.

Conversación:
${hiloTexto}

Extrae los siguientes campos si están presentes en la conversación. Si un dato no se menciona, dejalo como null. Sé preciso y no inventes datos.

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "nombre": string | null,
  "apellido": string | null,
  "telefono": string | null,
  "correo": string | null,
  "cargo": string | null,
  "rubro": string | null,
  "direccion": {
    "calle": string | null,
    "numero": string | null,
    "barrio": string | null,
    "ciudad": string | null,
    "provincia": string | null,
    "codigo_postal": string | null,
    "texto_completo": string | null
  } | null,
  "tipo_trabajo": string | null,
  "empresa_nombre": string | null,
  "notas": string | null,
  "datos_extra": { [clave: string]: string }
}

El campo "datos_extra" es para cualquier otro dato relevante mencionado (ej: "presupuesto solicitado", "cantidad de personas", "fecha preferida", "modelo de auto", etc).
El campo "notas" es un resumen breve de lo que el cliente necesita o busca.`

        const textoExtraccion = await generarConIA(proveedor, apiKey, modelo, prompt, 800)
        try {
          const jsonMatch = textoExtraccion.match(/\{[\s\S]*\}/)
          resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
        } catch {
          resultado = { error: 'No se pudo extraer datos estructurados' }
        }
        break
      }

      default:
        return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
    }

    return NextResponse.json(resultado)
  } catch (err) {
    console.error('Error en IA inbox:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

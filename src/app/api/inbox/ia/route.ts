import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/inbox/ia — Genera respuestas sugeridas y resúmenes con IA.
 * Usa la API de Claude para analizar conversaciones y sugerir respuestas.
 *
 * Body: { conversacion_id, accion: 'sugerir_respuesta' | 'resumir' | 'analizar_sentimiento' }
 */
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

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'IA no configurada (falta ANTHROPIC_API_KEY)' }, { status: 503 })
    }

    const admin = crearClienteAdmin()

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
      .select('es_entrante, remitente_nombre, texto, correo_asunto, creado_en')
      .eq('conversacion_id', conversacion_id)
      .order('creado_en', { ascending: true })
      .limit(20) // Últimos 20 mensajes para contexto

    if (!mensajes || mensajes.length === 0) {
      return NextResponse.json({ error: 'Sin mensajes en la conversación' }, { status: 400 })
    }

    // Construir contexto de la conversación
    const hiloTexto = mensajes.map(m => {
      const dir = m.es_entrante ? 'Cliente' : 'Agente'
      const nombre = m.remitente_nombre || dir
      return `[${dir}] ${nombre}: ${m.texto || '(sin texto)'}`
    }).join('\n')

    const anthropic = new Anthropic({ apiKey })

    let prompt = ''
    let resultado: Record<string, unknown> = {}

    switch (accion) {
      case 'sugerir_respuesta': {
        prompt = `Eres un asistente de atención al cliente profesional. Analiza esta conversación de correo electrónico y sugiere 3 posibles respuestas cortas y profesionales en ${idioma === 'es' ? 'español' : idioma}.

Asunto: ${conversacion.asunto || '(sin asunto)'}
Contacto: ${conversacion.contacto_nombre || 'Desconocido'}

Conversación:
${hiloTexto}

Genera exactamente 3 respuestas sugeridas, cada una de 1-3 oraciones. Formato JSON:
{"sugerencias": ["respuesta 1", "respuesta 2", "respuesta 3"]}`

        const respuesta = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        })

        const textoRespuesta = respuesta.content[0].type === 'text' ? respuesta.content[0].text : ''
        try {
          const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/)
          resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : { sugerencias: [] }
        } catch {
          resultado = { sugerencias: [textoRespuesta] }
        }
        break
      }

      case 'resumir': {
        prompt = `Resume esta conversación de correo electrónico en 1-2 oraciones en ${idioma === 'es' ? 'español' : idioma}. Sé conciso y directo.

Asunto: ${conversacion.asunto || '(sin asunto)'}
Conversación:
${hiloTexto}`

        const respuesta = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        })

        const resumen = respuesta.content[0].type === 'text' ? respuesta.content[0].text : ''
        resultado = { resumen }

        // Guardar resumen en la conversación
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

        const respuesta = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        })

        const textoSent = respuesta.content[0].type === 'text' ? respuesta.content[0].text : ''
        try {
          const jsonMatch = textoSent.match(/\{[\s\S]*\}/)
          resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : { sentimiento: 'neutro' }
        } catch {
          resultado = { sentimiento: 'neutro' }
        }

        // Guardar sentimiento
        await admin
          .from('conversaciones')
          .update({ sentimiento: (resultado as { sentimiento: string }).sentimiento })
          .eq('id', conversacion_id)
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

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/inbox/agente-ia/analizar-conversaciones
 * Analiza conversaciones reales para extraer patrones, vocabulario, flujos, etc.
 * Fuentes: conversaciones de la BD (por período) o archivo subido (.txt WhatsApp)
 */

// Prompt de análisis para el LLM
const PROMPT_ANALISIS = `Analizá estas conversaciones reales de atención al cliente por WhatsApp.

Extraé y devolvé EXCLUSIVAMENTE un JSON válido con esta estructura:

{
  "ejemplos_sugeridos": [
    {
      "titulo": "Descripción corta del ejemplo",
      "mensajes": [
        {"rol": "cliente", "texto": "..."},
        {"rol": "agente", "texto": "..."}
      ]
    }
  ],
  "vocabulario_detectado": "Palabras y frases naturales que usan los agentes (separadas por coma)",
  "flujo_detectado": [
    {
      "paso": 1,
      "titulo": "Nombre del paso",
      "descripcion": "Qué se hace en este paso",
      "condicion_avance": "Cuándo se avanza al siguiente"
    }
  ],
  "servicios_si": "Lista de servicios que ofrecen (uno por línea)",
  "servicios_no": "Lista de cosas que NO hacen (uno por línea)",
  "tipos_contacto_detectados": [
    {
      "tipo": "identificador_snake_case",
      "nombre": "Nombre visible",
      "icono": "emoji",
      "instrucciones": "Cómo manejar este tipo"
    }
  ],
  "tono_detectado": "Descripción del tono en 1-2 oraciones",
  "situaciones_especiales": "Situaciones recurrentes con manejo especial",
  "reglas_agenda": "Patrones de agendamiento detectados o null",
  "info_precios": "Precios de referencia mencionados o null"
}

REGLAS:
- Seleccioná 5-8 conversaciones representativas como ejemplos (las que mejor muestren cómo responde el negocio)
- El vocabulario son las frases del AGENTE, no del cliente
- El flujo debe reflejar los pasos reales que sigue el negocio
- Si no detectás algo (ej: precios, agenda), devolvé null en ese campo
- Solo JSON, sin texto adicional`

export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const contentType = request.headers.get('content-type') || ''

    let conversacionesTexto = ''

    if (contentType.includes('multipart/form-data')) {
      // ── Fuente: archivo subido ──
      const formData = await request.formData()
      const archivo = formData.get('archivo') as File | null
      if (!archivo) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

      const texto = await archivo.text()
      conversacionesTexto = parsearArchivoWhatsApp(texto)
    } else {
      // ── Fuente: conversaciones de la BD ──
      const body = await request.json()
      const { periodo_dias = 60, canal_id } = body

      const desde = new Date()
      desde.setDate(desde.getDate() - periodo_dias)

      // Obtener conversaciones del período
      let queryConvs = admin
        .from('conversaciones')
        .select('id')
        .eq('empresa_id', empresaId)
        .gte('creado_en', desde.toISOString())
        .order('creado_en', { ascending: false })
        .limit(200)

      if (canal_id) queryConvs = queryConvs.eq('canal_id', canal_id)

      const { data: convs } = await queryConvs
      if (!convs || convs.length === 0) {
        return NextResponse.json({ error: 'No hay conversaciones en el período seleccionado' }, { status: 404 })
      }

      const convIds = convs.map(c => c.id)

      // Obtener mensajes de esas conversaciones
      const { data: mensajes } = await admin
        .from('mensajes')
        .select('conversacion_id, es_entrante, remitente_nombre, texto, creado_en')
        .in('conversacion_id', convIds)
        .eq('es_nota_interna', false)
        .order('creado_en', { ascending: true })

      if (!mensajes || mensajes.length === 0) {
        return NextResponse.json({ error: 'No hay mensajes en las conversaciones' }, { status: 404 })
      }

      // Agrupar por conversación
      const porConv = new Map<string, typeof mensajes>()
      for (const m of mensajes) {
        const grupo = porConv.get(m.conversacion_id) || []
        grupo.push(m)
        porConv.set(m.conversacion_id, grupo)
      }

      // Samplear hasta 80 conversaciones (para no exceder tokens)
      const convsSampled = [...porConv.entries()]
        .filter(([, msgs]) => msgs.length >= 3) // solo las que tienen al menos 3 mensajes
        .slice(0, 80)

      // Formatear como texto legible
      conversacionesTexto = convsSampled.map(([convId, msgs], i) => {
        const hiloTexto = msgs.map(m => {
          const rol = m.es_entrante ? 'Cliente' : 'Agente'
          return `${rol}: ${m.texto || '(sin texto)'}`
        }).join('\n')
        return `=== Conversación ${i + 1} ===\n${hiloTexto}`
      }).join('\n\n')
    }

    if (!conversacionesTexto.trim()) {
      return NextResponse.json({ error: 'No se pudieron extraer conversaciones' }, { status: 400 })
    }

    // Truncar si es muy largo (para no exceder límites del LLM)
    const maxChars = 150000
    if (conversacionesTexto.length > maxChars) {
      conversacionesTexto = conversacionesTexto.slice(0, maxChars) + '\n\n[...truncado por límite de caracteres]'
    }

    // ── Obtener API key para el análisis ──
    const { data: configIA } = await admin
      .from('config_ia')
      .select('api_key_anthropic, api_key_openai, proveedor_defecto')
      .eq('empresa_id', empresaId)
      .single()

    const apiKey = configIA?.api_key_anthropic || process.env.ANTHROPIC_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'Sin API key configurada para el análisis' }, { status: 400 })
    }

    // ── Obtener nombre de la empresa ──
    const { data: empresa } = await admin
      .from('empresas')
      .select('nombre')
      .eq('id', empresaId)
      .single()

    // ── Llamar al LLM para analizar ──
    const anthropic = new Anthropic({ apiKey })
    const resultado = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: PROMPT_ANALISIS,
      messages: [{
        role: 'user',
        content: `Empresa: ${empresa?.nombre || 'Sin nombre'}\n\nCONVERSACIONES:\n\n${conversacionesTexto}`,
      }],
    })

    const textoRespuesta = resultado.content[0].type === 'text' ? resultado.content[0].text : ''

    // Parsear JSON
    let analisis: Record<string, unknown>
    try {
      // Extraer JSON del texto (puede venir envuelto en markdown)
      const jsonStr = textoRespuesta.replace(/```(?:json)?\s*/g, '').replace(/```/g, '')
      const inicio = jsonStr.indexOf('{')
      const fin = jsonStr.lastIndexOf('}')
      analisis = JSON.parse(jsonStr.slice(inicio, fin + 1))
    } catch {
      return NextResponse.json({ error: 'No se pudo parsear el análisis', respuesta_cruda: textoRespuesta }, { status: 500 })
    }

    // Guardar metadata del análisis
    await admin
      .from('config_agente_ia')
      .update({
        ultimo_analisis_conversaciones: new Date().toISOString(),
        total_conversaciones_analizadas: (analisis as { ejemplos_sugeridos?: unknown[] }).ejemplos_sugeridos?.length || 0,
      })
      .eq('empresa_id', empresaId)

    return NextResponse.json({
      analisis,
      tokens: {
        entrada: resultado.usage.input_tokens,
        salida: resultado.usage.output_tokens,
      },
    })
  } catch (err) {
    console.error('[AGENTE_IA] Error analizando conversaciones:', err)
    return NextResponse.json({ error: 'Error interno al analizar' }, { status: 500 })
  }
}

/**
 * Parsear archivo .txt exportado de WhatsApp.
 * Formato: "29/3/2026, 10:15 - Nombre: Mensaje"
 */
function parsearArchivoWhatsApp(texto: string): string {
  const lineas = texto.split('\n')
  const conversaciones: string[] = []
  let actual: string[] = []

  // Regex para detectar inicio de mensaje WhatsApp
  const regex = /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*[-–]\s*/

  for (const linea of lineas) {
    if (regex.test(linea)) {
      const sinFecha = linea.replace(regex, '')
      const separador = sinFecha.indexOf(':')
      if (separador > 0) {
        const nombre = sinFecha.slice(0, separador).trim()
        const mensaje = sinFecha.slice(separador + 1).trim()
        if (mensaje && !mensaje.includes('omitido') && !mensaje.includes('se unió')) {
          actual.push(`${nombre}: ${mensaje}`)
        }
      }
    }
  }

  // Todo como una conversación (cada archivo de WhatsApp es un chat)
  if (actual.length > 0) {
    conversaciones.push(`=== Conversación 1 ===\n${actual.join('\n')}`)
  }

  return conversaciones.join('\n\n')
}

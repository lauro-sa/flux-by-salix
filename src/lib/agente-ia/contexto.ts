import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConfigAgenteIA, EntradaBaseConocimiento } from '@/tipos/inbox'

/**
 * Constructor del system prompt y contexto para el pipeline del agente IA.
 * Se usa en: pipeline.ts para armar el prompt completo antes de llamar al LLM.
 */

// ─── Tipos internos del contexto ───

export interface DatosContacto {
  nombre: string
  empresa: string | null
  email: string | null
  telefono: string | null
  etiquetas: string[]
}

export interface MensajeContexto {
  es_entrante: boolean
  remitente_nombre: string | null
  texto: string | null
  creado_en: string
}

export interface ConfigIA {
  proveedor: string
  apiKey: string
  modelo: string
}

export interface ContextoPipeline {
  empresa_id: string
  conversacion_id: string
  mensaje_id: string
  mensajes: MensajeContexto[]
  contacto: DatosContacto | null
  base_conocimiento: EntradaBaseConocimiento[]
  config: ConfigAgenteIA
  config_ia: ConfigIA
  empresa_nombre: string
  resultados_previos: Record<string, unknown>
}

// ─── Obtener contexto completo de la BD ───

export async function obtenerContextoCompleto(params: {
  admin: SupabaseClient
  empresa_id: string
  conversacion_id: string
  mensaje_id: string
  config: ConfigAgenteIA
}): Promise<ContextoPipeline> {
  const { admin, empresa_id, conversacion_id, mensaje_id, config } = params

  // Obtener mensajes recientes (últimos 30)
  const { data: mensajes } = await admin
    .from('mensajes')
    .select('es_entrante, remitente_nombre, texto, creado_en')
    .eq('conversacion_id', conversacion_id)
    .eq('es_nota_interna', false)
    .order('creado_en', { ascending: false })
    .limit(30)

  // Obtener datos del contacto desde la conversación
  const { data: conv } = await admin
    .from('conversaciones')
    .select('contacto_nombre, contacto_telefono, contacto_email')
    .eq('id', conversacion_id)
    .single()

  const contacto: DatosContacto | null = conv ? {
    nombre: conv.contacto_nombre || 'Cliente',
    empresa: null,
    email: conv.contacto_email || null,
    telefono: conv.contacto_telefono || null,
    etiquetas: [],
  } : null

  // Si hay contacto con teléfono, buscar etiquetas en la tabla contactos
  if (contacto?.telefono) {
    const { data: contactoBD } = await admin
      .from('contactos')
      .select('empresa, etiquetas')
      .eq('empresa_id', empresa_id)
      .eq('telefono', contacto.telefono)
      .single()

    if (contactoBD) {
      contacto.empresa = contactoBD.empresa || null
      contacto.etiquetas = contactoBD.etiquetas || []
    }
  }

  // Base de conocimiento (solo activas)
  let baseConocimiento: EntradaBaseConocimiento[] = []
  if (config.usar_base_conocimiento) {
    const { data } = await admin
      .from('base_conocimiento_ia')
      .select('id, empresa_id, titulo, contenido, categoria, etiquetas, activo')
      .eq('empresa_id', empresa_id)
      .eq('activo', true)
      .limit(20)

    baseConocimiento = (data || []) as EntradaBaseConocimiento[]
  }

  // Config IA (proveedor, API key, modelo)
  const configIA = await obtenerConfigIA(admin, empresa_id)

  // Nombre de la empresa
  const { data: empresa } = await admin
    .from('empresas')
    .select('nombre')
    .eq('id', empresa_id)
    .single()

  return {
    empresa_id,
    conversacion_id,
    mensaje_id,
    mensajes: (mensajes || []).reverse() as MensajeContexto[],
    contacto,
    base_conocimiento: baseConocimiento,
    config,
    config_ia: configIA,
    empresa_nombre: empresa?.nombre || 'la empresa',
    resultados_previos: {},
  }
}

// ─── Obtener config del proveedor de IA ───

async function obtenerConfigIA(admin: SupabaseClient, empresaId: string): Promise<ConfigIA> {
  const { data: configIA } = await admin
    .from('config_ia')
    .select('habilitado, proveedor_defecto, api_key_anthropic, api_key_openai, modelo_anthropic, modelo_openai')
    .eq('empresa_id', empresaId)
    .single()

  let proveedor = 'anthropic'
  let apiKey = process.env.ANTHROPIC_API_KEY || ''
  let modelo = 'claude-haiku-4-5-20251001'

  if (configIA?.habilitado) {
    const prov = configIA.proveedor_defecto || 'anthropic'
    const keyMap: Record<string, string> = {
      anthropic: configIA.api_key_anthropic,
      openai: configIA.api_key_openai,
    }
    const modeloMap: Record<string, string> = {
      anthropic: configIA.modelo_anthropic || 'claude-haiku-4-5-20251001',
      openai: configIA.modelo_openai || 'gpt-4o-mini',
    }

    if (keyMap[prov]) {
      proveedor = prov
      apiKey = keyMap[prov]
      modelo = modeloMap[prov]
    }
  }

  return { proveedor, apiKey, modelo }
}

// ─── Construir system prompt dinámico ───

export function construirSystemPrompt(ctx: ContextoPipeline): string {
  const { config, contacto, empresa_nombre, base_conocimiento, mensajes } = ctx

  // Historial de mensajes
  const historial = mensajes
    .map(m => {
      const rol = m.es_entrante ? 'Cliente' : 'Agente'
      const nombre = m.remitente_nombre || rol
      return `[${rol}] ${nombre}: ${m.texto || '(sin texto)'}`
    })
    .join('\n')

  // Base de conocimiento
  const conocimiento = base_conocimiento.length > 0
    ? base_conocimiento.map(e => `### ${e.titulo} (${e.categoria})\n${e.contenido}`).join('\n\n')
    : 'No hay base de conocimiento configurada.'

  // Datos del contacto
  const datosContacto = contacto
    ? [
        `- Nombre: ${contacto.nombre}`,
        contacto.empresa ? `- Empresa: ${contacto.empresa}` : null,
        contacto.email ? `- Email: ${contacto.email}` : null,
        contacto.telefono ? `- Teléfono: ${contacto.telefono}` : null,
        contacto.etiquetas.length > 0 ? `- Etiquetas: ${contacto.etiquetas.join(', ')}` : null,
      ].filter(Boolean).join('\n')
    : '- Sin datos del contacto'

  const largoDesc: Record<string, string> = {
    corto: '1 oración máximo',
    medio: '1 a 3 oraciones',
    largo: '1 párrafo completo',
  }

  return `Eres ${config.nombre}, asistente virtual de ${empresa_nombre}.

PERSONALIDAD:
${config.personalidad || 'Profesional y servicial.'}

INSTRUCCIONES DEL NEGOCIO:
${config.instrucciones || 'Sin instrucciones específicas.'}

TONO: ${config.tono}
LARGO DE RESPUESTAS: ${largoDesc[config.largo_respuesta] || 'medio'}

BASE DE CONOCIMIENTO:
${conocimiento}

DATOS DEL CONTACTO:
${datosContacto}

REGLAS:
- Si no sabés la respuesta, decilo honestamente
- Si el cliente pide hablar con un humano, respondé: "${config.mensaje_escalamiento}"
- No inventés información que no esté en la base de conocimiento
- Palabras de escalamiento: ${config.escalar_palabras.join(', ')}
${config.firmar_como ? `- Firmá como: ${config.firmar_como}` : ''}

CONVERSACIÓN ACTUAL:
${historial}

RESPONDÉ EXCLUSIVAMENTE con este JSON (sin texto adicional):
{
  "respuesta": "tu respuesta al cliente",
  "clasificacion": {
    "intencion": "soporte|ventas|consulta|queja|spam|saludo",
    "tema": "string descriptivo",
    "urgencia": "baja|media|alta|critica",
    "confianza": 0-100
  },
  "sentimiento": {
    "valor": "positivo|neutro|negativo|urgente",
    "confianza": 0-100
  },
  "debe_escalar": true/false,
  "razon_escalamiento": "motivo o null",
  "etiquetas_sugeridas": ["etiqueta1", "etiqueta2"],
  "acciones_sugeridas": [
    {"tipo": "crear_actividad", "datos": {"titulo": "...", "descripcion": "..."}},
    {"tipo": "actualizar_contacto", "datos": {"campo": "...", "valor": "..."}}
  ]
}`
}

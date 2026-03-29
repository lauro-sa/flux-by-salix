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
  notas: string | null
  cargo: string | null
  es_provisorio: boolean
  direcciones: { tipo: string; calle: string; barrio: string; ciudad: string; provincia: string; texto: string }[]
}

export interface MensajeContexto {
  es_entrante: boolean
  remitente_nombre: string | null
  texto: string | null
  tipo_contenido: string | null
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
  etiquetas_disponibles: string[]
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
    .select('es_entrante, remitente_nombre, texto, tipo_contenido, creado_en')
    .eq('conversacion_id', conversacion_id)
    .eq('es_nota_interna', false)
    .order('creado_en', { ascending: false })
    .limit(30)

  // Obtener datos del contacto desde la conversación + tabla contactos
  const { data: conv } = await admin
    .from('conversaciones')
    .select('contacto_nombre, contacto_correo, contacto_id')
    .eq('id', conversacion_id)
    .single()

  let contacto: DatosContacto | null = null
  if (conv) {
    contacto = {
      nombre: conv.contacto_nombre || 'Cliente',
      empresa: null,
      email: conv.contacto_correo || null,
      telefono: null,
      etiquetas: [],
      notas: null,
      cargo: null,
      es_provisorio: false,
      direcciones: [],
    }

    // Obtener datos completos del contacto
    if (conv.contacto_id) {
      const { data: contactoBD } = await admin
        .from('contactos')
        .select('nombre, apellido, telefono, empresa, etiquetas, email, notas, cargo, es_provisorio')
        .eq('id', conv.contacto_id)
        .single()

      if (contactoBD) {
        const nombreCompleto = [contactoBD.nombre, contactoBD.apellido].filter(Boolean).join(' ')
        if (nombreCompleto) contacto.nombre = nombreCompleto
        contacto.telefono = contactoBD.telefono || null
        contacto.empresa = contactoBD.empresa || null
        contacto.email = contacto.email || contactoBD.email || null
        contacto.etiquetas = contactoBD.etiquetas || []
        contacto.notas = contactoBD.notas || null
        contacto.cargo = contactoBD.cargo || null
        contacto.es_provisorio = contactoBD.es_provisorio || false
      }

      // Obtener direcciones del contacto
      const { data: direcciones } = await admin
        .from('contacto_direcciones')
        .select('tipo, calle, barrio, ciudad, provincia, texto')
        .eq('contacto_id', conv.contacto_id)

      if (direcciones && direcciones.length > 0) {
        contacto.direcciones = direcciones.map(d => ({
          tipo: d.tipo || 'principal',
          calle: d.calle || '',
          barrio: d.barrio || '',
          ciudad: d.ciudad || '',
          provincia: d.provincia || '',
          texto: d.texto || '',
        }))
      }
    }
  }

  // Base de conocimiento (solo activas)
  // Si hay embeddings, busca semánticamente las más relevantes al último mensaje
  let baseConocimiento: EntradaBaseConocimiento[] = []
  if (config.usar_base_conocimiento) {
    // mensajes vienen ordenados DESC — .at(0) es el más reciente
    const ultimoMensaje = mensajes?.filter((m: { es_entrante: boolean }) => m.es_entrante)?.at(0)
    const textoConsulta = (ultimoMensaje as { texto?: string })?.texto || ''

    // Intentar búsqueda semántica si hay texto
    if (textoConsulta) {
      try {
        const { buscarConocimientoSimilar } = await import('./embeddings')
        const resultados = await buscarConocimientoSimilar(admin, empresa_id, textoConsulta, 5)
        if (resultados.length > 0) {
          baseConocimiento = resultados.map(r => ({
            id: r.id,
            empresa_id,
            titulo: r.titulo,
            contenido: r.contenido,
            categoria: r.categoria,
            etiquetas: [],
            activo: true,
          }))
        }
      } catch {
        // Si falla la búsqueda semántica, no pasa nada — usa fallback
      }
    }

    // Fallback: traer todas las activas si no hubo resultados semánticos
    if (baseConocimiento.length === 0) {
      const { data } = await admin
        .from('base_conocimiento_ia')
        .select('id, empresa_id, titulo, contenido, categoria, etiquetas, activo')
        .eq('empresa_id', empresa_id)
        .eq('activo', true)
        .limit(20)

      baseConocimiento = (data || []) as EntradaBaseConocimiento[]
    }
  }

  // Config IA (proveedor, API key, modelo)
  const configIA = await obtenerConfigIA(admin, empresa_id)

  // Nombre de la empresa
  const { data: empresa } = await admin
    .from('empresas')
    .select('nombre')
    .eq('id', empresa_id)
    .single()

  // Etiquetas disponibles de la empresa (para que el LLM solo sugiera las que existen)
  const { data: etiquetasDisponibles } = await admin
    .from('etiquetas_inbox')
    .select('nombre')
    .eq('empresa_id', empresa_id)

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
    etiquetas_disponibles: (etiquetasDisponibles || []).map(e => e.nombre),
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

// ─── Construir prompts separados (system + user) ───

export interface PromptsAgente {
  sistema: string
  usuario: string
}

export function construirPrompts(ctx: ContextoPipeline): PromptsAgente {
  const { config, contacto, empresa_nombre, base_conocimiento, mensajes, etiquetas_disponibles } = ctx

  // ── Secciones condicionales ──

  const conocimiento = base_conocimiento.length > 0
    ? base_conocimiento.map(e => `### ${e.titulo} (${e.categoria})\n${e.contenido}`).join('\n\n')
    : ''

  const datosContacto = contacto
    ? [
        `- Nombre: ${contacto.nombre}`,
        contacto.empresa ? `- Empresa: ${contacto.empresa}` : null,
        contacto.cargo ? `- Cargo: ${contacto.cargo}` : null,
        contacto.email ? `- Email: ${contacto.email}` : null,
        contacto.telefono ? `- Teléfono: ${contacto.telefono}` : null,
        contacto.etiquetas.length > 0 ? `- Etiquetas: ${contacto.etiquetas.join(', ')}` : null,
        contacto.notas ? `- Notas: ${contacto.notas}` : null,
        contacto.es_provisorio ? '- CONTACTO PROVISORIO (creado automáticamente, puede faltar info)' : null,
        contacto.direcciones.length > 0
          ? `- Direcciones registradas:\n${contacto.direcciones.map(d => `  · ${d.tipo}: ${d.texto || [d.calle, d.barrio, d.ciudad, d.provincia].filter(Boolean).join(', ')}`).join('\n')}`
          : '- Sin dirección registrada',
      ].filter(Boolean).join('\n')
    : '- Sin datos del contacto'

  const largoDesc: Record<string, string> = {
    corto: 'Máximo 1 oración por mensaje. Ultra conciso.',
    medio: 'Máximo 2-3 líneas. Como un mensaje de WhatsApp normal.',
    largo: 'Hasta 5 líneas si es necesario, pero preferí ser breve.',
  }

  // ── Datos del negocio ──
  const datosNegocio = [
    config.zona_cobertura ? `- Zona de cobertura: ${config.zona_cobertura}` : null,
    config.sitio_web ? `- Web: ${config.sitio_web}` : null,
    config.horario_atencion ? `- Horario: ${config.horario_atencion}` : null,
    config.correo_empresa ? `- Correo: ${config.correo_empresa}` : null,
  ].filter(Boolean).join('\n')

  // ── Servicios ──
  const servicios = [
    config.servicios_si ? `SERVICIOS QUE SÍ REALIZAMOS:\n${config.servicios_si}` : null,
    config.servicios_no ? `SERVICIOS QUE NO REALIZAMOS:\n${config.servicios_no}` : null,
  ].filter(Boolean).join('\n\n')

  // ── Tipos de contacto ──
  const tiposContactoArr = Array.isArray(config.tipos_contacto) ? config.tipos_contacto : []
  const tiposContacto = tiposContactoArr.length > 0
    ? tiposContactoArr.map(tc =>
        `### ${tc.icono || ''} ${tc.nombre} (tipo: "${tc.tipo}")\n${tc.instrucciones || ''}\nFormulario:\n${tc.formulario || '(sin formulario)'}`
      ).join('\n\n')
    : ''

  // ── Flujo de conversación ──
  const flujoArr = Array.isArray(config.flujo_conversacion) ? config.flujo_conversacion : []
  const flujo = flujoArr.length > 0
    ? flujoArr.map(p =>
        `PASO ${p.paso} — ${p.titulo}\n${p.descripcion}${p.condicion_avance ? `\n→ Avanzar cuando: ${p.condicion_avance}` : ''}`
      ).join('\n\n')
    : ''

  // ── Ejemplos few-shot ──
  const ejemplosArr = Array.isArray(config.ejemplos_conversacion) ? config.ejemplos_conversacion : []
  const ejemplos = ejemplosArr.length > 0
    ? ejemplosArr.slice(0, 5).map(ej => {
        const msgs = (ej.mensajes || []).map(m =>
          `${m.rol === 'cliente' ? 'Cliente' : 'Agente'}: ${m.texto}`
        ).join('\n')
        return `--- ${ej.titulo} ---\n${msgs}`
      }).join('\n\n')
    : ''

  // ── Fecha actual para reglas de agenda ──
  const fechaHoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  // ══════════════════════════════════════════
  // SYSTEM PROMPT
  // ══════════════════════════════════════════

  const sistema = `Sos ${config.nombre}${config.apodo ? ` (apodo: "${config.apodo}")` : ''}, trabajás en ${empresa_nombre}.

=== REGLA #1: FORMATO WHATSAPP (NO NEGOCIABLE) ===
Estás respondiendo por WhatsApp. Tus mensajes DEBEN verse como mensajes de WhatsApp reales:
- ${largoDesc[config.largo_respuesta] || largoDesc.medio}
- PROHIBIDO usar markdown: nada de **, ##, - listas, * bullets, \`código\`
- PROHIBIDO usar formato de email o carta formal
- PROHIBIDO mandar listas con bullets o numeradas en conversación normal
- Si tenés mucha info, la repartís en oraciones cortas naturales, NO en listas
- Escribí como una persona escribe por WhatsApp: directo, natural, sin formato

=== REGLA #2: NO SOS UN BOT ===
NUNCA decir que sos una IA, bot, asistente virtual, programa, o similar.
NUNCA usar frases como "lamentablemente como IA...", "como asistente virtual no puedo...".
${config.respuesta_si_bot ? `Si te preguntan si sos persona o bot: "${config.respuesta_si_bot}"` : `Si te preguntan si sos persona o bot: "Soy ${config.nombre}, de ${empresa_nombre}. ¿En qué te puedo ayudar?"`}

=== REGLA #3: MEMORIA Y CONTEXTO ===
- Leé TODA la conversación antes de responder
- NUNCA pidas info que el cliente ya dio (nombre, zona, fotos, tipo de trabajo, etc.)
- NUNCA repitas una pregunta que ya hiciste y el cliente ignoró. Si la ignoró, avanzá con otra cosa
- Presentate UNA SOLA VEZ al inicio. Después nunca más digas tu nombre ni de dónde sos
- Revisá si ya te presentaste en mensajes anteriores. Si hay mensajes previos tuyos, NO te presentes
- Si en el historial ves "[Envió una foto]" o "[Envió un video]", el cliente YA mandó foto/video. NO vuelvas a pedir. Agradecé y avanzá con el siguiente paso
- Si ves "[Envió un audio]" seguido de texto, ese texto es la transcripción del audio. Respondé al contenido directamente, NUNCA digas "escuché tu audio" ni "recibí tu mensaje de voz". Tratalo como texto normal

=== REGLA #4: UNA PREGUNTA POR MENSAJE ===
- Hacé UNA sola pregunta por mensaje. Nunca dos o tres juntas
- Si necesitás varios datos, pedí uno a la vez
- Excepción: formularios/templates que se envían como bloque

=== REGLA #5: NATURALIDAD ===
- No uses frases de call center ("estimado cliente", "en virtud de su consulta", "le informamos")
- No copies literalmente lo que dijo el cliente de vuelta
- Usá el nombre del cliente solo de vez en cuando, no en cada mensaje
${config.vocabulario_natural ? `- Palabras que usás: ${config.vocabulario_natural}` : ''}

=== IDENTIDAD ===
Personalidad: ${config.personalidad || 'Profesional y servicial.'}
Tono: ${config.tono}
${config.firmar_como ? `Firma: ${config.firmar_como}` : ''}

=== INFORMACIÓN DEL NEGOCIO ===
Empresa: ${empresa_nombre}
${datosNegocio}

${config.instrucciones ? `INSTRUCCIONES ESPECÍFICAS:\n${config.instrucciones}` : ''}

${servicios ? `=== SERVICIOS ===\n${servicios}` : ''}

${tiposContacto ? `=== TIPOS DE CONTACTO ===\nIdentificá el tipo de contacto y usá el formulario correspondiente:\n\n${tiposContacto}` : ''}

${flujo ? `=== FLUJO DE CONVERSACIÓN ===\nSeguí estos pasos en orden. No te saltees pasos. Evaluá en qué paso estás según el historial:\n\n${flujo}` : ''}

${config.reglas_agenda ? `=== REGLAS DE AGENDA ===\nHoy es ${fechaHoy}.\n${config.reglas_agenda}` : ''}

${config.info_precios ? `=== PRECIOS DE REFERENCIA ===\n${config.info_precios}` : ''}

${config.situaciones_especiales ? `=== SITUACIONES ESPECIALES ===\n${config.situaciones_especiales}` : ''}

${conocimiento ? `=== BASE DE CONOCIMIENTO ===\n${conocimiento}` : ''}

=== DATOS DEL CONTACTO ACTUAL ===
${datosContacto}

=== REGLA: USAR DATOS EXISTENTES ===
- Si el contacto YA tiene datos registrados (nombre, dirección, empresa, etc.), NO vuelvas a preguntar esos datos. Usá la info que ya tenemos.
- Si tiene dirección registrada, confirmá: "Tengo registrada esta dirección: [dirección]. ¿El trabajo es ahí o en otro lado?"
- Si es un contacto provisorio (creado automáticamente), puede que le falte info. Pedí lo que falte.
- Si el cliente dice que quiere un trabajo en OTRA dirección distinta a la registrada, aceptar y pedir la nueva dirección.

=== REGLAS DE NEGOCIO ===
- Si no sabés algo, NO digas "no puedo" ni "lamentablemente". Redirigí la conversación naturalmente
- No inventés información que no esté en tus instrucciones o base de conocimiento
- Si el cliente pide hablar con un humano: "${config.mensaje_escalamiento}"
- Palabras que activan escalamiento: ${config.escalar_palabras.join(', ')}
${etiquetas_disponibles.length > 0 ? `- ETIQUETAS: Solo podés usar estas etiquetas (NO inventes nuevas): ${etiquetas_disponibles.join(', ')}` : '- No hay etiquetas configuradas, dejá etiquetas_sugeridas vacío'}

${ejemplos ? `=== EJEMPLOS DE CÓMO RESPONDÉS ===\n${ejemplos}` : ''}

=== FORMATO DE RESPUESTA ===
RESPONDÉ EXCLUSIVAMENTE con JSON válido (sin texto adicional):
{
  "respuesta": "texto exacto que se manda al cliente (SIN markdown, SIN bullets, SIN formato)",
  "tipo_contacto": "particular|empresa|consorcio|administrador|proveedor|trabajo|spam|desconocido",
  "fase_conversacion": "identificacion|calificacion|datos|agenda|cierre|escalamiento",
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
  "datos_capturados": {
    "nombre": null,
    "zona": null,
    "tipo_trabajo": null,
    "tiene_fotos": false,
    "tipo_facturacion": null,
    "direccion": null,
    "email": null,
    "telefono": null
  },
  "etiquetas_sugeridas": [],
  "acciones_sugeridas": [
    {"tipo": "crear_actividad", "datos": {"titulo": "...", "descripcion": "..."}},
    {"tipo": "actualizar_contacto", "datos": {"campo": "...", "valor": "..."}}
  ]
}`

  // ── User prompt: historial de la conversación actual ──
  const historial = mensajes
    .map(m => {
      const rol = m.es_entrante ? 'Cliente' : 'Agente'
      const nombre = m.remitente_nombre || rol
      // Indicar tipo de media para que el LLM sepa que mandaron foto/video/audio
      const tipoMedia: Record<string, string> = {
        imagen: '[Envió una foto]',
        video: '[Envió un video]',
        audio: '[Envió un audio]',
        documento: '[Envió un documento]',
        sticker: '[Envió un sticker]',
        ubicacion: '[Envió una ubicación]',
      }
      const indicadorMedia = m.tipo_contenido && m.tipo_contenido !== 'texto'
        ? tipoMedia[m.tipo_contenido] || `[Envió ${m.tipo_contenido}]`
        : ''
      const contenido = m.texto
        ? (indicadorMedia ? `${indicadorMedia} ${m.texto}` : m.texto)
        : (indicadorMedia || '(sin texto)')
      return `[${rol}] ${nombre}: ${contenido}`
    })
    .join('\n')

  const usuario = `CONVERSACIÓN ACTUAL:\n${historial}\n\nResponde al último mensaje del cliente.`

  return { sistema, usuario }
}

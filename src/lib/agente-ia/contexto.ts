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

/**
 * Actividad reciente del cliente en el sistema (presupuestos, visitas, órdenes).
 * El IA lo usa para responder con contexto y no preguntar cosas que ya están agendadas/enviadas.
 */
export interface ActividadClienteIA {
  presupuestos: { numero: string; estado: string; total: number | null; moneda: string | null; fecha_emision: string; fecha_vencimiento: string | null; referencia: string | null }[]
  visitas: { fecha_programada: string; estado: string; asignado_nombre: string | null; direccion_texto: string | null; motivo: string | null }[]
  ordenes: { numero: string; estado: string; titulo: string; prioridad: string }[]
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
  actividad: ActividadClienteIA
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

  // Actividad reciente del cliente: presupuestos, visitas, órdenes.
  // Le damos visibilidad al IA de qué tiene en curso el contacto para no preguntar cosas obvias.
  const actividad: ActividadClienteIA = { presupuestos: [], visitas: [], ordenes: [] }
  if (conv?.contacto_id) {
    const desde60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const ahoraISO = new Date().toISOString()

    // Presupuestos: no borradores ni cancelados, últimos 60 días o vigentes
    const { data: presupuestos } = await admin
      .from('presupuestos')
      .select('numero, estado, total_final, moneda, fecha_emision, fecha_vencimiento, referencia')
      .eq('empresa_id', empresa_id)
      .eq('contacto_id', conv.contacto_id)
      .not('estado', 'in', '(borrador,cancelado)')
      .gte('fecha_emision', desde60d)
      .order('fecha_emision', { ascending: false })
      .limit(5)

    actividad.presupuestos = (presupuestos || []).map(p => ({
      numero: p.numero,
      estado: p.estado,
      total: p.total_final !== null && p.total_final !== undefined ? Number(p.total_final) : null,
      moneda: p.moneda,
      fecha_emision: p.fecha_emision,
      fecha_vencimiento: p.fecha_vencimiento,
      referencia: p.referencia,
    }))

    // Visitas activas o próximas (no canceladas, no completadas hace más de 30 días)
    const desde30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: visitas } = await admin
      .from('visitas')
      .select('fecha_programada, estado, asignado_nombre, direccion_texto, motivo, fecha_completada')
      .eq('empresa_id', empresa_id)
      .eq('contacto_id', conv.contacto_id)
      .neq('estado', 'cancelada')
      .or(`fecha_programada.gte.${ahoraISO},fecha_completada.gte.${desde30d}`)
      .order('fecha_programada', { ascending: true })
      .limit(5)

    actividad.visitas = (visitas || []).map(v => ({
      fecha_programada: v.fecha_programada,
      estado: v.estado,
      asignado_nombre: v.asignado_nombre,
      direccion_texto: v.direccion_texto,
      motivo: v.motivo,
    }))

    // Órdenes de trabajo activas
    const { data: ordenes } = await admin
      .from('ordenes_trabajo')
      .select('numero, estado, titulo, prioridad')
      .eq('empresa_id', empresa_id)
      .eq('contacto_id', conv.contacto_id)
      .in('estado', ['abierta', 'en_progreso', 'esperando'])
      .order('creado_en', { ascending: false })
      .limit(5)

    actividad.ordenes = (ordenes || []).map(o => ({
      numero: o.numero,
      estado: o.estado,
      titulo: o.titulo,
      prioridad: o.prioridad,
    }))
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
    actividad,
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

// ─── Formateo de actividad reciente para el prompt ───

/**
 * Resume la actividad del cliente (presupuestos, visitas, órdenes) en un bloque legible.
 * Le da al IA la "noción" de qué tiene en curso el contacto: no tiene que contarle todo,
 * pero sí sabe que existe un Pres 26-080 vigente, o que hay una visita programada para el jueves.
 * Se omite el bloque entero si no hay actividad.
 */
function formatearActividadCliente(actividad: ActividadClienteIA, locale: string, zonaHoraria: string): string {
  const hayActividad = actividad.presupuestos.length > 0 || actividad.visitas.length > 0 || actividad.ordenes.length > 0
  if (!hayActividad) return ''

  const fmtFecha = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: zonaHoraria })
    } catch { return iso }
  }
  const fmtFechaHora = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: zonaHoraria })
    } catch { return iso }
  }
  const fmtMoneda = (total: number | null, moneda: string | null) => {
    if (total === null) return ''
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: moneda || 'ARS', maximumFractionDigits: 0 }).format(total)
    } catch { return `${total} ${moneda || ''}`.trim() }
  }

  const bloques: string[] = []

  if (actividad.presupuestos.length > 0) {
    const lineas = actividad.presupuestos.map(p => {
      const total = fmtMoneda(p.total, p.moneda)
      const ref = p.referencia ? ` — ${p.referencia}` : ''
      const venc = p.fecha_vencimiento ? ` (vence ${fmtFecha(p.fecha_vencimiento)})` : ''
      return `- ${p.numero} · ${p.estado} · emitido ${fmtFecha(p.fecha_emision)}${total ? ` · ${total}` : ''}${venc}${ref}`
    }).join('\n')
    bloques.push(`PRESUPUESTOS RECIENTES:\n${lineas}`)
  }

  if (actividad.visitas.length > 0) {
    const lineas = actividad.visitas.map(v => {
      const asignado = v.asignado_nombre ? ` · asignada a ${v.asignado_nombre}` : ''
      const dir = v.direccion_texto ? ` · ${v.direccion_texto}` : ''
      const motivo = v.motivo ? ` · motivo: ${v.motivo}` : ''
      return `- ${fmtFechaHora(v.fecha_programada)} · ${v.estado}${asignado}${dir}${motivo}`
    }).join('\n')
    bloques.push(`VISITAS:\n${lineas}`)
  }

  if (actividad.ordenes.length > 0) {
    const lineas = actividad.ordenes.map(o =>
      `- ${o.numero} · ${o.estado} · prioridad ${o.prioridad} · ${o.titulo}`
    ).join('\n')
    bloques.push(`ÓRDENES DE TRABAJO ABIERTAS:\n${lineas}`)
  }

  return `=== ACTIVIDAD RECIENTE DEL CLIENTE ===
${bloques.join('\n\n')}

REGLAS:
- Si el cliente pregunta por un trabajo/presupuesto/visita que YA está acá, no le preguntes "qué trabajo necesitás". Hacé referencia a lo que ya tiene.
- No le dictes todos los datos (número, total, fecha) a menos que lo pida explícitamente. Alcanza con "ya te enviamos el presupuesto" o "tenemos tu visita del jueves".
- Si lo que dice el cliente NO matchea con nada de lo anterior, tratalo como consulta nueva.`
}

// ─── Construir prompts separados (system + user) ───

export interface PromptsAgente {
  sistema: string
  usuario: string
}

export function construirPrompts(ctx: ContextoPipeline, opciones?: { locale?: string; zonaHoraria?: string }): PromptsAgente {
  const { config, contacto, actividad, empresa_nombre, base_conocimiento, mensajes, etiquetas_disponibles } = ctx

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
  // IMPORTANTE: en Vercel el servidor corre en UTC. Sin `timeZone` explícito, después de las 21:00
  // Argentina `new Date().toLocaleDateString()` devuelve el día siguiente (UTC ya pasó medianoche).
  // Por eso hay que pasar la zona horaria de la empresa para calcular el día real del cliente.
  const locale = opciones?.locale || 'es-AR'
  const zonaHoraria = opciones?.zonaHoraria || 'America/Argentina/Buenos_Aires'
  const ahora = new Date()
  const fechaHoy = ahora.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: zonaHoraria })
  // Fecha ISO (YYYY-MM-DD) calculada también en la zona de la empresa, para que el LLM la use al armar fecha_acordada
  const fechaHoyISO = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zonaHoraria }).format(ahora)

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

=== REGLA #6: NO REPETIR NI HACER LOOP ===
- Si el cliente dice "sí", "si", "correcto", "dale", "ok" → ACEPTAR y AVANZAR al siguiente paso. NUNCA volver a preguntar lo mismo
- Si ya confirmaste algo (dirección, nombre, etc.), NO volver a preguntar "¿es correcto?" sobre lo mismo
- Si ya hiciste una pregunta y el cliente la respondió, AVANZAR. No quedarte preguntando lo mismo de distintas formas
- NUNCA mandar 2 mensajes seguidos preguntando lo mismo
- CHECK OBLIGATORIO antes de preguntar un dato: revisá si ese dato ya está en "DATOS DEL CONTACTO ACTUAL" o en el historial (mensajes previos del cliente). Si está → NO preguntar, usarlo directamente
- Si ves que tus mensajes anteriores ya hicieron una pregunta y el cliente no respondió ESA pregunta específica pero sí mandó otra info → asumir que ignoró esa pregunta y avanzar con la info que mandó

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

${formatearActividadCliente(actividad, opciones?.locale || 'es-AR', opciones?.zonaHoraria || 'America/Argentina/Buenos_Aires')}

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
    "telefono": null,
    "fecha_acordada": null,
    "franja_horaria": null
  },
  "etiquetas_sugeridas": [],
  "acciones_sugeridas": [
    {"tipo": "crear_actividad", "datos": {"titulo": "...", "descripcion": "..."}},
    {"tipo": "actualizar_contacto", "datos": {"campo": "...", "valor": "..."}},
    {"tipo": "crear_visita", "datos": {}}
  ]
}

=== CUÁNDO CREAR VISITA ===
Emití la acción "crear_visita" UNA SOLA VEZ cuando TODAS estas condiciones se cumplan en la conversación:
- Se acordó un DÍA concreto con el cliente (ej: "martes", "el jueves", "pasado mañana", una fecha específica)
- Hay dirección conocida (capturada o ya registrada en el contacto)
- El cliente confirmó (dijo "sí", "dale", "ok", "perfecto")

Cuando emitas "crear_visita":
- En "datos_capturados.fecha_acordada" poné la fecha en formato YYYY-MM-DD (hoy es ${fechaHoy} = ${fechaHoyISO}, usala para resolver "mañana", "el martes", etc.)
- En "datos_capturados.franja_horaria" poné la franja en lenguaje natural ("11 a 16hs", "por la mañana", "tarde")
- Si ya emitiste "crear_visita" en un turno previo (revisá el historial), NO la vuelvas a emitir.
- La visita queda como PROVISORIA y un humano la confirma después. No le digas al cliente "tu visita está confirmada" — decile "le paso al equipo para confirmarte" o similar.`

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

  // Info adicional pre-procesada (ej: dirección validada por Google)
  const infoExtra: string[] = []
  if (ctx.resultados_previos.direccion_validada) {
    const dirVal = ctx.resultados_previos.direccion_validada as string
    infoExtra.push(
      `[SISTEMA — DIRECCIÓN VALIDADA POR EL MAPA]\n` +
      `El cliente mencionó una dirección. El mapa la normalizó a:\n` +
      `"${dirVal}"\n\n` +
      `REGLA CRÍTICA:\n` +
      `1. En tu "respuesta", confirmá ESTA dirección (la del mapa), NO la que tipeó el cliente. ` +
      `El cliente suele escribir incompleto o con errores de barrio/ciudad; la del mapa es la correcta.\n` +
      `2. En "datos_capturados.direccion" poné EXACTAMENTE: "${dirVal}"\n` +
      `3. Pedí confirmación al cliente en forma natural, sin mencionar "mapa", "Google", "sistema" ni "validación". ` +
      `Ejemplo: "¿La dirección sería ${dirVal}?" o "Te confirmo: ${dirVal}, ¿está bien?"\n` +
      `4. Si el cliente ya la confirmó en mensajes previos, NO volver a preguntar — usala directamente y avanzá.`
    )
  }

  const extra = infoExtra.length > 0 ? `\n\n${infoExtra.join('\n')}` : ''
  const usuario = `CONVERSACIÓN ACTUAL:\n${historial}${extra}\n\nResponde al último mensaje del cliente.`

  return { sistema, usuario }
}

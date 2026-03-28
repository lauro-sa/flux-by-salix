/**
 * Cliente de la Meta Cloud API para WhatsApp Business.
 * Centraliza todas las llamadas a la API de Meta.
 * Se usa en: API routes de WhatsApp (webhook, enviar, plantillas, media, calidad).
 */

const META_API_VERSION = 'v19.0'
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

// ─── Tipos ───

export interface ConfigCuentaWhatsApp {
  phoneNumberId: string
  wabaId: string
  tokenAcceso: string
  secretoWebhook?: string
  tokenVerificacion?: string
  numeroTelefono: string
}

export interface RespuestaMetaMensaje {
  messaging_product: string
  contacts: { input: string; wa_id: string }[]
  messages: { id: string }[]
}

export interface CalidadWhatsApp {
  quality_rating: 'GREEN' | 'YELLOW' | 'RED'
  messaging_limit_tier: string
  status: string
}

export interface PlantillaMeta {
  id: string
  name: string
  language: string
  category: string
  status: string
  components: ComponentePlantillaMeta[]
}

export interface ComponentePlantillaMeta {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: string
  text?: string
  example?: Record<string, unknown>
  buttons?: BotonPlantillaMeta[]
}

export interface BotonPlantillaMeta {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  text: string
  url?: string
  phone_number?: string
  example?: string[]
}

// Tipos de mensaje entrante de Meta
export interface MensajeEntranteMeta {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'interactive' | 'location' | 'contacts' | 'reaction'
  text?: { body: string }
  image?: { id: string; mime_type: string; sha256: string; caption?: string }
  video?: { id: string; mime_type: string; sha256: string; caption?: string }
  audio?: { id: string; mime_type: string; sha256: string }
  document?: { id: string; mime_type: string; sha256: string; filename: string; caption?: string }
  sticker?: { id: string; mime_type: string; sha256: string; animated: boolean }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  contacts?: unknown[]
  reaction?: { message_id: string; emoji: string }
}

export interface EstadoMensajeMeta {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: { code: number; title: string }[]
}

export interface WebhookPayloadMeta {
  object: string
  entry: {
    id: string
    changes: {
      field: string
      value: {
        messaging_product: string
        metadata: { display_phone_number: string; phone_number_id: string }
        contacts?: { profile: { name: string }; wa_id: string }[]
        messages?: MensajeEntranteMeta[]
        statuses?: EstadoMensajeMeta[]
        // Template status updates
        event?: string
        message_template_name?: string
        message_template_id?: string
        reason?: string
        rejected_reason?: string
      }
    }[]
  }[]
}

// ─── Funciones de la API ───

/** Enviar mensaje de texto */
export async function enviarTextoWhatsApp(
  config: ConfigCuentaWhatsApp,
  telefono: string,
  texto: string,
): Promise<RespuestaMetaMensaje> {
  const res = await fetch(`${META_BASE_URL}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.tokenAcceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'text',
      text: { preview_url: false, body: texto },
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Meta API error: ${JSON.stringify(error)}`)
  }

  return res.json()
}

/** Enviar mensaje con media (imagen, video, audio, documento) */
export async function enviarMediaWhatsApp(
  config: ConfigCuentaWhatsApp,
  telefono: string,
  tipo: 'image' | 'video' | 'audio' | 'document',
  mediaUrl: string,
  caption?: string,
  filename?: string,
): Promise<RespuestaMetaMensaje> {
  const mediaPayload: Record<string, unknown> = { link: mediaUrl }
  if (caption) mediaPayload.caption = caption
  if (filename && tipo === 'document') mediaPayload.filename = filename

  const res = await fetch(`${META_BASE_URL}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.tokenAcceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: tipo,
      [tipo]: mediaPayload,
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Meta API error: ${JSON.stringify(error)}`)
  }

  return res.json()
}

/** Enviar plantilla */
export async function enviarPlantillaWhatsApp(
  config: ConfigCuentaWhatsApp,
  telefono: string,
  nombreApi: string,
  idioma: string,
  componentes?: Record<string, unknown>[],
): Promise<RespuestaMetaMensaje> {
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: telefono,
    type: 'template',
    template: {
      name: nombreApi,
      language: { code: idioma },
      ...(componentes && componentes.length > 0 ? { components: componentes } : {}),
    },
  }

  const res = await fetch(`${META_BASE_URL}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.tokenAcceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Meta API error: ${JSON.stringify(error)}`)
  }

  return res.json()
}

/** Enviar mensaje interactivo (lista o botones) */
export async function enviarInteractivoWhatsApp(
  config: ConfigCuentaWhatsApp,
  telefono: string,
  tipo: 'list' | 'button',
  cuerpo: string,
  acciones: Record<string, unknown>,
  encabezado?: string,
  piePagina?: string,
): Promise<RespuestaMetaMensaje> {
  const interactive: Record<string, unknown> = {
    type: tipo,
    body: { text: cuerpo },
    action: acciones,
  }
  if (encabezado) interactive.header = { type: 'text', text: encabezado }
  if (piePagina) interactive.footer = { text: piePagina }

  const res = await fetch(`${META_BASE_URL}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.tokenAcceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'interactive',
      interactive,
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Meta API error: ${JSON.stringify(error)}`)
  }

  return res.json()
}

/** Obtener URL de descarga de un media */
export async function obtenerUrlMedia(
  mediaId: string,
  tokenAcceso: string,
): Promise<{ url: string; mime_type: string; file_size: number }> {
  const res = await fetch(`${META_BASE_URL}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${tokenAcceso}` },
  })

  if (!res.ok) throw new Error('Error al obtener URL de media')
  return res.json()
}

/** Descargar buffer de un media */
export async function descargarMediaBuffer(
  url: string,
  tokenAcceso: string,
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${tokenAcceso}` },
  })

  if (!res.ok) throw new Error('Error al descargar media')

  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const buffer = await res.arrayBuffer()
  return { buffer, contentType }
}

/** Obtener calidad del número */
export async function obtenerCalidadNumero(
  config: ConfigCuentaWhatsApp,
): Promise<CalidadWhatsApp> {
  const res = await fetch(
    `${META_BASE_URL}/${config.phoneNumberId}?fields=quality_rating,messaging_limit_tier,status`,
    { headers: { 'Authorization': `Bearer ${config.tokenAcceso}` } },
  )

  if (!res.ok) throw new Error('Error al obtener calidad')
  return res.json()
}

/** Listar plantillas desde Meta */
export async function listarPlantillasMeta(
  config: ConfigCuentaWhatsApp,
  limite = 250,
): Promise<PlantillaMeta[]> {
  const res = await fetch(
    `${META_BASE_URL}/${config.wabaId}/message_templates?limit=${limite}`,
    { headers: { 'Authorization': `Bearer ${config.tokenAcceso}` } },
  )

  if (!res.ok) throw new Error('Error al listar plantillas de Meta')
  const data = await res.json()
  return data.data || []
}

/** Crear plantilla en Meta */
export async function crearPlantillaMeta(
  config: ConfigCuentaWhatsApp,
  nombre: string,
  idioma: string,
  categoria: string,
  componentes: ComponentePlantillaMeta[],
): Promise<{ id: string; status: string }> {
  const res = await fetch(`${META_BASE_URL}/${config.wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.tokenAcceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: nombre,
      language: idioma,
      category: categoria,
      components: componentes,
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Error al crear plantilla: ${JSON.stringify(error)}`)
  }

  return res.json()
}

/** Eliminar plantilla de Meta */
export async function eliminarPlantillaMeta(
  config: ConfigCuentaWhatsApp,
  nombreApi: string,
): Promise<void> {
  const res = await fetch(
    `${META_BASE_URL}/${config.wabaId}/message_templates?name=${nombreApi}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${config.tokenAcceso}` },
    },
  )

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Error al eliminar plantilla: ${JSON.stringify(error)}`)
  }
}

/** Enviar indicador "escribiendo..." al cliente */
export async function enviarTypingWhatsApp(
  config: ConfigCuentaWhatsApp,
  telefono: string,
): Promise<void> {
  await fetch(`${META_BASE_URL}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.tokenAcceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'reaction',
      status: 'typing',
    }),
  }).catch(() => {}) // No fallar si el typing no se envía
}

/** Enviar reacción con emoji a un mensaje */
export async function enviarReaccionWhatsApp(
  config: ConfigCuentaWhatsApp,
  telefono: string,
  mensajeId: string,
  emoji: string,
): Promise<void> {
  const res = await fetch(`${META_BASE_URL}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.tokenAcceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'reaction',
      reaction: {
        message_id: mensajeId,
        emoji: emoji, // "" (vacío) para quitar reacción
      },
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Error al enviar reacción: ${JSON.stringify(error)}`)
  }
}

/** Verificar firma HMAC-SHA256 del webhook */
export async function verificarFirmaWebhook(
  secreto: string,
  payload: string,
  firmaHeader: string,
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const hash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const esperada = `sha256=${hash}`
  return firmaHeader === esperada
}

// ─── Helpers ───

/** Mapear tipo de mensaje Meta a tipo de contenido de Flux */
export function mapearTipoContenido(tipoMeta: string): string {
  const mapa: Record<string, string> = {
    text: 'texto',
    image: 'imagen',
    video: 'video',
    audio: 'audio',
    document: 'documento',
    sticker: 'sticker',
    location: 'ubicacion',
    contacts: 'contacto_compartido',
    interactive: 'texto',
  }
  return mapa[tipoMeta] || 'texto'
}

/** Extraer texto/caption del mensaje (solo contenido real, sin placeholders) */
export function extraerTextoMensaje(msg: MensajeEntranteMeta): string {
  switch (msg.type) {
    case 'text': return msg.text?.body || ''
    case 'image': return msg.image?.caption || ''
    case 'video': return msg.video?.caption || ''
    case 'audio': return ''
    case 'document': return msg.document?.caption || ''
    case 'sticker': return ''
    case 'location': return msg.location?.name || msg.location?.address || ''
    case 'interactive':
      return msg.interactive?.button_reply?.title
        || msg.interactive?.list_reply?.title
        || ''
    default: return ''
  }
}

/** Texto descriptivo para preview en lista de conversaciones */
export function textoPreviewMensaje(msg: MensajeEntranteMeta): string {
  switch (msg.type) {
    case 'text': return msg.text?.body || ''
    case 'image': return msg.image?.caption || '📷 Imagen'
    case 'video': return msg.video?.caption || '🎬 Video'
    case 'audio': return '🎤 Audio'
    case 'document': return msg.document?.caption || `📄 ${msg.document?.filename || 'Documento'}`
    case 'sticker': return '🏷️ Sticker'
    case 'location': return `📍 ${msg.location?.name || 'Ubicación'}`
    case 'interactive':
      return msg.interactive?.button_reply?.title
        || msg.interactive?.list_reply?.title
        || 'Respuesta'
    default: return ''
  }
}

/** Extraer mediaId si el mensaje tiene adjunto */
export function extraerMediaId(msg: MensajeEntranteMeta): string | null {
  switch (msg.type) {
    case 'image': return msg.image?.id || null
    case 'video': return msg.video?.id || null
    case 'audio': return msg.audio?.id || null
    case 'document': return msg.document?.id || null
    case 'sticker': return msg.sticker?.id || null
    default: return null
  }
}

/** Extraer mime_type del adjunto (sin parámetros como "; codecs=opus") */
export function extraerMimeType(msg: MensajeEntranteMeta): string {
  let mime: string
  switch (msg.type) {
    case 'image': mime = msg.image?.mime_type || 'image/jpeg'; break
    case 'video': mime = msg.video?.mime_type || 'video/mp4'; break
    case 'audio': mime = msg.audio?.mime_type || 'audio/ogg'; break
    case 'document': mime = msg.document?.mime_type || 'application/pdf'; break
    case 'sticker': mime = msg.sticker?.mime_type || 'image/webp'; break
    default: mime = 'application/octet-stream'
  }
  // Quitar parámetros: "audio/ogg; codecs=opus" → "audio/ogg"
  return mime.split(';')[0].trim()
}

/** Sanitizar nombre de archivo para Storage (quitar caracteres problemáticos) */
function sanitizarNombreArchivo(nombre: string): string {
  return nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Solo alfanuméricos, punto, guion, guion bajo
    .replace(/_+/g, '_') // Colapsar guiones bajos múltiples
    .replace(/^_|_$/g, '') // Quitar guiones bajos al inicio/final
    .slice(0, 100) // Limitar largo
}

/** Extraer nombre de archivo */
export function extraerNombreArchivo(msg: MensajeEntranteMeta): string {
  // Para documentos, usar filename original pero sanitizado
  if (msg.type === 'document' && msg.document?.filename) {
    return sanitizarNombreArchivo(msg.document.filename)
  }
  const extensiones: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
    'video/mp4': '.mp4', 'video/3gpp': '.3gp',
    'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/aac': '.aac', 'audio/amr': '.amr',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  }
  const mime = extraerMimeType(msg)
  const ext = extensiones[mime] || ''
  return `${msg.type}_${msg.id.replace(/[^a-zA-Z0-9]/g, '')}${ext}`
}

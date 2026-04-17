import { google } from 'googleapis'

/**
 * Cliente de la Gmail API para Flux by Salix.
 * Maneja sincronización, envío y parsing de correos vía Gmail API.
 * Se usa en: API routes de /api/inbox/correo/
 *
 * Requiere variables de entorno:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL (para el redirect URI)
 */

// ─── Scopes de Gmail ───

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
]

// ─── Tipos ───

export interface CorreoParsedo {
  messageId: string        // Header Message-ID
  gmailId: string          // ID interno de Gmail
  threadId: string         // Thread ID de Gmail
  de: string               // From
  para: string[]           // To
  cc: string[]             // CC
  cco: string[]            // BCC
  asunto: string           // Subject
  fecha: string            // Date (ISO)
  inReplyTo: string | null // In-Reply-To header
  references: string[]     // References header (array)
  textoPlano: string       // text/plain body
  html: string             // text/html body
  adjuntos: AdjuntoCorreoParsedo[]
  etiquetas: string[]      // Gmail labels (INBOX, SENT, etc.)
}

export interface AdjuntoCorreoParsedo {
  attachmentId: string     // Gmail attachment ID
  nombre: string           // Filename
  tipoMime: string         // MIME type
  tamano: number           // Size in bytes
  contenido?: Buffer       // Contenido raw (disponible en IMAP, no en Gmail)
}

export interface CursorSincronizacion {
  historyId?: string       // Gmail historyId para sync incremental
  ultimoUID?: number       // IMAP último UID sincronizado
  ultimaSincronizacion?: string // ISO timestamp
}

// ─── Cliente OAuth2 ───

/** Crea un cliente OAuth2 con redirect URI para inbox */
export function crearClienteOAuthGmail() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/inbox/correo/oauth/callback`
  )
}

/** Genera URL de autorización de Google para Gmail */
export function generarUrlAutorizacionGmail(estado: string): string {
  const oauth2 = crearClienteOAuthGmail()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state: estado,
  })
}

/** Intercambia el código de autorización por tokens */
export async function intercambiarCodigoGmail(codigo: string) {
  const oauth2 = crearClienteOAuthGmail()
  const { tokens } = await oauth2.getToken(codigo)
  return tokens
}

/** Obtiene un access token fresco usando el refresh token */
export async function obtenerAccessTokenGmail(refreshToken: string): Promise<string> {
  const oauth2 = crearClienteOAuthGmail()
  oauth2.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2.refreshAccessToken()
  return credentials.access_token!
}

/** Obtiene el email del usuario autenticado */
export async function obtenerEmailGmail(accessToken: string): Promise<string> {
  const oauth2 = crearClienteOAuthGmail()
  oauth2.setCredentials({ access_token: accessToken })
  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
  const { data } = await oauth2Api.userinfo.get()
  return data.email || ''
}

// ─── Crear cliente Gmail autenticado ───

/** Crea una instancia autenticada de Gmail API */
export function crearClienteGmail(refreshToken: string) {
  const oauth2 = crearClienteOAuthGmail()
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth: oauth2 })
}

// ─── Listar mensajes ───

interface ResultadoListaMensajes {
  mensajes: { id: string; threadId: string }[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

/** Lista IDs de mensajes que coinciden con un query */
export async function listarMensajesGmail(
  refreshToken: string,
  query: string,
  pageToken?: string,
  maxResults = 50,
): Promise<ResultadoListaMensajes> {
  const gmail = crearClienteGmail(refreshToken)
  const { data } = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    pageToken,
    maxResults,
  })

  return {
    mensajes: (data.messages || []).map(m => ({
      id: m.id!,
      threadId: m.threadId!,
    })),
    nextPageToken: data.nextPageToken || undefined,
    resultSizeEstimate: data.resultSizeEstimate || 0,
  }
}

// ─── Obtener mensaje completo ───

/** Parsea los headers de un mensaje de Gmail en un objeto */
function parsearCabeceras(headers: { name?: string; value?: string }[]): Record<string, string> {
  const resultado: Record<string, string> = {}
  for (const h of headers) {
    if (h.name && h.value) {
      resultado[h.name.toLowerCase()] = h.value
    }
  }
  return resultado
}

/** Parsea direcciones de email tipo "Nombre <email@ejemplo.com>, otro@ejemplo.com" */
function parsearDirecciones(valor: string | undefined): string[] {
  if (!valor) return []
  return valor
    .split(',')
    .map(d => d.trim())
    .filter(Boolean)
}

/** Decodifica base64url a string UTF-8 */
function decodificarBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

/** Extrae el cuerpo (text/plain y text/html) de un mensaje de Gmail */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extraerCuerpo(payload: any): { textoPlano: string; html: string } {
  let textoPlano = ''
  let html = ''

  // Recorrer recursivamente toda la estructura MIME
  // (los correos con adjuntos pueden tener 3+ niveles: mixed → related → alternative → text/html)
  function recorrer(parte: any) {
    if (!parte) return

    if (parte.mimeType === 'text/plain' && parte.body?.data) {
      textoPlano = decodificarBase64Url(parte.body.data)
    } else if (parte.mimeType === 'text/html' && parte.body?.data) {
      html = decodificarBase64Url(parte.body.data)
    }

    if (parte.parts) {
      for (const sub of parte.parts) {
        recorrer(sub)
      }
    }
  }

  recorrer(payload)
  return { textoPlano, html }
}

/** Extrae metadata de adjuntos de un mensaje de Gmail */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extraerAdjuntos(payload: any): AdjuntoCorreoParsedo[] {
  const adjuntos: AdjuntoCorreoParsedo[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function procesarPartes(parts: any[]) {
    if (!parts) return
    for (const part of parts) {
      if (part.body?.attachmentId && part.filename) {
        adjuntos.push({
          attachmentId: part.body.attachmentId,
          nombre: part.filename,
          tipoMime: part.mimeType || 'application/octet-stream',
          tamano: part.body.size || 0,
        })
      }
      if (part.parts) {
        procesarPartes(part.parts as typeof payload.parts)
      }
    }
  }

  procesarPartes(payload.parts)
  return adjuntos
}

/** Obtiene y parsea un mensaje completo de Gmail */
export async function obtenerMensajeCompleto(
  refreshToken: string,
  messageId: string,
): Promise<CorreoParsedo> {
  const gmail = crearClienteGmail(refreshToken)
  const { data } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })

  // Cast para manejar null vs undefined de la API de Google
  const rawHeaders = (data.payload?.headers || []) as { name?: string; value?: string }[]
  const headers = parsearCabeceras(rawHeaders)
  const { textoPlano, html } = extraerCuerpo(data.payload as Record<string, unknown> || {})
  const adjuntos = extraerAdjuntos(data.payload as Record<string, unknown> || {})

  // Parsear References (puede ser un string con múltiples IDs separados por espacio)
  const referencesRaw = headers['references'] || ''
  const references = referencesRaw
    .split(/\s+/)
    .map(r => r.trim())
    .filter(Boolean)

  return {
    messageId: headers['message-id'] || '',
    gmailId: data.id || messageId,
    threadId: data.threadId || '',
    de: headers['from'] || '',
    para: parsearDirecciones(headers['to']),
    cc: parsearDirecciones(headers['cc']),
    cco: parsearDirecciones(headers['bcc']),
    asunto: headers['subject'] || '',
    fecha: headers['date']
      ? new Date(headers['date']).toISOString()
      : new Date(parseInt(data.internalDate || '0')).toISOString(),
    inReplyTo: headers['in-reply-to'] || null,
    references,
    textoPlano,
    html,
    adjuntos,
    etiquetas: data.labelIds || [],
  }
}

// ─── Descargar adjunto ───

/** Descarga un adjunto de Gmail y retorna el buffer */
export async function descargarAdjuntoGmail(
  refreshToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const gmail = crearClienteGmail(refreshToken)
  const { data } = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  })

  if (!data.data) throw new Error('Adjunto sin datos')

  // Gmail devuelve base64url
  const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64')
}

// ─── Enviar correo ───

/** Opciones para construir un mensaje RFC 2822 */
export interface OpcionesMensajeRFC2822 {
  de: string
  para: string[]
  cc?: string[]
  cco?: string[]
  asunto: string
  textoPlano: string
  html?: string
  inReplyTo?: string
  references?: string[]
  adjuntos?: {
    nombre: string
    tipoMime: string
    contenido: Buffer
  }[]
}

/** Genera un Message-ID RFC 5322 único para identificar el correo */
export function generarMessageId(dominio?: string): string {
  const dom = dominio || 'flux.app'
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `<${ts}.${rand}@${dom}>`
}

/** Construye un mensaje RFC 2822 como string base64url para enviar via Gmail API.
 *  Retorna { raw, messageId } donde messageId es el Message-ID generado. */
export function construirMensajeRFC2822(opciones: OpcionesMensajeRFC2822): { raw: string; messageId: string } {
  const boundary = `flux_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const tieneAdjuntos = opciones.adjuntos && opciones.adjuntos.length > 0

  // Generar Message-ID propio para que coincida entre envío y sync
  const dominioRemitente = opciones.de.match(/@([^>]+)/)?.[1] || 'flux.app'
  const messageId = generarMessageId(dominioRemitente)

  const lineas: string[] = []

  // Headers obligatorios
  lineas.push(`Message-ID: ${messageId}`)
  lineas.push(`From: ${opciones.de}`)
  lineas.push(`To: ${opciones.para.join(', ')}`)
  if (opciones.cc?.length) lineas.push(`CC: ${opciones.cc.join(', ')}`)
  if (opciones.cco?.length) lineas.push(`BCC: ${opciones.cco.join(', ')}`)
  lineas.push(`Subject: =?UTF-8?B?${Buffer.from(opciones.asunto).toString('base64')}?=`)
  lineas.push(`Date: ${new Date().toUTCString()}`)
  lineas.push(`MIME-Version: 1.0`)

  // Headers de threading
  if (opciones.inReplyTo) {
    lineas.push(`In-Reply-To: ${opciones.inReplyTo}`)
  }
  if (opciones.references?.length) {
    lineas.push(`References: ${opciones.references.join(' ')}`)
  }

  if (tieneAdjuntos) {
    // multipart/mixed → multipart/alternative + adjuntos
    lineas.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lineas.push('')
    lineas.push(`--${boundary}`)

    // Parte del cuerpo (alternative)
    const bodyBoundary = `${boundary}_alt`
    lineas.push(`Content-Type: multipart/alternative; boundary="${bodyBoundary}"`)
    lineas.push('')

    // Texto plano
    lineas.push(`--${bodyBoundary}`)
    lineas.push('Content-Type: text/plain; charset="UTF-8"')
    lineas.push('Content-Transfer-Encoding: base64')
    lineas.push('')
    lineas.push(Buffer.from(opciones.textoPlano).toString('base64'))
    lineas.push('')

    // HTML
    if (opciones.html) {
      lineas.push(`--${bodyBoundary}`)
      lineas.push('Content-Type: text/html; charset="UTF-8"')
      lineas.push('Content-Transfer-Encoding: base64')
      lineas.push('')
      lineas.push(Buffer.from(opciones.html).toString('base64'))
      lineas.push('')
    }

    lineas.push(`--${bodyBoundary}--`)

    // Adjuntos
    for (const adj of opciones.adjuntos!) {
      lineas.push(`--${boundary}`)
      lineas.push(`Content-Type: ${adj.tipoMime}; name="${adj.nombre}"`)
      lineas.push(`Content-Disposition: attachment; filename="${adj.nombre}"`)
      lineas.push('Content-Transfer-Encoding: base64')
      lineas.push('')
      lineas.push(adj.contenido.toString('base64'))
      lineas.push('')
    }

    lineas.push(`--${boundary}--`)
  } else if (opciones.html) {
    // multipart/alternative (texto + HTML, sin adjuntos)
    lineas.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    lineas.push('')

    // Texto plano
    lineas.push(`--${boundary}`)
    lineas.push('Content-Type: text/plain; charset="UTF-8"')
    lineas.push('Content-Transfer-Encoding: base64')
    lineas.push('')
    lineas.push(Buffer.from(opciones.textoPlano).toString('base64'))
    lineas.push('')

    // HTML
    lineas.push(`--${boundary}`)
    lineas.push('Content-Type: text/html; charset="UTF-8"')
    lineas.push('Content-Transfer-Encoding: base64')
    lineas.push('')
    lineas.push(Buffer.from(opciones.html).toString('base64'))
    lineas.push('')

    lineas.push(`--${boundary}--`)
  } else {
    // Solo texto plano
    lineas.push('Content-Type: text/plain; charset="UTF-8"')
    lineas.push('Content-Transfer-Encoding: base64')
    lineas.push('')
    lineas.push(Buffer.from(opciones.textoPlano).toString('base64'))
  }

  const raw = lineas.join('\r\n')

  // Codificar a base64url (requerido por Gmail API)
  const rawBase64 = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return { raw: rawBase64, messageId }
}

/** Envía un correo a través de Gmail API.
 *  Retorna el Message-ID RFC 5322 (para threading), gmailId y threadId. */
export async function enviarCorreoGmail(
  refreshToken: string,
  opciones: OpcionesMensajeRFC2822,
  threadId?: string,
): Promise<{ id: string; threadId: string; messageId: string }> {
  const gmail = crearClienteGmail(refreshToken)
  const { raw, messageId } = construirMensajeRFC2822(opciones)

  const { data } = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: threadId || undefined,
    },
  })

  return {
    id: data.id!,
    threadId: data.threadId!,
    messageId,  // Message-ID RFC 5322 generado por nosotros
  }
}

// ─── Sync incremental con historyId ───

interface CambioHistorial {
  mensajesAgregados: string[]   // IDs de mensajes nuevos en INBOX
  mensajesEliminados: string[]  // IDs removidos de INBOX
}

/** Obtiene cambios desde un historyId (sync incremental) */
export async function obtenerHistorialGmail(
  refreshToken: string,
  startHistoryId: string,
): Promise<{ cambios: CambioHistorial; historyIdNuevo: string }> {
  const gmail = crearClienteGmail(refreshToken)

  const mensajesAgregados: string[] = []
  const mensajesEliminados: string[] = []
  let pageToken: string | undefined
  let historyIdNuevo = startHistoryId

  do {
    const { data } = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded', 'messageDeleted'],
      labelId: 'INBOX',
      pageToken,
    })

    if (data.history) {
      for (const h of data.history) {
        if (h.messagesAdded) {
          for (const m of h.messagesAdded) {
            if (m.message?.id) mensajesAgregados.push(m.message.id)
          }
        }
        if (h.messagesDeleted) {
          for (const m of h.messagesDeleted) {
            if (m.message?.id) mensajesEliminados.push(m.message.id)
          }
        }
      }
    }

    if (data.historyId) historyIdNuevo = data.historyId
    pageToken = data.nextPageToken || undefined
  } while (pageToken)

  return {
    cambios: { mensajesAgregados, mensajesEliminados },
    historyIdNuevo,
  }
}

/** Obtiene el historyId actual del perfil (para sync inicial) */
export async function obtenerPerfilGmail(
  refreshToken: string,
): Promise<{ email: string; historyId: string }> {
  const gmail = crearClienteGmail(refreshToken)
  const { data } = await gmail.users.getProfile({ userId: 'me' })
  return {
    email: data.emailAddress || '',
    historyId: String(data.historyId || ''),
  }
}

// ─── Watch (Push notifications) ───

/** Registra watch para recibir push notifications via Pub/Sub */
export async function registrarWatchGmail(
  refreshToken: string,
  topicName: string,
): Promise<{ historyId: string; expiracion: string }> {
  const gmail = crearClienteGmail(refreshToken)
  const { data } = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
      labelFilterBehavior: 'INCLUDE',
    },
  })

  return {
    historyId: String(data.historyId || ''),
    expiracion: new Date(Number(data.expiration || 0)).toISOString(),
  }
}

// ─── Helpers ───

/** Extrae solo el email de un string tipo "Nombre <email@ejemplo.com>" */
export function extraerEmail(direccion: string): string {
  const match = direccion.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : direccion.trim().toLowerCase()
}

/** Extrae el nombre de un string tipo "Nombre <email@ejemplo.com>"
 *  Si el display name es muy corto (1 palabra), intenta armar nombre+apellido desde el email.
 *  Ej: "Nahuel" <n.sanchez@dom.com> → "Nahuel Sanchez"
 *  Ej: <juan.perez@dom.com> → "Juan Perez"
 */
export function extraerNombreDeEmail(direccion: string): string {
  // 1. Intentar extraer display name
  const matchNombre = direccion.match(/^"?([^"<]+)"?\s*</)
  const displayName = matchNombre ? matchNombre[1].trim() : ''

  // 2. Extraer email
  const email = extraerEmail(direccion)
  const parteLocal = email.split('@')[0] || ''

  // 3. Si tiene display name con 2+ palabras, usarlo directo
  if (displayName && displayName.split(/\s+/).length >= 2) {
    return displayName
  }

  // 4. Si tiene display name corto (1 palabra), intentar complementar con el email
  if (displayName) {
    const nombreDesdeEmail = construirNombreDesdeEmail(parteLocal)
    const palabrasEmail = nombreDesdeEmail.split(' ')

    // Si el email tiene un apellido que no está en el display name
    if (palabrasEmail.length >= 2) {
      const displayLower = displayName.toLowerCase()
      // Buscar si alguna palabra del email matchea el display name
      const apellidoCandidato = palabrasEmail.find(p => p.toLowerCase() !== displayLower)
      if (apellidoCandidato) {
        return `${displayName} ${apellidoCandidato}`
      }
    }
    return displayName
  }

  // 5. Sin display name: construir desde el email
  const nombreConstruido = construirNombreDesdeEmail(parteLocal)
  return nombreConstruido || email
}

/** Intenta construir un nombre legible desde la parte local de un email.
 *  Ej: "n.sanchez" → "N Sanchez", "juan.perez" → "Juan Perez"
 *  Ej: "jperez" → "Jperez", "info" → "Info"
 */
function construirNombreDesdeEmail(parteLocal: string): string {
  // Separar por puntos, guiones, guiones bajos
  const partes = parteLocal.split(/[._-]/).filter(Boolean)

  if (partes.length === 0) return ''

  // Capitalizar cada parte
  return partes
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

/** Normaliza asunto quitando prefijos Re:/Fwd:/Rv: */
export function normalizarAsunto(asunto: string): string {
  return asunto
    .replace(/^(Re|Fwd|Rv|Fw|RE|FW):\s*/gi, '')
    .trim()
}

/** Genera texto de preview para lista de conversaciones */
export function textoPreviewCorreo(correo: CorreoParsedo): string {
  let texto = ''
  if (correo.textoPlano) {
    texto = correo.textoPlano.slice(0, 100).replace(/\s+/g, ' ').trim()
  } else if (correo.html) {
    texto = correo.html.replace(/<[^>]+>/g, '').slice(0, 100).replace(/\s+/g, ' ').trim()
  }

  // Si no hay texto pero sí adjuntos, mostrar indicador
  if (!texto && correo.adjuntos.length > 0) {
    const nombres = correo.adjuntos.slice(0, 2).map(a => a.nombre).join(', ')
    return `📎 ${nombres}${correo.adjuntos.length > 2 ? ` (+${correo.adjuntos.length - 2})` : ''}`
  }

  // Si hay texto y adjuntos, prefijar con clip
  if (texto && correo.adjuntos.length > 0) {
    return `📎 ${texto}`
  }

  return texto
}

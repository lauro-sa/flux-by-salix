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

  // Caso simple: body directo
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    textoPlano = decodificarBase64Url(payload.body.data)
  } else if (payload.mimeType === 'text/html' && payload.body?.data) {
    html = decodificarBase64Url(payload.body.data)
  }

  // Caso multipart: recorrer partes
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        textoPlano = decodificarBase64Url(part.body.data)
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = decodificarBase64Url(part.body.data)
      }
      // Multipart anidado (ej: multipart/alternative dentro de multipart/mixed)
      if (part.parts) {
        for (const subPart of part.parts) {
          if (subPart.mimeType === 'text/plain' && subPart.body?.data) {
            textoPlano = decodificarBase64Url(subPart.body.data)
          } else if (subPart.mimeType === 'text/html' && subPart.body?.data) {
            html = decodificarBase64Url(subPart.body.data)
          }
        }
      }
    }
  }

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

/** Construye un mensaje RFC 2822 como string base64url para enviar via Gmail API */
export function construirMensajeRFC2822(opciones: OpcionesMensajeRFC2822): string {
  const boundary = `flux_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const tieneAdjuntos = opciones.adjuntos && opciones.adjuntos.length > 0

  const lineas: string[] = []

  // Headers obligatorios
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
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Envía un correo a través de Gmail API */
export async function enviarCorreoGmail(
  refreshToken: string,
  opciones: OpcionesMensajeRFC2822,
  threadId?: string,
): Promise<{ id: string; threadId: string }> {
  const gmail = crearClienteGmail(refreshToken)
  const raw = construirMensajeRFC2822(opciones)

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

/** Extrae solo el nombre de un string tipo "Nombre <email@ejemplo.com>" */
export function extraerNombreDeEmail(direccion: string): string {
  const match = direccion.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : extraerEmail(direccion)
}

/** Normaliza asunto quitando prefijos Re:/Fwd:/Rv: */
export function normalizarAsunto(asunto: string): string {
  return asunto
    .replace(/^(Re|Fwd|Rv|Fw|RE|FW):\s*/gi, '')
    .trim()
}

/** Genera texto de preview para lista de conversaciones */
export function textoPreviewCorreo(correo: CorreoParsedo): string {
  if (correo.textoPlano) {
    return correo.textoPlano.slice(0, 100).replace(/\s+/g, ' ').trim()
  }
  if (correo.html) {
    return correo.html.replace(/<[^>]+>/g, '').slice(0, 100).replace(/\s+/g, ' ').trim()
  }
  return ''
}

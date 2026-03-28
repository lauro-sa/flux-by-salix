/**
 * Cliente de Microsoft Graph API para Outlook/Microsoft 365.
 * Tercer proveedor de correo: Microsoft OAuth (outlook_oauth).
 * Se usa en: API routes de /api/inbox/correo/ cuando proveedor === 'outlook_oauth'
 *
 * Requiere variables de entorno:
 * - MS_CLIENT_ID (Azure AD App Registration)
 * - MS_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL
 */

import type { CorreoParsedo, AdjuntoCorreoParsedo } from './gmail'

// ─── Constantes ───

const MS_AUTHORITY = 'https://login.microsoftonline.com/common'
const MS_GRAPH_URL = 'https://graph.microsoft.com/v1.0'

const MS_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Mail.Read',
  'Mail.Send',
  'Mail.ReadWrite',
]

// ─── Tipos ───

export interface ConfigOutlookOAuth {
  email: string
  refresh_token: string
  access_token: string
  token_expira_en: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

// ─── OAuth Flow ───

/** Genera URL de autorización para Microsoft */
export function generarUrlAutorizacionOutlook(estado: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/inbox/correo/oauth/callback`,
    scope: MS_SCOPES.join(' '),
    response_mode: 'query',
    state: estado,
    prompt: 'consent',
  })

  return `${MS_AUTHORITY}/oauth2/v2.0/authorize?${params}`
}

/** Intercambia código por tokens */
export async function intercambiarCodigoOutlook(codigo: string): Promise<TokenResponse> {
  const res = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      code: codigo,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/inbox/correo/oauth/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Error OAuth Microsoft: ${JSON.stringify(error)}`)
  }

  return res.json()
}

/** Refresca access token */
export async function refrescarTokenOutlook(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MS_SCOPES.join(' '),
    }),
  })

  if (!res.ok) throw new Error('Error refrescando token Microsoft')
  return res.json()
}

/** Obtiene access token válido (refresca si expiró) */
async function obtenerAccessToken(config: ConfigOutlookOAuth): Promise<string> {
  const expira = new Date(config.token_expira_en)
  if (expira > new Date(Date.now() + 60000)) {
    return config.access_token
  }

  const tokens = await refrescarTokenOutlook(config.refresh_token)
  return tokens.access_token
}

// ─── Helper para requests a Graph API ───

async function graphRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${MS_GRAPH_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(`Graph API error: ${error.error?.message || res.statusText}`)
  }

  return res
}

// ─── Obtener email del usuario ───

export async function obtenerEmailOutlook(config: ConfigOutlookOAuth): Promise<string> {
  const token = await obtenerAccessToken(config)
  const res = await graphRequest(token, '/me?$select=mail,userPrincipalName')
  const data = await res.json()
  return data.mail || data.userPrincipalName || ''
}

// ─── Listar mensajes ───

export async function listarMensajesOutlook(
  config: ConfigOutlookOAuth,
  carpeta = 'inbox',
  top = 50,
  skip = 0,
  filtro?: string,
): Promise<{ mensajes: { id: string; conversationId: string }[]; nextLink?: string }> {
  const token = await obtenerAccessToken(config)
  let path = `/me/mailFolders/${carpeta}/messages?$top=${top}&$skip=${skip}&$select=id,conversationId&$orderby=receivedDateTime desc`
  if (filtro) path += `&$filter=${filtro}`

  const res = await graphRequest(token, path)
  const data = await res.json()

  return {
    mensajes: (data.value || []).map((m: { id: string; conversationId: string }) => ({
      id: m.id,
      conversationId: m.conversationId,
    })),
    nextLink: data['@odata.nextLink'],
  }
}

// ─── Obtener mensaje completo ───

export async function obtenerMensajeCompletoOutlook(
  config: ConfigOutlookOAuth,
  messageId: string,
): Promise<CorreoParsedo> {
  const token = await obtenerAccessToken(config)
  const res = await graphRequest(token, `/me/messages/${messageId}`)
  const msg = await res.json()

  // Extraer adjuntos (metadata)
  const adjuntos: AdjuntoCorreoParsedo[] = []
  if (msg.hasAttachments) {
    const adjRes = await graphRequest(token, `/me/messages/${messageId}/attachments?$select=id,name,contentType,size`)
    const adjData = await adjRes.json()
    for (const a of adjData.value || []) {
      if (a['@odata.type'] === '#microsoft.graph.fileAttachment') {
        adjuntos.push({
          attachmentId: a.id,
          nombre: a.name || 'adjunto',
          tipoMime: a.contentType || 'application/octet-stream',
          tamano: a.size || 0,
        })
      }
    }
  }

  // Parsear internetMessageHeaders para threading
  let messageIdHeader = ''
  let inReplyTo: string | null = null
  const references: string[] = []

  if (msg.internetMessageHeaders) {
    for (const h of msg.internetMessageHeaders) {
      const name = h.name?.toLowerCase()
      if (name === 'message-id') messageIdHeader = h.value
      if (name === 'in-reply-to') inReplyTo = h.value
      if (name === 'references') {
        references.push(...h.value.split(/\s+/).filter(Boolean))
      }
    }
  }

  return {
    messageId: messageIdHeader || msg.internetMessageId || '',
    gmailId: msg.id, // Reutilizamos el campo para ID del proveedor
    threadId: msg.conversationId || '',
    de: msg.from?.emailAddress
      ? `${msg.from.emailAddress.name || ''} <${msg.from.emailAddress.address}>`.trim()
      : '',
    para: (msg.toRecipients || []).map((r: { emailAddress: { name?: string; address: string } }) =>
      r.emailAddress.name ? `${r.emailAddress.name} <${r.emailAddress.address}>` : r.emailAddress.address
    ),
    cc: (msg.ccRecipients || []).map((r: { emailAddress: { name?: string; address: string } }) =>
      r.emailAddress.name ? `${r.emailAddress.name} <${r.emailAddress.address}>` : r.emailAddress.address
    ),
    cco: (msg.bccRecipients || []).map((r: { emailAddress: { name?: string; address: string } }) =>
      r.emailAddress.name ? `${r.emailAddress.name} <${r.emailAddress.address}>` : r.emailAddress.address
    ),
    asunto: msg.subject || '',
    fecha: msg.receivedDateTime || new Date().toISOString(),
    inReplyTo,
    references,
    textoPlano: msg.body?.contentType === 'text' ? (msg.body.content || '') : '',
    html: msg.body?.contentType === 'html' ? (msg.body.content || '') : '',
    adjuntos,
    etiquetas: [], // Outlook usa carpetas en vez de labels
  }
}

// ─── Descargar adjunto ───

export async function descargarAdjuntoOutlook(
  config: ConfigOutlookOAuth,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const token = await obtenerAccessToken(config)
  const res = await graphRequest(token, `/me/messages/${messageId}/attachments/${attachmentId}`)
  const data = await res.json()

  if (!data.contentBytes) throw new Error('Adjunto sin contenido')
  return Buffer.from(data.contentBytes, 'base64')
}

// ─── Enviar correo ───

interface OpcionesEnvioOutlook {
  para: string[]
  cc?: string[]
  cco?: string[]
  asunto: string
  html: string
  adjuntos?: { nombre: string; tipoMime: string; contenido: Buffer }[]
  inReplyTo?: string // message ID de Outlook para reply
}

export async function enviarCorreoOutlook(
  config: ConfigOutlookOAuth,
  opciones: OpcionesEnvioOutlook,
): Promise<void> {
  const token = await obtenerAccessToken(config)

  const formatearDestinatario = (email: string) => {
    const match = email.match(/<([^>]+)>/)
    const address = match ? match[1] : email.trim()
    const name = email.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '')
    return {
      emailAddress: {
        address,
        name: name || address,
      },
    }
  }

  const message: Record<string, unknown> = {
    subject: opciones.asunto,
    body: {
      contentType: 'HTML',
      content: opciones.html,
    },
    toRecipients: opciones.para.map(formatearDestinatario),
  }

  if (opciones.cc?.length) {
    message.ccRecipients = opciones.cc.map(formatearDestinatario)
  }
  if (opciones.cco?.length) {
    message.bccRecipients = opciones.cco.map(formatearDestinatario)
  }

  if (opciones.adjuntos?.length) {
    message.attachments = opciones.adjuntos.map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.nombre,
      contentType: a.tipoMime,
      contentBytes: a.contenido.toString('base64'),
    }))
  }

  if (opciones.inReplyTo) {
    // Para replies, usar la API de reply en vez de sendMail
    await graphRequest(token, `/me/messages/${opciones.inReplyTo}/reply`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        comment: opciones.html,
      }),
    })
  } else {
    await graphRequest(token, '/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({ message, saveToSentItems: true }),
    })
  }
}

// ─── Delta sync (incremental) ───

export async function obtenerDeltaOutlook(
  config: ConfigOutlookOAuth,
  deltaLink?: string,
): Promise<{ mensajes: { id: string; conversationId: string }[]; deltaLink: string }> {
  const token = await obtenerAccessToken(config)

  const url = deltaLink || `/me/mailFolders/inbox/messages/delta?$select=id,conversationId`
  const res = await graphRequest(token, url.startsWith('http') ? '' : url)
  const data = await res.json()

  const mensajes = (data.value || []).map((m: { id: string; conversationId: string }) => ({
    id: m.id,
    conversationId: m.conversationId,
  }))

  // Seguir paginando si hay nextLink
  const nextLink = data['@odata.nextLink']
  const newDeltaLink = data['@odata.deltaLink']

  if (nextLink) {
    const siguiente = await obtenerDeltaOutlook(config, nextLink)
    return {
      mensajes: [...mensajes, ...siguiente.mensajes],
      deltaLink: siguiente.deltaLink,
    }
  }

  return { mensajes, deltaLink: newDeltaLink || '' }
}

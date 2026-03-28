/**
 * Cliente IMAP/SMTP para Flux by Salix.
 * Fallback para proveedores de correo que no son Gmail (Outlook, Yahoo, servidores propios).
 * Se usa en: API routes de /api/inbox/correo/ cuando proveedor === 'imap'
 *
 * Requiere paquetes: imapflow, nodemailer, mailparser
 */

import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { simpleParser, type ParsedMail } from 'mailparser'
import type { ConfigIMAP } from '@/tipos/inbox'
import type { CorreoParsedo, AdjuntoCorreoParsedo } from './gmail'

// ─── Conexión IMAP ───

/** Crea y conecta un cliente IMAP */
export async function conectarIMAP(config: ConfigIMAP): Promise<ImapFlow> {
  const cliente = new ImapFlow({
    host: config.host,
    port: config.puerto,
    secure: config.ssl,
    auth: {
      user: config.usuario,
      pass: config.password_cifrada,
    },
    logger: false,
  })

  await cliente.connect()
  return cliente
}

/** Desconecta un cliente IMAP */
export async function desconectarIMAP(cliente: ImapFlow): Promise<void> {
  try {
    await cliente.logout()
  } catch {
    // Ignorar errores de desconexión
  }
}

// ─── Obtener mensajes IMAP ───

interface OpcionesFetchIMAP {
  carpeta?: string     // default: 'INBOX'
  desdeUID?: number    // UID mínimo para sync incremental
  desdeFecha?: Date    // Fecha mínima para sync inicial
  limite?: number      // Máximo de mensajes
}

/** Obtiene y parsea mensajes de un buzón IMAP */
export async function obtenerMensajesIMAP(
  config: ConfigIMAP,
  opciones: OpcionesFetchIMAP = {},
): Promise<{ mensajes: CorreoParsedo[]; ultimoUID: number }> {
  const {
    carpeta = 'INBOX',
    desdeUID,
    desdeFecha,
    limite = 50,
  } = opciones

  const cliente = await conectarIMAP(config)
  const mensajes: CorreoParsedo[] = []
  let ultimoUID = desdeUID || 0

  try {
    const lock = await cliente.getMailboxLock(carpeta)
    try {
      // Construir rango de búsqueda
      let range: string
      if (desdeUID && desdeUID > 0) {
        range = `${desdeUID + 1}:*`
      } else {
        range = '*'
      }

      // Buscar mensajes
      const searchCriteria: Record<string, unknown> = {}
      if (desdeFecha) {
        searchCriteria.since = desdeFecha
      }

      let count = 0
      for await (const message of cliente.fetch(range, {
        uid: true,
        envelope: true,
        source: true, // Raw message para parsear con mailparser
      })) {
        if (count >= limite) break

        try {
          if (!message.source) continue
          const parsed = await simpleParser(message.source) as unknown as ParsedMail
          const correo = convertirParseadoACorreo(parsed, message.uid)
          mensajes.push(correo)
          if (message.uid > ultimoUID) ultimoUID = message.uid
          count++
        } catch (err) {
          console.error(`Error parseando mensaje UID ${message.uid}:`, err)
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await desconectarIMAP(cliente)
  }

  return { mensajes, ultimoUID }
}

/** Obtiene mensajes de la carpeta Enviados */
export async function obtenerEnviadosIMAP(
  config: ConfigIMAP,
  opciones: Omit<OpcionesFetchIMAP, 'carpeta'> = {},
): Promise<{ mensajes: CorreoParsedo[]; ultimoUID: number }> {
  // Los nombres de carpeta de enviados varían según proveedor
  const carpetasEnviados = ['Sent', 'INBOX.Sent', 'Sent Items', 'Sent Messages', '[Gmail]/Sent Mail']

  const cliente = await conectarIMAP(config)
  let carpetaEnviados = 'Sent'

  try {
    // Detectar carpeta de enviados
    const mailboxes = await cliente.list()
    for (const mb of mailboxes) {
      if (mb.specialUse === '\\Sent' || carpetasEnviados.includes(mb.path)) {
        carpetaEnviados = mb.path
        break
      }
    }
  } finally {
    await desconectarIMAP(cliente)
  }

  return obtenerMensajesIMAP(config, { ...opciones, carpeta: carpetaEnviados })
}

// ─── Convertir parsed mail a tipo interno ───

function convertirParseadoACorreo(parsed: ParsedMail, uid: number): CorreoParsedo {
  // Extraer referencias
  const referencesRaw = parsed.references
  const references: string[] = Array.isArray(referencesRaw)
    ? referencesRaw
    : referencesRaw
      ? [referencesRaw]
      : []

  // Extraer adjuntos
  const adjuntos: AdjuntoCorreoParsedo[] = (parsed.attachments || []).map((adj, i) => ({
    attachmentId: `imap_${uid}_${i}`,
    nombre: adj.filename || `adjunto_${i}`,
    tipoMime: adj.contentType || 'application/octet-stream',
    tamano: adj.size || 0,
    // El contenido raw está en adj.content (Buffer) — se usará al descargar
  }))

  return {
    messageId: parsed.messageId || `<imap_${uid}@local>`,
    gmailId: `imap_${uid}`,
    threadId: '', // IMAP no tiene concepto de thread ID nativo
    de: parsed.from?.text || '',
    para: (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
      .map(a => a.text)
      .filter(Boolean) as string[],
    cc: (parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [])
      .map(a => a.text)
      .filter(Boolean) as string[],
    cco: (parsed.bcc ? (Array.isArray(parsed.bcc) ? parsed.bcc : [parsed.bcc]) : [])
      .map(a => a.text)
      .filter(Boolean) as string[],
    asunto: parsed.subject || '',
    fecha: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
    inReplyTo: (typeof parsed.inReplyTo === 'string' ? parsed.inReplyTo : parsed.inReplyTo?.[0]) || null,
    references,
    textoPlano: parsed.text || '',
    html: parsed.html || '',
    adjuntos,
    etiquetas: [], // IMAP no expone etiquetas de la misma forma
  }
}

// ─── Descargar adjuntos IMAP ───

/** Descarga un adjunto específico de un mensaje IMAP */
export async function descargarAdjuntoIMAP(
  config: ConfigIMAP,
  uid: number,
  indiceAdjunto: number,
  carpeta = 'INBOX',
): Promise<{ contenido: Buffer; tipoMime: string; nombre: string }> {
  const cliente = await conectarIMAP(config)

  try {
    const lock = await cliente.getMailboxLock(carpeta)
    try {
      for await (const message of cliente.fetch(String(uid), {
        uid: true,
        source: true,
      })) {
        if (!message.source) throw new Error('Mensaje sin source')
        const parsed = await simpleParser(message.source) as unknown as ParsedMail
        const adj = parsed.attachments[indiceAdjunto]
        if (!adj) throw new Error(`Adjunto ${indiceAdjunto} no encontrado`)

        return {
          contenido: adj.content,
          tipoMime: adj.contentType || 'application/octet-stream',
          nombre: adj.filename || `adjunto_${indiceAdjunto}`,
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await desconectarIMAP(cliente)
  }

  throw new Error('Mensaje no encontrado')
}

// ─── Enviar correo via SMTP ───

/** Crea un transportador SMTP */
function crearTransportadorSMTP(config: ConfigIMAP) {
  return nodemailer.createTransport({
    host: config.smtp_host || config.host,
    port: config.smtp_puerto || 587,
    secure: (config.smtp_puerto || 587) === 465,
    auth: {
      user: config.usuario,
      pass: config.password_cifrada,
    },
  })
}

interface OpcionesEnvioSMTP {
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

/** Envía un correo via SMTP */
export async function enviarCorreoSMTP(
  config: ConfigIMAP,
  opciones: OpcionesEnvioSMTP,
): Promise<{ messageId: string }> {
  const transporter = crearTransportadorSMTP(config)

  const info = await transporter.sendMail({
    from: opciones.de,
    to: opciones.para.join(', '),
    cc: opciones.cc?.join(', '),
    bcc: opciones.cco?.join(', '),
    subject: opciones.asunto,
    text: opciones.textoPlano,
    html: opciones.html,
    inReplyTo: opciones.inReplyTo,
    references: opciones.references?.join(' '),
    attachments: opciones.adjuntos?.map(a => ({
      filename: a.nombre,
      content: a.contenido,
      contentType: a.tipoMime,
    })),
  })

  return { messageId: info.messageId }
}

// ─── Verificar conexión ───

/** Verifica que las credenciales IMAP son válidas */
export async function verificarConexionIMAP(config: ConfigIMAP): Promise<boolean> {
  try {
    const cliente = await conectarIMAP(config)
    await desconectarIMAP(cliente)
    return true
  } catch {
    return false
  }
}

/** Verifica que las credenciales SMTP son válidas */
export async function verificarConexionSMTP(config: ConfigIMAP): Promise<boolean> {
  try {
    const transporter = crearTransportadorSMTP(config)
    await transporter.verify()
    return true
  } catch {
    return false
  }
}

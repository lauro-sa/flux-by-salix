import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Cifrado AES-256-GCM para datos sensibles (passwords IMAP, tokens, etc.)
 * Usa SUPABASE_SERVICE_ROLE_KEY como base para derivar la clave de cifrado.
 * Se usa en: API routes de canales inbox (guardar/leer passwords IMAP).
 */

function obtenerClave(): Buffer {
  const secreto = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secreto) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')
  // Derivar clave de 32 bytes del service role key
  const { createHash } = require('crypto') as typeof import('crypto')
  return createHash('sha256').update(secreto).digest()
}

/** Cifra un texto plano. Retorna string formato "iv:tag:cifrado" en hex */
export function cifrar(textoPlano: string): string {
  const clave = obtenerClave()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', clave, iv)

  let cifrado = cipher.update(textoPlano, 'utf8', 'hex')
  cifrado += cipher.final('hex')
  const tag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${tag.toString('hex')}:${cifrado}`
}

/** Descifra un texto en formato "iv:tag:cifrado". Retorna texto plano */
export function descifrar(textoCifrado: string): string {
  const clave = obtenerClave()
  const [ivHex, tagHex, cifrado] = textoCifrado.split(':')

  if (!ivHex || !tagHex || !cifrado) {
    // Si no tiene formato cifrado, asumir que es texto plano (migración gradual)
    return textoCifrado
  }

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', clave, iv)
  decipher.setAuthTag(tag)

  let descifrado = decipher.update(cifrado, 'hex', 'utf8')
  descifrado += decipher.final('utf8')

  return descifrado
}

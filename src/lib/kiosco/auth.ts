import { type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * Autenticación del kiosco por token JWT de terminal.
 * El token se envía en el header Authorization: Bearer <token>.
 * Se valida contra el hash almacenado en terminales_kiosco.
 */

interface TerminalValidada {
  id: string
  empresaId: string
  nombre: string
}

/** Verificar token del kiosco desde el header Authorization */
export async function verificarTokenKiosco(request: NextRequest): Promise<TerminalValidada | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  if (!token) return null

  const tokenHash = hashToken(token)

  const admin = crearClienteAdmin()
  const { data: terminal } = await admin
    .from('terminales_kiosco')
    .select('id, empresa_id, nombre, activo')
    .eq('token_hash', tokenHash)
    .eq('activo', true)
    .is('revocado_en', null)
    .maybeSingle()

  if (!terminal) return null

  return {
    id: terminal.id,
    empresaId: terminal.empresa_id,
    nombre: terminal.nombre,
  }
}

/** Generar token de setup (válido 1 hora) */
export function generarTokenSetup(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** Hash SHA-256 para almacenar tokens de forma segura */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Generar token de larga duración para el kiosco */
export function generarTokenKiosco(): string {
  return crypto.randomBytes(48).toString('hex')
}

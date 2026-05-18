// ──────────────────────────────────────────────────────────────────
// Short links para recibos de nómina (WhatsApp).
// ──────────────────────────────────────────────────────────────────
//
// El signed URL de Supabase Storage mide ~800 chars y queda ilegible
// en WhatsApp. Este helper guarda un token de 10 chars en
// `recibo_enlaces_publicos` que mapea a un `pago_nomina`, y devuelve
// la URL pública corta: `https://flux.salixweb.com/r/{token}`.
//
// La ruta `/r/[token]` resuelve el token, genera un signed URL
// fresco contra Storage y hace redirect 302.

import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// 10 chars URL-safe (base64url sin padding) → ~62^10 combinaciones.
// Probabilidad de colisión despreciable para nuestro volumen.
function generarTokenCorto(): string {
  // 8 bytes → 11 chars en base64; tomamos los primeros 10.
  return randomBytes(8)
    .toString('base64')
    .replace(/\+/g, '0')
    .replace(/\//g, '0')
    .replace(/=/g, '')
    .slice(0, 10)
}

interface CrearEnlaceArgs {
  pagoId: string
  empresaId: string
  miembroId?: string | null
  creadoPor?: string | null
  // Días hasta que caduca el enlace. Default 30 días.
  // Si es 0 o negativo, no caduca.
  diasVigencia?: number
}

/**
 * Devuelve la URL pública corta para el recibo del pago.
 * Si ya existe un enlace vigente para este pago, lo reusa (idempotente).
 * Si no, crea uno nuevo.
 *
 * El llamador es responsable de pasar la `baseUrl` (típicamente
 * `process.env.NEXT_PUBLIC_APP_URL` o `request.nextUrl.origin`).
 */
export async function obtenerEnlaceCortoRecibo(
  admin: SupabaseClient,
  baseUrl: string,
  args: CrearEnlaceArgs,
): Promise<{ url: string; token: string; reusado: boolean }> {
  // 1) Buscar enlace vigente existente para este pago.
  // Ordenamos por `creado_en DESC` y filtramos los caducados.
  const ahora = new Date().toISOString()
  const { data: existente } = await admin
    .from('recibo_enlaces_publicos')
    .select('token, expira_en')
    .eq('pago_id', args.pagoId)
    .eq('empresa_id', args.empresaId)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente?.token) {
    // Vigente si no tiene expiración o si todavía no expiró.
    const vigente = !existente.expira_en || existente.expira_en > ahora
    if (vigente) {
      return {
        url: `${baseUrl.replace(/\/$/, '')}/r/${existente.token}`,
        token: existente.token,
        reusado: true,
      }
    }
  }

  // 2) Generar token nuevo (con retry por improbable colisión).
  const dias = args.diasVigencia ?? 30
  const expiraEn = dias > 0
    ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()
    : null

  let intentos = 0
  while (intentos < 5) {
    const token = generarTokenCorto()
    const { error } = await admin
      .from('recibo_enlaces_publicos')
      .insert({
        token,
        pago_id: args.pagoId,
        empresa_id: args.empresaId,
        miembro_id: args.miembroId || null,
        creado_por: args.creadoPor || null,
        expira_en: expiraEn,
      })

    if (!error) {
      return {
        url: `${baseUrl.replace(/\/$/, '')}/r/${token}`,
        token,
        reusado: false,
      }
    }

    // Si el error es de unique violation (colisión de token), reintentar.
    // Cualquier otro error es fatal.
    if (!error.message?.includes('duplicate key') && error.code !== '23505') {
      throw new Error(`No se pudo crear enlace corto: ${error.message}`)
    }
    intentos++
  }

  throw new Error('No se pudo generar un token único después de 5 intentos')
}

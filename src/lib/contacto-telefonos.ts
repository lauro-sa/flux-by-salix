/**
 * Helpers para la lista de teléfonos de un contacto (modelo contacto_telefonos).
 *
 * Centraliza:
 *   - Normalización + dedup + validación de la lista que llega del cliente.
 *   - Conversión de campos legacy {telefono, whatsapp} a lista nueva (compat).
 *
 * Se usa en: POST/PATCH /api/contactos, fusionar, importador CSV, Salix IA tools,
 * webhook WhatsApp (creación de provisorio).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarTelefono } from './validaciones'

/** Tipos de teléfono válidos. 'whatsapp' NO es un tipo: WhatsApp se deriva del tipo
 *  móvil (convención AR). Si llega 'whatsapp' por defensividad, se trata como 'movil'. */
export const TIPOS_TELEFONO = ['movil', 'fijo', 'trabajo', 'casa', 'otro'] as const
export type TipoTelefono = typeof TIPOS_TELEFONO[number]

const TIPOS_VALIDOS = new Set<string>(TIPOS_TELEFONO)

/** Mapea un tipo crudo al canónico. 'whatsapp' (legacy) → 'movil'. Inválido → 'movil'. */
function mapearTipo(tipo: string | undefined): TipoTelefono {
  if (tipo === 'whatsapp') return 'movil'
  return (TIPOS_VALIDOS.has(tipo || '') ? tipo : 'movil') as TipoTelefono
}

/** Entrada cruda desde cliente o helper legacy — campos opcionales y permisivos. */
export interface TelefonoEntrada {
  tipo?: string
  valor: string
  es_whatsapp?: boolean
  es_principal?: boolean
  etiqueta?: string | null
  orden?: number
}

/** Forma normalizada lista para insertar en contacto_telefonos. */
export interface TelefonoNormalizado {
  tipo: TipoTelefono
  valor: string
  es_whatsapp: boolean
  es_principal: boolean
  etiqueta: string | null
  orden: number
  /** Procedencia. 'manual' por default. Las filas sync_* vienen del trigger
   *  sync_perfil_a_contactos y son read-only en la UI. */
  origen?: 'manual' | 'sync_perfil_personal' | 'sync_perfil_empresa'
}

/**
 * Normaliza, deduplica y valida una lista de teléfonos.
 *
 *   - Normaliza cada `valor` con `normalizarTelefono` (E.164 sin +, regla del 9 AR).
 *   - Descarta valores que no normalizan (basura, < 6 dígitos).
 *   - Dedup por valor: si el mismo número aparece dos veces, fusiona flags
 *     (OR de es_whatsapp y es_principal); el primero gana en tipo/etiqueta.
 *   - Garantiza exactamente UN principal: si vienen varios, solo el primero queda;
 *     si ninguno, marca al primero de la lista.
 *   - Tipo default `movil` si no viene o es inválido.
 *
 * Retorna [] si la lista queda vacía después de filtrar inválidos.
 */
export function normalizarListaTelefonos(entrada: TelefonoEntrada[] | undefined | null): TelefonoNormalizado[] {
  if (!Array.isArray(entrada) || entrada.length === 0) return []

  const por_valor = new Map<string, TelefonoNormalizado>()
  let ordenAuto = 0

  for (const t of entrada) {
    const valor = normalizarTelefono(t.valor)
    if (!valor) continue
    const tipo = mapearTipo(t.tipo)

    const existente = por_valor.get(valor)
    if (existente) {
      existente.es_whatsapp = existente.es_whatsapp || !!t.es_whatsapp
      existente.es_principal = existente.es_principal || !!t.es_principal
    } else {
      por_valor.set(valor, {
        tipo,
        valor,
        es_whatsapp: !!t.es_whatsapp,
        es_principal: !!t.es_principal,
        etiqueta: t.etiqueta?.trim() || null,
        orden: typeof t.orden === 'number' ? t.orden : ordenAuto++,
        // origen no se setea acá: el endpoint que persiste decide ('manual' por default).
      })
    }
  }

  const lista = [...por_valor.values()]
  if (lista.length === 0) return []

  // Garantizar exactamente 1 principal
  let principalEncontrado = false
  for (const t of lista) {
    if (t.es_principal) {
      if (principalEncontrado) t.es_principal = false
      else principalEncontrado = true
    }
  }
  if (!principalEncontrado) lista[0].es_principal = true

  return lista
}

/**
 * Convierte campos legacy {telefono, whatsapp} a una lista de teléfonos.
 *
 * Reglas de mapeo (para escrituras nuevas vía consumidores legacy — Salix IA, importador, etc):
 *   - telefono === whatsapp                   → 1 entrada movil + es_whatsapp + principal
 *   - solo telefono, prefijo 549 (móvil AR)   → 1 entrada movil + principal
 *   - solo telefono, otros (fijo / intl)      → 1 entrada fijo + principal
 *   - solo whatsapp                           → 1 entrada movil + es_whatsapp + principal
 *   - telefono y whatsapp distintos           → 2 entradas: telefono fijo principal +
 *                                               whatsapp movil es_whatsapp orden=1
 */
export function legacyAEntradas(telefono?: string | null, whatsapp?: string | null): TelefonoEntrada[] {
  const tel = (telefono || '').trim() || null
  const wa = (whatsapp || '').trim() || null
  if (!tel && !wa) return []

  const telN = tel ? normalizarTelefono(tel) : null
  const waN = wa ? normalizarTelefono(wa) : null

  if (telN && waN && telN === waN) {
    return [{ tipo: 'movil', valor: telN, es_whatsapp: true, es_principal: true }]
  }

  if (telN && !waN) {
    const esMovilAR = /^549\d{9,11}$/.test(telN)
    return [{ tipo: esMovilAR ? 'movil' : 'fijo', valor: telN, es_whatsapp: false, es_principal: true }]
  }

  if (!telN && waN) {
    return [{ tipo: 'movil', valor: waN, es_whatsapp: true, es_principal: true }]
  }

  // Ambos distintos
  return [
    { tipo: 'fijo', valor: telN!, es_whatsapp: false, es_principal: true, orden: 0 },
    { tipo: 'movil', valor: waN!, es_whatsapp: true, es_principal: false, orden: 1 },
  ]
}

/**
 * Busca un contacto en la empresa que tenga alguno de los valores dados en `contacto_telefonos.valor`.
 * Útil para webhook entrante (variantes de un número), Salix IA y dedup en general.
 *
 * Devuelve el primer contacto NO en papelera encontrado, o null.
 */
export async function buscarContactoPorTelefono(
  admin: SupabaseClient,
  empresaId: string,
  valores: string[],
): Promise<{ id: string; nombre: string; apellido: string | null; valor: string } | null> {
  if (valores.length === 0) return null
  const { data } = await admin
    .from('contacto_telefonos')
    .select('valor, contactos!inner(id, nombre, apellido, en_papelera)')
    .eq('empresa_id', empresaId)
    .in('valor', valores)
    .eq('contactos.en_papelera', false)
    .limit(5)
  for (const r of (data || [])) {
    const c = r.contactos as unknown as { id: string; nombre: string; apellido: string | null; en_papelera: boolean }
    if (c) return { id: c.id, nombre: c.nombre, apellido: c.apellido, valor: r.valor }
  }
  return null
}

/**
 * Resuelve la lista de teléfonos a partir del body de un endpoint:
 *   - Si viene `telefonos` array, lo usa directo.
 *   - Si no, convierte los campos legacy `telefono` / `whatsapp`.
 *
 * Centraliza la lógica de compat para que POST, PATCH, importador y Salix IA usen lo mismo.
 */
export function resolverListaDesdeBody(body: {
  telefonos?: TelefonoEntrada[]
  telefono?: string | null
  whatsapp?: string | null
}): TelefonoNormalizado[] {
  if (Array.isArray(body.telefonos)) {
    return normalizarListaTelefonos(body.telefonos)
  }
  return normalizarListaTelefonos(legacyAEntradas(body.telefono, body.whatsapp))
}

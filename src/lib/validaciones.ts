/**
 * Validaciones de formato para campos de contacto y otras entidades.
 * Se usa en: páginas de contactos, API routes, formularios.
 */

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

/** Valida formato de email */
export function esEmailValido(email: string): boolean {
  if (!email.trim()) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Valida formato de teléfono (mínimo 6 dígitos) */
export function esTelefonoValido(telefono: string): boolean {
  if (!telefono.trim()) return false
  const soloDigitos = telefono.replace(/\D/g, '')
  return soloDigitos.length >= 6
}

/** País por defecto cuando no se puede detectar el prefijo internacional. */
const PAIS_DEFECTO: CountryCode = 'AR'

/**
 * Aplica la regla del "9" de Argentina al formato E.164 sin `+`.
 * WhatsApp para números móviles argentinos requiere `54` + `9` + área + número.
 * Si recibimos un E.164 argentino sin el 9 móvil (ej: 541156029403), lo agregamos.
 * Si ya tiene el 9, lo dejamos igual.
 */
function asegurar9Argentina(e164SinMas: string): string {
  // Números argentinos empiezan con 54 y tienen al menos 11 dígitos (54 + área + número)
  if (!e164SinMas.startsWith('54')) return e164SinMas
  // Si ya es 549... no tocar
  if (e164SinMas.startsWith('549')) return e164SinMas
  // 54 seguido de área móvil argentina → insertar 9
  // Números móviles AR en E.164 deberían tener 12 dígitos totales con el 9 (54 9 XX XXXXXXXX)
  // Si viene con 11 dígitos tras el 54, asumimos que es móvil sin 9 y lo corregimos
  const resto = e164SinMas.slice(2)
  if (resto.length >= 10 && resto.length <= 11) {
    return '549' + resto
  }
  return e164SinMas
}

/**
 * Normaliza un teléfono a formato E.164 canónico SIN el `+` inicial.
 *
 * - Usa `libphonenumber-js` con país default (Argentina) si el input no trae prefijo internacional.
 * - Para números móviles argentinos, asegura el "9" requerido por WhatsApp (`5491156029403`).
 * - Descarta cualquier ruido: espacios, guiones, paréntesis, puntos, bidi marks de iOS.
 *
 * Devuelve `null` si el input es falsy o si queda con menos de 6 dígitos tras limpiar.
 * Ej:
 *   "1156029403"           → "5491156029403"
 *   "541156029403"         → "5491156029403"
 *   "+54 9 11 5602-9403"   → "5491156029403"
 *   "5491156029403"        → "5491156029403"
 */
export function normalizarTelefono(valor: string | null | undefined, paisDefault: CountryCode = PAIS_DEFECTO): string | null {
  if (!valor) return null
  // Primera pasada: sacar todo lo que no sea dígito o `+` (los dígitos son todo lo que parsea libphonenumber)
  const limpio = valor.replace(/[^\d+]/g, '')
  if (limpio.replace(/\D/g, '').length < 6) return null

  try {
    const parsed = parsePhoneNumberFromString(limpio, paisDefault)
    if (parsed && parsed.isValid()) {
      // E.164 sin el +, con regla del 9 para AR aplicada
      return asegurar9Argentina(parsed.number.replace(/^\+/, ''))
    }
  } catch {
    // cae al fallback
  }

  // Fallback: si libphonenumber no lo pudo parsear (número truncado, formato raro),
  // igual devolvemos los dígitos como último recurso para no perder datos antiguos.
  const soloDigitos = limpio.replace(/\D/g, '')
  return soloDigitos.length >= 6 ? asegurar9Argentina(soloDigitos) : null
}

/**
 * Genera variantes probables de un número para búsquedas defensivas en la BD.
 *
 * Cubre los casos habituales de Argentina (con/sin 9, con/sin 54) y devuelve también
 * el número "tal cual" viene (sin ningún cambio) por si alguien guardó un formato raro.
 *
 * Se usa en:
 *  - Webhook entrante: buscar conversación/contacto aunque esté guardado en otro formato.
 *  - SelectorContacto / búsqueda por teléfono.
 *  - Detección de empleado de Salix IA.
 */
export function generarVariantesTelefono(valor: string | null | undefined): string[] {
  if (!valor) return []
  const canonico = normalizarTelefono(valor)
  if (!canonico) return []

  const set = new Set<string>()
  set.add(canonico)
  set.add(`+${canonico}`)

  // Variantes AR: con 9 ↔ sin 9
  if (canonico.startsWith('549') && canonico.length >= 12) {
    const sin9 = '54' + canonico.slice(3)
    set.add(sin9)
    set.add(`+${sin9}`)
    // También sin código país (solo área + número)
    const soloLocal = canonico.slice(3)
    if (soloLocal.length >= 8) set.add(soloLocal)
  } else if (canonico.startsWith('54') && !canonico.startsWith('549')) {
    const con9 = '549' + canonico.slice(2)
    set.add(con9)
    set.add(`+${con9}`)
    const soloLocal = canonico.slice(2)
    if (soloLocal.length >= 8) set.add(soloLocal)
  }

  // Dígitos "tal cual": útil para datos antiguos cargados sin país
  const crudo = valor.replace(/\D/g, '')
  if (crudo.length >= 6) set.add(crudo)

  return [...set]
}

/**
 * Formatea un teléfono para mostrar a humanos (ej: "+54 9 11 5602-9403").
 * Devuelve null si no se puede parsear — en UI conviene caer al valor original en ese caso.
 */
export function formatearTelefonoInternacional(valor: string | null | undefined, paisDefault: CountryCode = PAIS_DEFECTO): string | null {
  if (!valor) return null
  try {
    const parsed = parsePhoneNumberFromString(valor, paisDefault)
    if (parsed && parsed.isValid()) return parsed.formatInternational()
  } catch {
    // silencioso
  }
  return null
}

/** Heurística de coincidencia: compara dos teléfonos usando sus variantes normalizadas. */
export function telefonosCoinciden(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const variantesA = new Set(generarVariantesTelefono(a))
  const variantesB = generarVariantesTelefono(b)
  return variantesB.some(v => variantesA.has(v))
}

/** Valida formato de URL */
export function esUrlValida(url: string): boolean {
  if (!url.trim()) return false
  // Aceptar con o sin protocolo
  const conProtocolo = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
  try {
    new URL(conProtocolo)
    return true
  } catch {
    return false
  }
}

/** Valida CUIT argentino (formato: XX-XXXXXXXX-X) */
export function esCuitValido(cuit: string): boolean {
  if (!cuit.trim()) return false
  const limpio = cuit.replace(/\D/g, '')
  return limpio.length === 11
}

/** Valida DNI argentino (7-8 dígitos) */
export function esDniValido(dni: string): boolean {
  if (!dni.trim()) return false
  const limpio = dni.replace(/\D/g, '')
  return limpio.length >= 7 && limpio.length <= 8
}

/** Valida número de identificación según tipo */
export function esIdentificacionValida(tipo: string, numero: string): boolean {
  if (!numero.trim()) return true // no obligatorio
  switch (tipo) {
    case 'cuit':
    case 'cuil':
      return esCuitValido(numero)
    case 'dni':
      return esDniValido(numero)
    default:
      return numero.trim().length >= 3 // mínimo 3 caracteres para pasaporte/cédula
  }
}

/** Errores de validación de un contacto */
export interface ErroresContacto {
  correo?: string
  telefono?: string
  whatsapp?: string
  web?: string
  numero_identificacion?: string
}

/** Valida los campos de un contacto y retorna errores */
export function validarCamposContacto(datos: {
  correo?: string
  telefono?: string
  whatsapp?: string
  web?: string
  tipo_identificacion?: string
  numero_identificacion?: string
}): ErroresContacto {
  const errores: ErroresContacto = {}

  if (datos.correo?.trim() && !esEmailValido(datos.correo)) {
    errores.correo = 'Email no válido'
  }
  if (datos.telefono?.trim() && !esTelefonoValido(datos.telefono)) {
    errores.telefono = 'Teléfono no válido (mínimo 6 dígitos)'
  }
  if (datos.whatsapp?.trim() && !esTelefonoValido(datos.whatsapp)) {
    errores.whatsapp = 'WhatsApp no válido (mínimo 6 dígitos)'
  }
  if (datos.web?.trim() && !esUrlValida(datos.web)) {
    errores.web = 'URL no válida'
  }
  if (datos.numero_identificacion?.trim() && datos.tipo_identificacion) {
    if (!esIdentificacionValida(datos.tipo_identificacion, datos.numero_identificacion)) {
      errores.numero_identificacion = 'Formato no válido'
    }
  }

  return errores
}

/** Sanitiza input de búsqueda: solo permite caracteres seguros para FTS e ilike.
 *  Caracteres comunes en nombres de contactos (&, /, (, ), ,) se convierten en espacio
 *  para que FTS los trate como tokens separados (ej: "IN&PR" → "IN PR") */
export function sanitizarBusqueda(input: string): string {
  return input
    .replace(/[&/(),]/g, ' ')
    .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9\s.@\-_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Quita acentos/diacríticos de un texto para búsquedas ILIKE insensibles a acentos */
export function normalizarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Normaliza un texto para búsqueda client-side:
 * quita acentos + lowercase en un solo paso.
 * Úsalo cuando filtrás listas en memoria (ej: filtros de configuración).
 *
 * Ejemplo:
 *   normalizarBusqueda('José Pérez') === 'jose perez'
 */
export function normalizarBusqueda(texto: string): string {
  return normalizarAcentos(texto).toLowerCase()
}

/** Retorna true si no hay errores */
export function sinErrores(errores: ErroresContacto): boolean {
  return Object.keys(errores).length === 0
}

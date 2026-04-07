/**
 * Validaciones de formato para campos de contacto y otras entidades.
 * Se usa en: páginas de contactos, API routes, formularios.
 */

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
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Retorna true si no hay errores */
export function sinErrores(errores: ErroresContacto): boolean {
  return Object.keys(errores).length === 0
}

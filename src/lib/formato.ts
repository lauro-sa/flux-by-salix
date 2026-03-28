/**
 * Utilidades de auto-formateo para inputs.
 * Se aplican automáticamente según el tipo de dato.
 * El usuario siempre puede sobrescribir el resultado.
 * Se usa en: componente Input (via prop `formato`), formularios.
 */

/** Siglas comunes que deben quedar en mayúsculas */
const SIGLAS = new Set([
  'SRL', 'SA', 'SAS', 'SAU', 'SCA', 'SE', 'SAC',
  'CUIT', 'CUIL', 'DNI', 'IVA', 'CEO', 'CTO', 'CFO', 'COO',
  'IT', 'HR', 'RRHH', 'IA', 'AI', 'API', 'CRM', 'ERP',
  'USA', 'UK', 'EU', 'LATAM',
])

/** Preposiciones y artículos que van en minúscula (en nombres de empresa) */
const PALABRAS_MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'o', 'u', 'en', 'con', 'por', 'para', 'al'])

/** Email y URL — siempre minúsculas */
export function formatearEmail(valor: string): string {
  return valor.toLowerCase().trim()
}

export function formatearUrl(valor: string): string {
  return valor.toLowerCase().trim()
}

/** Nombre de persona — Primera letra mayúscula, resto minúscula */
export function formatearNombrePersona(valor: string): string {
  return valor
    .split(/(\s+)/)
    .map(palabra => {
      if (!palabra.trim()) return palabra
      // Mantener guiones compuestos (María-José)
      if (palabra.includes('-')) {
        return palabra.split('-').map(p =>
          p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
        ).join('-')
      }
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    })
    .join('')
}

/** Nombre de empresa — Capitalizar + respetar siglas (SRL, SA, SAS, etc.) */
export function formatearNombreEmpresa(valor: string): string {
  return valor
    .split(/(\s+)/)
    .map((palabra, idx) => {
      if (!palabra.trim()) return palabra

      const upper = palabra.toUpperCase()

      // Si es sigla conocida, dejar en mayúsculas
      if (SIGLAS.has(upper)) return upper

      // Si el usuario lo escribió todo en mayúsculas y tiene 2-4 chars, podría ser sigla — respetar
      if (palabra === upper && palabra.length >= 2 && palabra.length <= 4 && /^[A-Z]+$/.test(palabra)) {
        return palabra
      }

      // Preposiciones y artículos en minúscula (excepto si es la primera palabra)
      if (idx > 0 && PALABRAS_MENORES.has(palabra.toLowerCase())) {
        return palabra.toLowerCase()
      }

      // Capitalizar primera letra
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    })
    .join('')
}

/** Teléfono — formateo internacional usando libphonenumber-js */
export function formatearTelefono(valor: string): string {
  if (!valor.trim()) return valor

  try {
    // Import dinámico para evitar problemas de SSR
    const { parsePhoneNumberFromString } = require('libphonenumber-js')

    // Intentar parsear (default Argentina si no tiene código de país)
    let telefono = parsePhoneNumberFromString(valor, 'AR')

    // Si no parseó, intentar sin default
    if (!telefono) telefono = parsePhoneNumberFromString(valor)

    if (telefono && telefono.isValid()) {
      // Formato internacional: +54 9 11 1234-5678
      return telefono.formatInternational()
    }

    // Si no es válido pero tiene dígitos, al menos limpiar
    return valor.replace(/[^\d+\s\-()]/g, '')
  } catch {
    return valor
  }
}

/** Slug — minúsculas, sin espacios, solo a-z 0-9 y guiones */
export function formatearSlug(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '')
}

/**
 * Tipo de formato disponible para el componente Input.
 * Se mapea automáticamente según el tipo de input si no se especifica.
 */
export type TipoFormato = 'email' | 'url' | 'telefono' | 'nombre_persona' | 'nombre_empresa' | 'slug' | 'minusculas'

/** Aplica el formato correspondiente a un valor */
export function aplicarFormato(valor: string, formato: TipoFormato): string {
  switch (formato) {
    case 'email':
    case 'minusculas':
      return formatearEmail(valor)
    case 'url':
      return formatearUrl(valor)
    case 'telefono':
      return formatearTelefono(valor)
    case 'nombre_persona':
      return formatearNombrePersona(valor)
    case 'nombre_empresa':
      return formatearNombreEmpresa(valor)
    case 'slug':
      return formatearSlug(valor)
    default:
      return valor
  }
}

/**
 * Aplica una máscara de formato a un valor numérico.
 * La máscara usa '#' para dígitos y cualquier otro carácter como separador.
 * Ejemplo: aplicarMascara('20123456789', '##-########-#') → '20-12345678-9'
 */
export function aplicarMascara(valor: string, mascara: string): string {
  // Extraer solo dígitos del valor
  const digitos = valor.replace(/\D/g, '')
  let resultado = ''
  let idxDigito = 0

  for (let i = 0; i < mascara.length && idxDigito < digitos.length; i++) {
    if (mascara[i] === '#') {
      resultado += digitos[idxDigito]
      idxDigito++
    } else {
      resultado += mascara[i]
      // Si el usuario está escribiendo y el próximo carácter de la máscara es separador, agregarlo automáticamente
    }
  }

  return resultado
}

/** Detecta automáticamente el formato según el tipo de input HTML */
export function detectarFormato(tipoInput: string): TipoFormato | null {
  switch (tipoInput) {
    case 'email': return 'email'
    case 'url': return 'url'
    case 'tel': return 'telefono'
    default: return null
  }
}

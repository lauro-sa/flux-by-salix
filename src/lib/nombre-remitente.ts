/**
 * nombre-remitente.ts — Genera el nombre del remitente según el formato elegido por el usuario.
 * Se usa en: API de envío de correo, WhatsApp, y cualquier comunicación saliente.
 *
 * Formatos disponibles:
 *   nombre_inicial_sector  → "Sebastian L · Recursos Humanos" (default)
 *   nombre_completo        → "Sebastian Lauro"
 *   nombre_completo_sector → "Sebastian Lauro · Recursos Humanos"
 *   iniciales              → "SL"
 *   iniciales_sector       → "SL · Recursos Humanos"
 *   nombre_inicial         → "Sebastian L"
 *   solo_sector            → "Recursos Humanos"
 *   solo_nombre            → "Sebastian"
 *
 * Las iniciales NO llevan puntos (SL, no S.L.)
 */

export type FormatoNombreRemitente =
  | 'nombre_inicial_sector'
  | 'nombre_completo'
  | 'nombre_completo_sector'
  | 'iniciales'
  | 'iniciales_sector'
  | 'nombre_inicial'
  | 'solo_sector'
  | 'solo_nombre'

interface DatosRemitente {
  nombre: string
  apellido: string
  sector?: string | null
}

const FORMATO_DEFAULT: FormatoNombreRemitente = 'nombre_inicial_sector'

export const FORMATOS_NOMBRE_REMITENTE: { valor: FormatoNombreRemitente; descripcion: string; ejemplo: (d: DatosRemitente) => string }[] = [
  { valor: 'nombre_inicial_sector', descripcion: 'Nombre + inicial del apellido + sector', ejemplo: (d) => generarNombreRemitente('nombre_inicial_sector', d) },
  { valor: 'nombre_completo', descripcion: 'Nombre y apellido completos', ejemplo: (d) => generarNombreRemitente('nombre_completo', d) },
  { valor: 'nombre_completo_sector', descripcion: 'Nombre y apellido completos + sector', ejemplo: (d) => generarNombreRemitente('nombre_completo_sector', d) },
  { valor: 'nombre_inicial', descripcion: 'Nombre + inicial del apellido', ejemplo: (d) => generarNombreRemitente('nombre_inicial', d) },
  { valor: 'iniciales', descripcion: 'Solo tus iniciales', ejemplo: (d) => generarNombreRemitente('iniciales', d) },
  { valor: 'iniciales_sector', descripcion: 'Tus iniciales + sector', ejemplo: (d) => generarNombreRemitente('iniciales_sector', d) },
  { valor: 'solo_nombre', descripcion: 'Solo tu nombre de pila', ejemplo: (d) => generarNombreRemitente('solo_nombre', d) },
  { valor: 'solo_sector', descripcion: 'Solo el sector', ejemplo: (d) => generarNombreRemitente('solo_sector', d) },
]

export function generarNombreRemitente(
  formato: FormatoNombreRemitente | string | null | undefined,
  datos: DatosRemitente,
): string {
  const { nombre, apellido, sector } = datos
  const fmt = (formato as FormatoNombreRemitente) || FORMATO_DEFAULT
  const inicialNombre = nombre ? nombre[0].toUpperCase() : ''
  const inicialApellido = apellido ? apellido[0].toUpperCase() : ''
  const iniciales = `${inicialNombre}${inicialApellido}`

  const conSector = (base: string) =>
    sector ? `${base} · ${sector}` : base

  switch (fmt) {
    case 'nombre_completo':
      return `${nombre} ${apellido}`.trim()

    case 'nombre_completo_sector':
      return conSector(`${nombre} ${apellido}`.trim())

    case 'nombre_inicial_sector':
      return conSector(apellido ? `${nombre} ${inicialApellido}` : nombre)

    case 'nombre_inicial':
      return apellido ? `${nombre} ${inicialApellido}` : nombre

    case 'iniciales':
      return iniciales || nombre

    case 'iniciales_sector':
      return conSector(iniciales || nombre)

    case 'solo_sector':
      return sector || `${nombre} ${apellido}`.trim()

    case 'solo_nombre':
      return nombre

    default:
      return conSector(apellido ? `${nombre} ${inicialApellido}` : nombre)
  }
}

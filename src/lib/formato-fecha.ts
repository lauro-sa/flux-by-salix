/**
 * Utilidades de formato de fecha ISO.
 * Reemplaza el patrón toLocaleDateString('en-CA') para obtener YYYY-MM-DD.
 */

/**
 * Formatea una fecha como string ISO (YYYY-MM-DD).
 * Alternativa semántica a toLocaleDateString('en-CA').
 * Si se pasa zonaHoraria, convierte a esa zona antes de extraer la fecha.
 */
export function formatearFechaISO(fecha: Date | string, zonaHoraria?: string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (zonaHoraria) {
    // Usar toLocaleDateString con 'en-CA' internamente para respetar la zona horaria
    return d.toLocaleDateString('en-CA', { timeZone: zonaHoraria })
  }
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * Formatea una fecha+hora como string ISO (YYYY-MM-DDTHH:mm:ss).
 */
export function formatearFechaHoraISO(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return d.toISOString().slice(0, 19)
}

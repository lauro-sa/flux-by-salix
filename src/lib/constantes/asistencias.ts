/**
 * Constantes compartidas del módulo de asistencias.
 * Centraliza valores usados en componentes y API routes.
 */

export const ETIQUETA_METODO: Record<string, string> = {
  manual: 'Manual',
  rfid: 'RFID',
  nfc: 'NFC',
  pin: 'PIN',
  automatico: 'Automático',
  solicitud: 'Solicitud',
  sistema: 'Sistema',
}

/** Formatea minutos de puntualidad a texto legible. Ej: 73 → "1h 13min", 5 → "5 min" */
function fmtMinutos(min: number): string {
  const abs = Math.abs(min)
  if (abs < 60) return `${abs} min`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

/** Formatea puntualidad: positivo = tarde, negativo = antes, 0 = a tiempo */
export function formatearPuntualidad(min: number | null | undefined): { texto: string; color: string } | null {
  if (min == null) return null
  if (min > 0) return { texto: `${fmtMinutos(min)} tarde`, color: 'text-red-400' }
  if (min < 0) return { texto: `${fmtMinutos(min)} antes`, color: 'text-emerald-400' }
  return { texto: 'A tiempo', color: 'text-emerald-400' }
}

/** Versión corta para tooltips/celdas compactas: "1h 13m antes" */
export function formatearPuntualidadCorta(min: number): string {
  const abs = Math.abs(min)
  const label = abs < 60 ? `${abs}m` : `${Math.floor(abs / 60)}h ${abs % 60}m`
  return min < 0 ? `${label} antes` : `${label} tarde`
}

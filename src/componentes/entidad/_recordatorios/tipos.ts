import type { ConfigRecurrencia } from '@/componentes/ui/SelectorRecurrencia'

/* ─── Tipos ─── */

export interface Recordatorio {
  id: string
  titulo: string
  descripcion?: string | null
  fecha: string
  hora?: string | null
  repetir: string
  recurrencia?: ConfigRecurrencia | null
  alerta_modal?: boolean
  notificar_whatsapp?: boolean
  completado: boolean
  completado_en?: string | null
  creado_en: string
}

/* ─── Helpers de fecha ─── */

/** Formatea una fecha ISO a texto legible: "Hoy", "Mañana" o "12 mar" */
export function formatearFecha(fecha: string, locale: string = 'es-AR'): string {
  const d = new Date(fecha + 'T00:00:00')
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const mañana = new Date(hoy)
  mañana.setDate(mañana.getDate() + 1)

  if (d.getTime() === hoy.getTime()) return 'Hoy'
  if (d.getTime() === mañana.getTime()) return 'Mañana'

  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

/** Devuelve la fecha de hoy en formato ISO (YYYY-MM-DD) */
export function hoyISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** Devuelve la fecha de mañana en formato ISO (YYYY-MM-DD) */
export function mañanaISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

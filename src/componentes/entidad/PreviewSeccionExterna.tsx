'use client'

/**
 * STUB temporal — el componente real está en construcción en otro chat.
 *
 * `PreviewSeccionExterna` es un componente usado en las páginas de
 * configuración (actividades, asistencias, calendario, inbox,
 * presupuestos, whatsapp) para mostrar un mini-preview del listado
 * filtrado por una sección externa antes de aplicarla. Hasta que se
 * commitee la versión real, no renderiza nada — la página de config
 * funciona sin el preview lateral.
 */

export type ItemPreview = Record<string, unknown>

interface Props {
  items?: ItemPreview[]
  [k: string]: unknown
}

export function PreviewSeccionExterna(_props: Props) {
  return null
}

export default PreviewSeccionExterna

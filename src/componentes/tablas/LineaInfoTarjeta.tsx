'use client'

import type { ReactNode } from 'react'

/**
 * LineaInfoTarjeta — Línea de meta-dato dentro de una tarjeta de listado:
 * un ícono pequeño a la izquierda + texto a la derecha. Se usa para
 * mostrar teléfono, dirección, contacto vinculado, asignado, fecha, etc.
 *
 * Mantiene espaciado, color y alineación consistentes entre todos los
 * módulos que renderizan tarjetas (Contactos, Actividades, Visitas...).
 *
 * Para textos que pueden romper a varias líneas (ej. dirección larga)
 * pasar `alineacion="start"` para que el ícono quede pegado a la primera
 * línea en vez de centrarse verticalmente.
 */

interface Props {
  icono: ReactNode
  children: ReactNode
  /** 'center' (default): ícono y texto centrados verticalmente. 'start': para textos multilínea */
  alineacion?: 'center' | 'start'
  /** Truncar a una línea con elipsis. Default false */
  truncar?: boolean
  className?: string
}

export function LineaInfoTarjeta({ icono, children, alineacion = 'center', truncar = false, className = '' }: Props) {
  const claseAlineacion = alineacion === 'start' ? 'items-start' : 'items-center'
  const claseIcono = alineacion === 'start' ? 'shrink-0 mt-0.5 text-texto-terciario/70' : 'shrink-0 text-texto-terciario/70'
  const claseTexto = truncar ? 'truncate' : 'leading-snug min-w-0'
  return (
    <span className={`flex ${claseAlineacion} gap-2.5 text-xs text-texto-terciario ${className}`}>
      <span className={claseIcono}>{icono}</span>
      <span className={claseTexto}>{children}</span>
    </span>
  )
}

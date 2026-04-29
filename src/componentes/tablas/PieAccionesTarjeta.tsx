'use client'

import type { MouseEvent, ReactNode } from 'react'

/**
 * PieAccionesTarjeta — Footer de acciones rápidas para las tarjetas de los
 * listados en mobile. Cada acción se muestra como icono + label en un grid
 * equiespaciado con divisores entre celdas. Si una acción está deshabilitada
 * (sin dato disponible) se muestra apagada y no es clickeable, así todas
 * las tarjetas mantienen el mismo layout aunque les falte algún dato.
 *
 * Soporta tanto links nativos (tel:, wa.me, https://maps...) como handlers
 * onClick para acciones del propio sistema (completar, posponer, etc.).
 *
 * Se usa en: Contactos, Actividades, Visitas, etc.
 */

export interface AccionTarjeta {
  /** Identificador único para key */
  id: string
  /** Ícono (lucide-react o custom) */
  icono: ReactNode
  /** Texto que va al lado del icono */
  etiqueta: string
  /** Si está, se renderiza como `<a href={href}>` */
  href?: string
  /** Target del link */
  target?: '_blank' | '_self'
  /** Handler opcional. Llamado además del href si ambos están presentes */
  onClick?: (e: MouseEvent) => void
  /** Color custom (ej. var WhatsApp verde). Si se omite, usa text-texto-secundario */
  color?: string
  /** Si true, se muestra apagada y no es clickeable */
  deshabilitado?: boolean
}

interface Props {
  /** Lista de acciones a mostrar (se renderizan todas, las deshabilitadas se ven apagadas) */
  acciones: AccionTarjeta[]
  /** Clases extra para el contenedor */
  className?: string
}

/** Grid con n columnas exactas — para que cada acción ocupe el mismo ancho */
function gridColsClase(n: number): string {
  switch (n) {
    case 1: return 'grid-cols-1'
    case 2: return 'grid-cols-2'
    case 3: return 'grid-cols-3'
    case 4: return 'grid-cols-4'
    case 5: return 'grid-cols-5'
    default: return 'grid-cols-3'
  }
}

export function PieAccionesTarjeta({ acciones, className = '' }: Props) {
  if (acciones.length === 0) return null
  return (
    <div className={`grid border-t border-borde-sutil divide-x divide-borde-sutil ${gridColsClase(acciones.length)} ${className}`}>
      {acciones.map(a => <ItemAccion key={a.id} accion={a} />)}
    </div>
  )
}

function ItemAccion({ accion }: { accion: AccionTarjeta }) {
  const claseBase = 'flex items-center justify-center gap-1.5 py-3 text-sm transition-colors'

  // Estado deshabilitado: mismo layout pero opaco y no clickeable.
  if (accion.deshabilitado) {
    return (
      <span
        className={`${claseBase} text-texto-terciario/40 cursor-not-allowed select-none`}
        aria-disabled="true"
      >
        {accion.icono}
        <span>{accion.etiqueta}</span>
      </span>
    )
  }

  // Hover: si tiene color custom, reduce opacidad (preserva color de marca);
  // si no, vira al color de marca para feedback estándar.
  const claseHover = accion.color
    ? 'hover:opacity-80 active:opacity-70'
    : 'text-texto-secundario hover:text-texto-marca active:bg-white/[0.03]'
  const className = `${claseBase} ${claseHover}`
  const style = accion.color ? { color: accion.color } : undefined

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    accion.onClick?.(e)
  }

  const contenido = (
    <>
      {accion.icono}
      <span>{accion.etiqueta}</span>
    </>
  )

  if (accion.href) {
    return (
      <a
        href={accion.href}
        target={accion.target}
        rel={accion.target === '_blank' ? 'noopener noreferrer' : undefined}
        onClick={handleClick}
        className={className}
        style={style}
        aria-label={accion.etiqueta}
      >
        {contenido}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${className} bg-transparent border-0 cursor-pointer w-full p-0`}
      style={style}
      aria-label={accion.etiqueta}
    >
      {contenido}
    </button>
  )
}

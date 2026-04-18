'use client'

import type { ReactNode } from 'react'

interface PropiedadesTarjeta {
  children: ReactNode
  titulo?: string
  subtitulo?: string
  acciones?: ReactNode
  onClick?: () => void
  className?: string
  compacta?: boolean
}

/**
 * Tarjeta — Contenedor visual reutilizable.
 * Se usa en: dashboard widgets, cards de kanban, items de lista, resumen de entidades.
 */
function Tarjeta({ children, titulo, subtitulo, acciones, onClick, className = '', compacta }: PropiedadesTarjeta) {
  return (
    <div
      onClick={onClick}
      className={[
        'bg-superficie-tarjeta border border-borde-sutil rounded-card transition-all duration-150',
        compacta ? 'p-3' : 'p-5',
        onClick ? 'cursor-pointer hover:border-borde-fuerte hover:shadow-sm' : '',
        className,
      ].join(' ')}
    >
      {(titulo || acciones) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {titulo && <h3 className="text-sm font-semibold text-texto-primario">{titulo}</h3>}
            {subtitulo && <p className="text-xs text-texto-terciario mt-0.5">{subtitulo}</p>}
          </div>
          {acciones && <div className="flex items-center gap-1 shrink-0">{acciones}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export { Tarjeta, type PropiedadesTarjeta }

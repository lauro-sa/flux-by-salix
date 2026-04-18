'use client'

import type { ReactNode } from 'react'

interface PropiedadesPildora {
  children: ReactNode
  activa?: boolean
  onClick?: () => void
  icono?: ReactNode
  removible?: boolean
  onRemover?: () => void
  className?: string
}

/**
 * Pildora — Chip de filtro clickeable/removible.
 * Se usa en: filtros activos, selección múltiple, tags de búsqueda.
 */
function Pildora({ children, activa, onClick, icono, removible, onRemover, className = '' }: PropiedadesPildora) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-insignia text-sm font-medium border cursor-pointer transition-all duration-150',
        activa
          ? 'bg-insignia-primario-fondo text-insignia-primario-texto border-texto-marca'
          : 'bg-superficie-tarjeta text-texto-secundario border-borde-sutil hover:border-borde-fuerte',
        className,
      ].join(' ')}
    >
      {icono}
      {children}
      {removible && (
        <span
          onClick={(e) => { e.stopPropagation(); onRemover?.() }}
          className="inline-flex items-center justify-center size-4 rounded-full hover:bg-black/10 text-xs leading-none"
        >
          ×
        </span>
      )}
    </button>
  )
}

export { Pildora, type PropiedadesPildora }

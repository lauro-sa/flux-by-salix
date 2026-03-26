'use client'

import type { ReactNode } from 'react'

interface ItemLineaTiempo {
  id: string
  icono?: ReactNode
  color?: string
  titulo: string
  descripcion?: string
  fecha: string
  contenido?: ReactNode
}

interface PropiedadesLineaTiempo {
  items: ItemLineaTiempo[]
  className?: string
}

/**
 * LineaTiempo — Timeline vertical para historial/auditoría/chatter.
 * Se usa en: chatter de contactos, auditoría, historial de cambios.
 */
function LineaTiempo({ items, className = '' }: PropiedadesLineaTiempo) {
  return (
    <div className={`flex flex-col ${className}`}>
      {items.map((item, i) => (
        <div key={item.id} className="flex gap-3">
          {/* Línea y punto */}
          <div className="flex flex-col items-center">
            <div className={`flex items-center justify-center size-8 rounded-full shrink-0 text-xs ${item.color || 'bg-superficie-hover text-texto-terciario'}`}>
              {item.icono || '●'}
            </div>
            {i < items.length - 1 && <div className="w-px flex-1 bg-borde-sutil my-1" />}
          </div>

          {/* Contenido */}
          <div className="pb-6 pt-1 flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-texto-primario">{item.titulo}</p>
              <span className="text-xs text-texto-terciario whitespace-nowrap shrink-0">{item.fecha}</span>
            </div>
            {item.descripcion && <p className="text-xs text-texto-secundario mt-0.5">{item.descripcion}</p>}
            {item.contenido && <div className="mt-2">{item.contenido}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export { LineaTiempo, type PropiedadesLineaTiempo, type ItemLineaTiempo }

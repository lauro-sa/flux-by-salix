'use client'

import type { ReactNode } from 'react'

interface ColumnaKanban {
  id: string
  titulo: string
  color?: string
  contador?: number
}

interface PropiedadesKanban<T> {
  columnas: ColumnaKanban[]
  items: T[]
  obtenerColumna: (item: T) => string
  renderItem: (item: T) => ReactNode
  claveItem: (item: T) => string
  className?: string
}

/**
 * Kanban — Tablero horizontal con columnas.
 * Se usa en: pipeline de contactos, conversaciones, órdenes de trabajo.
 */
function Kanban<T>({ columnas, items, obtenerColumna, renderItem, claveItem, className = '' }: PropiedadesKanban<T>) {
  return (
    <div className={`flex gap-4 overflow-x-auto con-indicador-scroll pb-4 ${className}`}>
      {columnas.map((col) => {
        const itemsColumna = items.filter((item) => obtenerColumna(item) === col.id)
        return (
          <div key={col.id} className="flex flex-col gap-3 min-w-[240px] sm:min-w-[280px] w-[240px] sm:w-[280px] shrink-0">
            {/* Header de columna */}
            <div className="flex items-center gap-2 px-1">
              {col.color && <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />}
              <span className="text-sm font-semibold text-texto-primario">{col.titulo}</span>
              <span className="text-xs text-texto-terciario bg-superficie-hover px-1.5 py-0.5 rounded-full">
                {col.contador ?? itemsColumna.length}
              </span>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-2">
              {itemsColumna.map((item) => (
                <div key={claveItem(item)}>{renderItem(item)}</div>
              ))}
              {itemsColumna.length === 0 && (
                <div className="text-xs text-texto-terciario text-center py-8 border border-dashed border-borde-sutil rounded-card">
                  Sin items
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { Kanban, type PropiedadesKanban, type ColumnaKanban }

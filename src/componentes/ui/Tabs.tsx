'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Tab {
  clave: string
  etiqueta: string
  icono?: ReactNode
  contador?: number
}

interface PropiedadesTabs {
  tabs: Tab[]
  activo: string
  onChange: (clave: string) => void
  className?: string
  /** ID único para animar el indicador cuando hay múltiples Tabs en la misma vista */
  layoutId?: string
}

/**
 * Tabs — Pestañas con indicador animado.
 * Se usa en: vistas de módulos, configuración, dashboard (panel/métricas).
 */
function Tabs({ tabs, activo, onChange, className = '', layoutId = 'tab-indicator' }: PropiedadesTabs) {
  return (
    <div
      className={`flex gap-0.5 px-3 border-b border-borde-sutil ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const esActivo = tab.clave === activo
        return (
          <button
            key={tab.clave}
            role="tab"
            aria-selected={esActivo}
            onClick={() => onChange(tab.clave)}
            className={[
              'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-none bg-transparent cursor-pointer transition-colors duration-150 whitespace-nowrap',
              esActivo ? 'text-texto-marca' : 'text-texto-terciario hover:text-texto-secundario',
            ].join(' ')}
          >
            {tab.icono}
            <span className={esActivo ? 'inline' : 'hidden sm:inline'}>{tab.etiqueta}</span>
            {tab.contador !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${esActivo ? 'bg-insignia-primario-fondo text-insignia-primario-texto' : 'bg-superficie-hover text-texto-terciario'}`}>
                {tab.contador}
              </span>
            )}
            {esActivo && (
              <motion.div
                layoutId={layoutId}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-texto-marca rounded-full"
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export { Tabs, type PropiedadesTabs, type Tab }

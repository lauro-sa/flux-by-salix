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
}

/**
 * Tabs — Pestañas con indicador animado.
 * Se usa en: vistas de módulos, configuración, dashboard (panel/métricas).
 */
function Tabs({ tabs, activo, onChange, className = '' }: PropiedadesTabs) {
  return (
    <div className={`flex gap-1 border-b border-borde-sutil ${className}`}>
      {tabs.map((tab) => {
        const esActivo = tab.clave === activo
        return (
          <button
            key={tab.clave}
            onClick={() => onChange(tab.clave)}
            className={[
              'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-none bg-transparent cursor-pointer transition-colors duration-150',
              esActivo ? 'text-texto-marca' : 'text-texto-terciario hover:text-texto-secundario',
            ].join(' ')}
          >
            {tab.icono}
            <span className="hidden sm:inline">{tab.etiqueta}</span>
            {tab.contador !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${esActivo ? 'bg-insignia-primario-fondo text-insignia-primario-texto' : 'bg-superficie-hover text-texto-terciario'}`}>
                {tab.contador}
              </span>
            )}
            {esActivo && (
              <motion.div
                layoutId="tab-indicator"
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

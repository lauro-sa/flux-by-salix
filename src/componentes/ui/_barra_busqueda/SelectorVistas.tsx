'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreVertical } from 'lucide-react'
import type { OpcionVista } from './tipos'

/* ─── Props ─── */

interface PropiedadesSelectorVistas {
  vistaActual?: string
  opciones: OpcionVista[]
  onCambiarVista: (id: string) => void
  /** Ref del contenedor padre para cerrar al hacer click fuera (manejado externamente) */
  dropdownAbierto: boolean
  onToggleDropdown: (abierto: boolean) => void
}

/**
 * SelectorVistas — Botones de vista (lista/tarjetas/kanban) en desktop, dropdown en mobile.
 * Se usa en: BarraBusqueda, zona derecha de la cápsula.
 */
function SelectorVistas({
  vistaActual,
  opciones,
  onCambiarVista,
  dropdownAbierto,
  onToggleDropdown,
}: PropiedadesSelectorVistas) {
  return (
    <>
      {/* Desktop: botones separados */}
      <div className="hidden md:flex items-center gap-0.5">
        {opciones.map((v) => (
          <motion.button
            key={v.id}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onCambiarVista(v.id)}
            disabled={v.deshabilitada}
            className={[
              'shrink-0 size-7 inline-flex items-center justify-center rounded-md cursor-pointer border-none transition-colors',
              v.id === vistaActual
                ? 'bg-insignia-primario-fondo text-texto-marca'
                : 'bg-transparent text-texto-terciario hover:bg-superficie-hover hover:text-texto-secundario',
              v.deshabilitada ? 'opacity-40 cursor-not-allowed' : '',
            ].join(' ')}
            title={v.etiqueta}
          >
            {v.icono}
          </motion.button>
        ))}
      </div>

      {/* Mobile: dropdown */}
      <div className="relative md:hidden">
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => onToggleDropdown(!dropdownAbierto)}
          className="shrink-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario"
        >
          <MoreVertical size={16} />
        </motion.button>
        <AnimatePresence>
          {dropdownAbierto && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full right-0 mt-1 bg-superficie-elevada border border-borde-sutil rounded-md shadow-lg z-50 overflow-hidden min-w-[140px]"
            >
              {opciones.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={v.deshabilitada}
                  onClick={() => { onCambiarVista(v.id); onToggleDropdown(false) }}
                  className={[
                    'flex items-center gap-2 w-full px-3 py-2 text-sm text-left border-none cursor-pointer transition-colors',
                    v.id === vistaActual
                      ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                      : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                    v.deshabilitada ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  {v.icono}
                  {v.etiqueta}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

export { SelectorVistas }

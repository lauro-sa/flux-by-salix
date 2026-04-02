'use client'

import { motion } from 'framer-motion'
import { X } from 'lucide-react'

/* ─── Props ─── */

interface PropiedadesPillFiltroActivo {
  etiqueta: string
  valor: string
  onRemover: () => void
}

/**
 * PillFiltroActivo — Cápsula que muestra un filtro activo dentro de la barra de búsqueda.
 * Se usa en: BarraBusqueda, para cada filtro con valor seleccionado.
 */
function PillFiltroActivo({ etiqueta, valor, onRemover }: PropiedadesPillFiltroActivo) {
  return (
    <motion.span
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.2 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-primario-fondo text-insignia-primario-texto whitespace-nowrap shrink-0"
    >
      <span className="text-xs opacity-70">{etiqueta}:</span>
      {valor}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemover() }}
        className="inline-flex items-center justify-center size-3.5 rounded-full hover:bg-black/10 cursor-pointer border-none bg-transparent text-current p-0"
      >
        <X size={10} />
      </button>
    </motion.span>
  )
}

export { PillFiltroActivo }

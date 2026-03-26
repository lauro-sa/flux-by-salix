'use client'

import { motion } from 'framer-motion'

interface PropiedadesInterruptor {
  activo: boolean
  onChange: (valor: boolean) => void
  etiqueta?: string
  deshabilitado?: boolean
}

/**
 * Interruptor — Toggle switch animado.
 * Se usa en: configuración, habilitar/deshabilitar funciones.
 */
function Interruptor({ activo, onChange, etiqueta, deshabilitado }: PropiedadesInterruptor) {
  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer select-none ${deshabilitado ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={deshabilitado}
        onClick={() => !deshabilitado && onChange(!activo)}
        className={[
          'relative inline-flex items-center w-10 h-[22px] rounded-full border-none cursor-pointer transition-colors duration-200 p-0',
          activo ? 'bg-texto-marca' : 'bg-borde-fuerte',
        ].join(' ')}
      >
        <motion.div
          animate={{ x: activo ? 20 : 2 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          className="size-[18px] rounded-full bg-white shadow-sm"
        />
      </button>
      {etiqueta && <span className="text-sm text-texto-primario">{etiqueta}</span>}
    </label>
  )
}

export { Interruptor, type PropiedadesInterruptor }

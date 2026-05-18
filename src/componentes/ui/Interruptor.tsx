'use client'

import { motion } from 'framer-motion'

interface PropiedadesInterruptor {
  activo: boolean
  onChange: (valor: boolean) => void
  etiqueta?: string
  deshabilitado?: boolean
  /**
   * Tamaño del switch. 'sm' se usa en filas densas (acciones de fila,
   * tablas, etc.) donde el tamaño normal sería desproporcionado.
   */
  tamano?: 'sm' | 'md'
  titulo?: string
}

/**
 * Interruptor — Toggle switch animado.
 * Se usa en: configuración, habilitar/deshabilitar funciones.
 */
function Interruptor({ activo, onChange, etiqueta, deshabilitado, tamano = 'md', titulo }: PropiedadesInterruptor) {
  const compacto = tamano === 'sm'
  const dim = compacto
    ? { track: 'w-7 h-[16px]', thumb: 'size-[12px]', xOn: 13, xOff: 2 }
    : { track: 'w-10 h-[22px]', thumb: 'size-[18px]', xOn: 20, xOff: 2 }

  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer select-none ${deshabilitado ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={titulo ?? etiqueta}
        title={titulo}
        disabled={deshabilitado}
        onClick={() => !deshabilitado && onChange(!activo)}
        className={[
          'relative inline-flex items-center rounded-full border-none cursor-pointer transition-colors duration-200 p-0',
          dim.track,
          activo ? 'bg-texto-marca' : 'bg-borde-fuerte',
        ].join(' ')}
      >
        <motion.div
          animate={{ x: activo ? dim.xOn : dim.xOff }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          className={`${dim.thumb} rounded-full bg-white shadow-sm`}
        />
      </button>
      {etiqueta && <span className="text-sm text-texto-primario">{etiqueta}</span>}
    </label>
  )
}

export { Interruptor, type PropiedadesInterruptor }

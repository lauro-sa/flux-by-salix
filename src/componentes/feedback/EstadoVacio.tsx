'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface PropiedadesEstadoVacio {
  icono?: ReactNode
  titulo: string
  descripcion?: string
  accion?: ReactNode
}

/**
 * EstadoVacio — Placeholder cuando no hay datos.
 * Se usa en: listas vacías, tablas sin resultados, módulos sin datos.
 * El icono se anima con un fade-in + scale sutil al montar.
 */
function EstadoVacio({ icono, titulo, descripcion, accion }: PropiedadesEstadoVacio) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4"
    >
      {icono && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-texto-terciario mb-2 [&>svg]:w-16 [&>svg]:h-16 icono-dibujar"
        >
          {icono}
        </motion.div>
      )}
      <h3 className="text-lg font-semibold text-texto-primario">{titulo}</h3>
      {descripcion && <p className="text-base text-texto-terciario max-w-[360px] leading-relaxed">{descripcion}</p>}
      {accion && <div className="mt-3">{accion}</div>}
    </motion.div>
  )
}

export { EstadoVacio, type PropiedadesEstadoVacio }

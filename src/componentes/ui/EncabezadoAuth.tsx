'use client'

import { motion } from 'framer-motion'

interface PropiedadesEncabezadoAuth {
  titulo: string
  descripcion?: string
}

/**
 * EncabezadoAuth — título + descripción para páginas de auth.
 * Anima la entrada de título y descripción con framer-motion.
 */
function EncabezadoAuth({ titulo, descripcion }: PropiedadesEncabezadoAuth) {
  return (
    <motion.div
      key={titulo}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="text-center mb-6"
    >
      <h2 className="text-lg font-semibold text-texto-primario mb-1">{titulo}</h2>
      {descripcion && <p className="text-base text-texto-terciario">{descripcion}</p>}
    </motion.div>
  )
}

export { EncabezadoAuth, type PropiedadesEncabezadoAuth }

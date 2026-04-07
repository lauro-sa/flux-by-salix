/**
 * Pantalla transitoria mientras se busca al empleado en la BD.
 * Spinner + mensaje de identificación.
 */
'use client'

import { motion } from 'framer-motion'

export default function PantallaIdentificando() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Spinner */}
      <motion.div
        className="w-16 h-16 rounded-full border-4"
        style={{
          borderColor: 'var(--borde-sutil)',
          borderTopColor: 'var(--texto-marca)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
      <p
        className="text-xl font-medium"
        style={{ color: 'var(--texto-secundario)' }}
      >
        Identificando...
      </p>
    </motion.div>
  )
}

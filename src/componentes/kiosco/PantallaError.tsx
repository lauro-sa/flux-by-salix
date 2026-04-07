/**
 * Pantalla de error con auto-dismiss (2.5s).
 * Muestra mensaje de error y vuelve automáticamente a espera.
 */
'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface PropsPantallaError {
  /** Mensaje de error a mostrar */
  mensaje: string
  /** Callback al expirar el auto-dismiss */
  alDismiss: () => void
  /** Duración antes de auto-dismiss (ms) */
  duracionMs?: number
}

export default function PantallaError({
  mensaje,
  alDismiss,
  duracionMs = 2500,
}: PropsPantallaError) {
  useEffect(() => {
    const timer = setTimeout(alDismiss, duracionMs)
    return () => clearTimeout(timer)
  }, [alDismiss, duracionMs])

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-6"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      {/* Ícono de error */}
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--insignia-peligro)', opacity: 0.15 }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ color: 'var(--insignia-peligro)' }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>

      <p
        className="text-2xl font-medium text-center max-w-md"
        style={{ color: 'var(--texto-primario)' }}
      >
        {mensaje}
      </p>

      <p
        className="text-sm"
        style={{ color: 'var(--texto-terciario)' }}
      >
        Volviendo en unos segundos...
      </p>
    </motion.div>
  )
}

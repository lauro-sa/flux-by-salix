/**
 * Pantalla de error con auto-dismiss (2.5s).
 * Animación shake + sonido de error.
 */
'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface PropsPantallaError {
  mensaje: string
  alDismiss: () => void
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Ícono de error con shake */}
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: 'rgba(248, 113, 113, 0.15)',
          animation: 'kiosco-shake 0.4s ease-in-out',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--kiosco-peligro)"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>

      <p
        className="font-medium text-center max-w-md"
        style={{
          fontSize: 'clamp(1.25rem, 4vw, 2rem)',
          color: 'var(--kiosco-texto)',
        }}
      >
        {mensaje}
      </p>

      <p className="text-sm" style={{ color: 'var(--kiosco-texto-dim)' }}>
        Volviendo en unos segundos...
      </p>
    </motion.div>
  )
}

'use client'

import { useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTema } from '@/hooks/useTema'

type TamanoModal = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  tamano?: TamanoModal
  children: ReactNode
  acciones?: ReactNode
}

const clasesAncho: Record<TamanoModal, string> = {
  sm: 'max-w-[400px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[640px]',
  xl: 'max-w-[780px]',
  '2xl': 'max-w-[900px]',
  '3xl': 'max-w-[1024px]',
  '4xl': 'max-w-[1152px]',
  '5xl': 'max-w-[1280px]',
}

/**
 * Modal — Portal con backdrop. TODOS los modales de Flux usan este componente.
 * Más anchos que altos en PC. Responsive en mobile.
 * En modo cristal: panel con backdrop-filter blur.
 */
function Modal({ abierto, onCerrar, titulo, tamano = 'lg', children, acciones }: PropiedadesModal) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'

  const manejarTecla = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCerrar()
  }, [onCerrar])

  useEffect(() => {
    if (abierto) {
      document.addEventListener('keydown', manejarTecla)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', manejarTecla)
      document.body.style.overflow = ''
    }
  }, [abierto, manejarTecla])

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0" style={{ zIndex: 'var(--z-modal)' as unknown as number }}>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
            style={{
              backgroundColor: esCristal ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)',
            }}
            onClick={onCerrar}
          />
          {/* Panel */}
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.15 }}
              className={`rounded-lg shadow-elevada w-full ${clasesAncho[tamano]} max-h-[85vh] flex flex-col pointer-events-auto border border-borde-sutil`}
              style={esCristal ? {
                backgroundColor: 'var(--superficie-flotante)',
                backdropFilter: 'blur(32px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
              } : {
                backgroundColor: 'var(--superficie-elevada)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {titulo && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-borde-sutil shrink-0">
                <h2 className="text-lg font-semibold text-texto-primario">{titulo}</h2>
                <button onClick={onCerrar} className="flex items-center justify-center size-10 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover text-lg">
                  ×
                </button>
              </div>
            )}
            <div className="px-6 py-6 flex-1 overflow-y-auto">{children}</div>
            {acciones && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-borde-sutil shrink-0">
                {acciones}
              </div>
            )}
          </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export { Modal, type PropiedadesModal, type TamanoModal }

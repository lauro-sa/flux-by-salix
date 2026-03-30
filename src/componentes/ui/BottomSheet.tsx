'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTema } from '@/hooks/useTema'

interface PropiedadesBottomSheet {
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  children: ReactNode
  acciones?: ReactNode
  altura?: 'auto' | 'medio' | 'completo'
}

const clasesAltura = {
  auto: 'max-h-[80vh]',
  medio: 'h-[50vh]',
  completo: 'h-[90vh]',
}

/**
 * BottomSheet — Modal que sube desde abajo, ideal para mobile.
 * Se usa para: acciones rápidas, filtros, selectores en mobile.
 * En modo cristal: panel con backdrop-filter blur.
 */
function BottomSheet({ abierto, onCerrar, titulo, children, acciones, altura = 'auto' }: PropiedadesBottomSheet) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'

  useEffect(() => {
    if (abierto) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [abierto])

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
            className="absolute inset-0"
            style={{
              backgroundColor: esCristal ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)',
            }}
            onClick={onCerrar}
          />
          {/* Panel */}
          <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={`rounded-t-xl w-full max-w-lg ${clasesAltura[altura]} flex flex-col pointer-events-auto border border-borde-sutil`}
              style={esCristal ? {
                backgroundColor: 'var(--superficie-flotante)',
                backdropFilter: 'blur(32px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
              } : {
                backgroundColor: 'var(--superficie-elevada)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Handle de arrastre */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-borde-fuerte" />
            </div>

            {titulo && (
              <div className="px-5 py-3 border-b border-borde-sutil shrink-0">
                <h3 className="text-base font-semibold text-texto-primario">{titulo}</h3>
              </div>
            )}

            <div className="px-5 py-4 flex-1 overflow-visible">{children}</div>

            {acciones && (
              <div className="flex gap-3 px-5 py-4 border-t border-borde-sutil shrink-0">
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

export { BottomSheet, type PropiedadesBottomSheet }

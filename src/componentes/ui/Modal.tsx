'use client'

import { useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTema } from '@/hooks/useTema'
import { useScrollLockiOS } from '@/hooks/useScrollLockiOS'

type TamanoModal = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  tamano?: TamanoModal
  children: ReactNode
  acciones?: ReactNode
  /** Botones extra en el encabezado (al lado del título, antes del botón cerrar) */
  accionesEncabezado?: ReactNode
  /** Quita el padding y scroll del contenedor de children para layouts personalizados */
  sinPadding?: boolean
  /** Modo pantalla completa — ignora tamano y ocupa todo el viewport */
  expandido?: boolean
}

const anchosPx: Record<TamanoModal, number> = {
  sm: 420,
  md: 520,
  lg: 620,
  xl: 720,
  '2xl': 820,
  '3xl': 920,
  '4xl': 1000,
  '5xl': 1080,
}

/**
 * Modal — Portal con backdrop. TODOS los modales de Flux usan este componente.
 * Más anchos que altos en PC. Responsive en mobile.
 * En modo cristal: panel con backdrop-filter blur.
 */
function Modal({ abierto, onCerrar, titulo, tamano = 'lg', children, acciones, accionesEncabezado, sinPadding, expandido }: PropiedadesModal) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const panelRef = useRef<HTMLDivElement>(null)

  // iOS: position:fixed en body para evitar scroll detrás del modal
  useScrollLockiOS(abierto)

  const manejarTecla = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onCerrar(); return }

    // Focus trap: Tab / Shift+Tab cicla dentro del modal
    if (e.key === 'Tab' && panelRef.current) {
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) return
      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === primero) { ultimo.focus(); e.preventDefault() }
      } else {
        if (document.activeElement === ultimo) { primero.focus(); e.preventDefault() }
      }
    }
  }, [onCerrar])

  useEffect(() => {
    if (abierto) {
      document.addEventListener('keydown', manejarTecla)
      // Auto-focus al primer elemento focusable del modal
      requestAnimationFrame(() => {
        const primero = panelRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        primero?.focus()
      })
    }
    return () => {
      document.removeEventListener('keydown', manejarTecla)
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
          <div className={expandido ? 'absolute inset-0 flex pointer-events-none' : 'absolute inset-0 flex items-center justify-center p-4 pointer-events-none'}>
            <motion.div
              ref={panelRef}
              initial={expandido ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
              animate={expandido ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={expandido ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 0 }}
              transition={{ duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              aria-label={titulo || 'Modal'}
              className={expandido
                ? 'w-full h-full flex flex-col pointer-events-auto'
                : `rounded-lg shadow-elevada w-full flex flex-col pointer-events-auto border border-borde-sutil ${
                  ['3xl', '4xl', '5xl'].includes(tamano) ? 'max-h-[90dvh]' : 'max-h-[min(85dvh,640px)]'
                }`
              }
              style={{
                ...(expandido ? {} : { maxWidth: `min(calc(100vw - 2rem), ${anchosPx[tamano]}px)` }),
                ...(esCristal ? {
                  backgroundColor: 'var(--superficie-flotante)',
                  backdropFilter: 'blur(32px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
                } : {
                  backgroundColor: 'var(--superficie-elevada)',
                }),
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {titulo && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
                <h2 className="text-lg font-semibold text-texto-primario">{titulo}</h2>
                <div className="flex items-center gap-1">
                  {accionesEncabezado}
                  <button onClick={onCerrar} aria-label="Cerrar"
                    className="flex items-center justify-center size-7 rounded-lg border border-white/[0.08] bg-transparent text-texto-terciario cursor-pointer hover:bg-white/[0.06] hover:text-texto-secundario transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            )}
            <div className={sinPadding ? 'flex-1 min-h-0 flex flex-col overflow-y-auto' : 'px-6 py-6 flex-1 overflow-y-auto'}>{children}</div>
            {acciones && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.07] shrink-0">
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

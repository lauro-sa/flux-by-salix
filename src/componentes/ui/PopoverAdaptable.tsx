'use client'

/**
 * PopoverAdaptable — Popover en desktop, panel desplegable full-width en móvil.
 *
 * Misma API que Popover. En móvil, el trigger abre un panel que se despliega
 * desde el header hacia abajo, ocupando todo el ancho de la pantalla.
 *
 * Se usa en: NotificacionesHeader, RecordatoriosHeader, y cualquier
 * panel flotante que necesite adaptarse a mobile.
 */

import { type ReactNode, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Popover } from '@/componentes/ui/Popover'
import { useEsMovil } from '@/hooks/useEsMovil'

type Alineacion = 'inicio' | 'centro' | 'fin'
type Lado = 'abajo' | 'arriba'

interface PropiedadesPopoverAdaptable {
  children: ReactNode
  contenido: ReactNode
  abierto?: boolean
  onCambio?: (abierto: boolean) => void
  alineacion?: Alineacion
  lado?: Lado
  ancho?: number | string
  altoMaximo?: number | string
  offset?: number
  clasePan?: string
  sinCerrarClickFuera?: boolean
  /** Título del panel en móvil (ya no se usa BottomSheet pero se mantiene la prop) */
  tituloMovil?: string
}

function PopoverAdaptable({
  children,
  contenido,
  abierto,
  onCambio,
  tituloMovil,
  ...propsPopover
}: PropiedadesPopoverAdaptable) {
  const esMovil = useEsMovil()

  /* Cerrar con Escape en mobile */
  const cerrar = useCallback(() => onCambio?.(false), [onCambio])

  useEffect(() => {
    if (!esMovil || !abierto) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [esMovil, abierto, cerrar])

  if (esMovil) {
    const estaAbierto = abierto ?? false
    return (
      <>
        {/* Trigger */}
        <span
          onClick={() => onCambio?.(!estaAbierto)}
          className="inline-flex"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onCambio?.(!estaAbierto)
          }}
        >
          {children}
        </span>

        {/* Panel desplegable desde el header — full width */}
        {typeof window !== 'undefined' && createPortal(
          <AnimatePresence>
            {estaAbierto && (
              <div className="fixed inset-0 z-50">
                {/* Overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 bg-black/30"
                  onClick={cerrar}
                />

                {/* Panel — se ancla justo debajo del header (h-14 = 56px) */}
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 380, mass: 0.6 }}
                  className="absolute left-0 right-0 bg-superficie-elevada border-b border-borde-sutil shadow-elevada overflow-hidden overflow-y-auto"
                  style={{
                    top: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
                    maxHeight: 'calc(100dvh - 3.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {contenido}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </>
    )
  }

  return (
    <Popover
      abierto={abierto}
      onCambio={onCambio}
      {...propsPopover}
      contenido={contenido}
    >
      {children}
    </Popover>
  )
}

export { PopoverAdaptable, type PropiedadesPopoverAdaptable }

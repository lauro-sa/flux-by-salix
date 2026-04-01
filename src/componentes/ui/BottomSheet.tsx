'use client'

/**
 * BottomSheet — Panel que sube desde abajo, diseñado para móvil.
 *
 * Features:
 * - Swipe-to-dismiss: arrastrás hacia abajo y cierra
 * - Safe areas: respeta notch, Dynamic Island y home indicator (iOS + Android)
 * - Mínimo 75% del viewport para que siempre haya espacio cómodo
 * - Scroll interno en el contenido, no en el sheet entero
 * - Selectores/dropdowns se abren POR FUERA del sheet (overflow visible en el panel)
 * - Teclado virtual: se ajusta automáticamente en iOS y Android
 * - Modo cristal: blur cuando está activo
 *
 * Se usa en: acciones rápidas, filtros, selectores, menús en mobile.
 * Para desktop usar Modal.tsx.
 */

import { useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { useTema } from '@/hooks/useTema'

/* ─── Tipos ─── */

type AlturaSheet = 'auto' | 'medio' | 'alto' | 'completo'

interface PropiedadesBottomSheet {
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  children: ReactNode
  acciones?: ReactNode
  /** Altura del sheet. Mínimo siempre 75vh. Default: 'auto' (se adapta al contenido, mín 75vh) */
  altura?: AlturaSheet
  /** Quita el padding del contenido para layouts personalizados */
  sinPadding?: boolean
}

/* ─── Alturas como % del viewport ─── */

const ALTURAS_VP: Record<AlturaSheet, string> = {
  auto: 'min(max(75vh, auto), 92vh)',
  medio: '75vh',
  alto: '85vh',
  completo: '92vh',
}

/** Distancia mínima de drag para cerrar (px) */
const UMBRAL_CIERRE = 100

/** Velocidad mínima de drag para cerrar (px/s) */
const VELOCIDAD_CIERRE = 400

/* ─── Componente ─── */

function BottomSheet({
  abierto,
  onCerrar,
  titulo,
  children,
  acciones,
  altura = 'auto',
  sinPadding = false,
}: PropiedadesBottomSheet) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const panelRef = useRef<HTMLDivElement>(null)
  const y = useMotionValue(0)
  const overlayOpacity = useTransform(y, [0, 300], [1, 0])

  /* ── Bloquear scroll del body ── */
  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = 'hidden'
      y.set(0)
    }
    return () => { document.body.style.overflow = '' }
  }, [abierto, y])

  /* ── Escape para cerrar ── */
  const manejarTecla = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCerrar()
  }, [onCerrar])

  useEffect(() => {
    if (abierto) document.addEventListener('keydown', manejarTecla)
    return () => document.removeEventListener('keydown', manejarTecla)
  }, [abierto, manejarTecla])

  /* ── Ajustar cuando aparece el teclado virtual (iOS/Android) ── */
  useEffect(() => {
    if (!abierto || !window.visualViewport) return

    const vv = window.visualViewport
    const manejarResize = () => {
      if (!panelRef.current) return
      const alturaVP = vv.height
      const alturaVentana = window.innerHeight
      const tecladoAbierto = alturaVentana - alturaVP > 100

      if (tecladoAbierto) {
        panelRef.current.style.maxHeight = `${alturaVP - 20}px`
        panelRef.current.style.transition = 'max-height 0.25s ease'
      } else {
        panelRef.current.style.maxHeight = ''
        panelRef.current.style.transition = ''
      }
    }

    vv.addEventListener('resize', manejarResize)
    return () => vv.removeEventListener('resize', manejarResize)
  }, [abierto])

  /* ── Swipe-to-dismiss ── */
  const manejarDragEnd = useCallback((_: unknown, info: PanInfo) => {
    const { offset, velocity } = info

    if (offset.y > UMBRAL_CIERRE || velocity.y > VELOCIDAD_CIERRE) {
      // Cerrar con animación
      onCerrar()
    }
    // Si no se cierra, Framer Motion lo rebotea al origen por dragConstraints
  }, [onCerrar])

  if (typeof window === 'undefined') return null

  /* ── Estilos del panel según cristal/sólido ── */
  const estiloPanel = esCristal ? {
    y,
    backgroundColor: 'var(--superficie-flotante, var(--superficie-elevada))',
    backdropFilter: 'blur(32px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
  } : {
    y,
    backgroundColor: 'var(--superficie-elevada)',
  }

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0" style={{ zIndex: 'var(--z-modal)' as unknown as number }}>
          {/* ── Overlay ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
            style={{
              backgroundColor: esCristal ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.45)',
              opacity: overlayOpacity,
            }}
            onClick={onCerrar}
          />

          {/* ── Contenedor alineado al fondo ── */}
          <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
            <motion.div
              ref={panelRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 350, mass: 0.8 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.4 }}
              dragMomentum={false}
              onDragEnd={manejarDragEnd}
              style={estiloPanel}
              className={[
                'w-full rounded-t-2xl flex flex-col pointer-events-auto',
                'border border-b-0 border-borde-sutil shadow-elevada',
                /* overflow visible para que selectores/dropdowns se abran por fuera */
                'overflow-visible',
              ].join(' ')}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Drag handle — zona de agarre ── */}
              <div className="flex justify-center pt-2.5 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none">
                <div className="w-9 h-[5px] rounded-full bg-borde-fuerte/60" />
              </div>

              {/* ── Título ── */}
              {titulo && (
                <div className="px-5 py-3 border-b border-borde-sutil shrink-0">
                  <h3 className="text-base font-semibold text-texto-primario text-center">{titulo}</h3>
                </div>
              )}

              {/* ── Contenido con scroll interno ── */}
              <div
                className={[
                  'flex-1 overflow-y-auto overscroll-contain min-h-0',
                  sinPadding ? '' : 'px-5 py-4',
                ].join(' ')}
                style={{ maxHeight: ALTURAS_VP[altura] }}
              >
                {children}
              </div>

              {/* ── Acciones — alejadas de la home bar de iOS ── */}
              {acciones && (
                <div
                  className="flex gap-3 px-5 pt-3 border-t border-borde-sutil shrink-0"
                  style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}
                >
                  {acciones}
                </div>
              )}

              {/* ── Safe area inferior cuando no hay acciones ── */}
              {!acciones && (
                <div
                  className="shrink-0"
                  style={{ height: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
                />
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export { BottomSheet, type PropiedadesBottomSheet, type AlturaSheet }

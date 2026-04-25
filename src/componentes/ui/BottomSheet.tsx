'use client'

/**
 * BottomSheet — Panel que sube desde abajo, diseñado para móvil.
 *
 * Features:
 * - Swipe-to-dismiss: arrastrás hacia abajo y cierra (solo si scroll está arriba)
 * - Safe areas: respeta notch, Dynamic Island y home indicator (iOS + Android)
 * - Mínimo 75% del viewport para que siempre haya espacio cómodo
 * - Scroll interno en el contenido, no en el sheet entero
 * - Teclado virtual: se ajusta automáticamente en iOS y Android
 * - Modo cristal: blur cuando está activo
 *
 * Se usa en: acciones rápidas, filtros, selectores, menús en mobile.
 * Para desktop usar Modal.tsx.
 */

import { useEffect, useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { useTema } from '@/hooks/useTema'
import { useScrollLockiOS } from '@/hooks/useScrollLockiOS'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { FooterAccionesModal, type AccionModal } from '@/componentes/ui/_modal/AccionesModal'

/* ─── Tipos ─── */

type AlturaSheet = 'auto' | 'medio' | 'alto' | 'completo'

interface PropiedadesBottomSheet {
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  children: ReactNode
  /** Escape hatch — JSX custom para el footer. Ignorado si se usa algún prop estructurado. */
  acciones?: ReactNode
  /** Acción principal (derecha): Guardar, Crear, Confirmar. */
  accionPrimaria?: AccionModal
  /** Acción secundaria (derecha, pegada a primaria): Cancelar. */
  accionSecundaria?: AccionModal
  /** Acción destructiva (izquierda): Eliminar, Descartar. */
  accionPeligro?: AccionModal
  /** Slot libre a la izquierda del footer (ej: selector de presets) */
  footerExtraIzquierda?: ReactNode
  /** Altura del sheet. Mínimo siempre 75vh. Default: 'auto' (se adapta al contenido, mín 75vh) */
  altura?: AlturaSheet
  /** Quita el padding del contenido para layouts personalizados */
  sinPadding?: boolean
  /** Fondo personalizado del panel (sobreescribe superficie-elevada) */
  fondo?: string
}

/* ─── Alturas como % del viewport ─── */

const ALTURAS_VP: Record<AlturaSheet, string> = {
  auto: 'min(max(75dvh, auto), 92dvh)',
  medio: '75dvh',
  alto: '85dvh',
  completo: '92dvh',
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
  accionPrimaria,
  accionSecundaria,
  accionPeligro,
  footerExtraIzquierda,
  altura = 'auto',
  sinPadding = false,
  fondo,
}: PropiedadesBottomSheet) {
  const tieneAccionesEstructuradas = !!(accionPrimaria || accionSecundaria || accionPeligro || footerExtraIzquierda)
  const footer = tieneAccionesEstructuradas
    ? <FooterAccionesModal primaria={accionPrimaria} secundaria={accionSecundaria} peligro={accionPeligro} extraIzquierda={footerExtraIzquierda} />
    : acciones
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const panelRef = useRef<HTMLDivElement>(null)

  // iOS: position:fixed en body para evitar scroll detrás del sheet
  useScrollLockiOS(abierto)
  const { tecladoAbierto, alturaVisible } = useVisualViewport()
  const contenidoRef = useRef<HTMLDivElement>(null)
  const y = useMotionValue(0)
  const overlayOpacity = useTransform(y, [0, 300], [1, 0.15])

  /* ── Detectar si el contenido está scrolleado arriba (para permitir drag) ── */
  const [puedeArrastrar, setPuedeArrastrar] = useState(true)

  const manejarScrollContenido = useCallback(() => {
    if (contenidoRef.current) {
      setPuedeArrastrar(contenidoRef.current.scrollTop <= 0)
    }
  }, [])

  /* ── Reset drag al abrir ── */
  useEffect(() => {
    if (abierto) {
      y.set(0)
      setPuedeArrastrar(true)
    }
  }, [abierto, y])

  /* ── Escape para cerrar + focus trap ── */
  const manejarTecla = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onCerrar(); return }

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

  // Ref que siempre apunta al manejarTecla actualizado, para que el listener
  // del `keydown` no tenga que re-suscribirse (y re-ejecutar el auto-focus)
  // cada vez que `onCerrar` recibe una nueva referencia desde el padre.
  // Sin este ref, en PWA móvil perdías el foco del textarea mientras escribías
  // porque cada re-render del padre disparaba focus() al primer botón.
  const manejarTeclaRef = useRef(manejarTecla)
  manejarTeclaRef.current = manejarTecla

  useEffect(() => {
    if (!abierto) return
    const handler = (e: KeyboardEvent) => manejarTeclaRef.current(e)
    document.addEventListener('keydown', handler)
    // Auto-focus al primer elemento — solo una vez al abrir el sheet.
    requestAnimationFrame(() => {
      const primero = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      primero?.focus()
    })
    return () => document.removeEventListener('keydown', handler)
  }, [abierto])

  /* ── Ajustar cuando aparece el teclado virtual (via useVisualViewport) ── */
  useEffect(() => {
    if (!abierto || !panelRef.current) return
    if (tecladoAbierto) {
      panelRef.current.style.maxHeight = `${alturaVisible - 20}px`
      panelRef.current.style.transition = 'max-height 0.25s ease'
    } else {
      panelRef.current.style.maxHeight = ''
      panelRef.current.style.transition = ''
    }
  }, [abierto, tecladoAbierto, alturaVisible])

  /* ── Swipe-to-dismiss — solo si el scroll del contenido está arriba ── */
  const manejarDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (!puedeArrastrar) return

    const { offset, velocity } = info

    if (offset.y > UMBRAL_CIERRE || velocity.y > VELOCIDAD_CIERRE) {
      onCerrar()
    }
  }, [onCerrar, puedeArrastrar])

  if (typeof window === 'undefined') return null

  /* ── Estilos del panel según cristal/sólido ── */
  const colorFondo = fondo || (esCristal ? 'var(--superficie-flotante, var(--superficie-elevada))' : 'var(--superficie-elevada)')
  const estiloPanel = esCristal && !fondo ? {
    y,
    backgroundColor: colorFondo,
    backdropFilter: 'blur(32px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
  } : {
    y,
    backgroundColor: colorFondo,
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
              drag={puedeArrastrar ? 'y' : false}
              dragElastic={0}
              dragMomentum={false}
              onDragEnd={manejarDragEnd}
              style={estiloPanel}
              role="dialog"
              aria-modal="true"
              aria-label={titulo || 'Panel'}
              className={[
                'w-full rounded-t-modal flex flex-col pointer-events-auto',
                'border border-b-0 border-borde-sutil shadow-elevada',
                'overflow-hidden',
              ].join(' ')}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Drag handle — zona de agarre ── */}
              <div
                className="flex justify-center pb-1 shrink-0 cursor-grab active:cursor-grabbing select-none"
                style={{
                  paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0.625rem))',
                  touchAction: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
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
                ref={contenidoRef}
                onScroll={manejarScrollContenido}
                className={[
                  'flex-1 overflow-y-auto overscroll-contain min-h-0',
                  sinPadding ? '' : 'px-5 py-4',
                ].join(' ')}
                style={{ maxHeight: ALTURAS_VP[altura] }}
              >
                {children}
              </div>

              {/* ── Acciones — alejadas de la home bar de iOS ── */}
              {footer && (
                <div
                  className={`flex items-center ${tieneAccionesEstructuradas ? '' : 'gap-3'} px-5 pt-3 border-t border-borde-sutil shrink-0`}
                  style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
                >
                  {footer}
                </div>
              )}

              {/* ── Safe area inferior cuando no hay acciones ── */}
              {!footer && (
                <div
                  className="shrink-0"
                  style={{ height: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
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

'use client'

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Info, X } from 'lucide-react'

/**
 * InfoBoton — Botón "ⓘ" pequeño que abre un panel explicativo del widget.
 *
 * Diseñado para acompañar el título de un widget del dashboard, mostrando una
 * guía detallada de "qué muestra" y "cómo leerlo", con jerarquía visual:
 * secciones tituladas + texto descriptivo.
 *
 * Comportamiento adaptativo:
 *  - Desktop (mouse): hover sobre el ícono abre el panel anclado al trigger,
 *    delay para cruzar al panel y poder hacer scroll dentro.
 *  - Mobile (touch): tap abre un bottom-sheet modal con backdrop y botón ✕.
 */

type Posicion = 'arriba' | 'abajo'

interface SeccionInfo {
  /** Título corto en uppercase (ej: "Qué muestra", "Cómo se calcula") */
  titulo: string
  /** Contenido — texto plano o JSX */
  contenido: ReactNode
}

interface PropiedadesInfoBoton {
  /** Título principal del panel (default: "Cómo leer este widget") */
  titulo?: string
  /** Lista de secciones con jerarquía visual */
  secciones: SeccionInfo[]
  /** Posición preferida del panel respecto del botón (solo desktop) */
  posicion?: Posicion
  /** Tamaño del icono en px (default: 14) */
  tamano?: number
  /** Delay antes de mostrar al hover, en ms (default: 200) */
  delay?: number
  /** Clase adicional para el botón disparador */
  className?: string
}

const OFFSET = 8

function InfoBoton({
  titulo = 'Cómo leer este widget',
  secciones,
  posicion = 'abajo',
  tamano = 14,
  delay = 200,
  className = '',
}: PropiedadesInfoBoton) {
  const [visible, setVisible] = useState(false)
  const [esMobile, setEsMobile] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [posicionFinal, setPosicionFinal] = useState<Posicion>(posicion)
  const refTrigger = useRef<HTMLButtonElement>(null)
  const refPanel = useRef<HTMLDivElement>(null)
  const refTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const refDentroPanel = useRef(false)

  // Detectar mobile (touch primario o ancho ≤ 640px)
  useEffect(() => {
    const check = () => {
      const esTactil = window.matchMedia('(pointer: coarse)').matches
      const esAnchoChico = window.matchMedia('(max-width: 640px)').matches
      setEsMobile(esTactil || esAnchoChico)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Calcula posición evitando salirse del viewport (solo desktop).
  // Estrategia:
  //  1. Vertical: elige arriba o abajo según dónde haya más espacio
  //  2. Horizontal: prueba 3 alineaciones (derecha del trigger / centrada /
  //     izquierda del trigger) y usa la primera que entra completa.
  //  3. Si nada entra, hace clamp al viewport con 8px de margen.
  const calcularPosicion = useCallback(() => {
    if (esMobile || !refTrigger.current || !refPanel.current) return

    const rect = refTrigger.current.getBoundingClientRect()
    const panel = refPanel.current.getBoundingClientRect()
    const margen = 8
    const w = panel.width
    const h = panel.height
    const vw = window.innerWidth
    const vh = window.innerHeight

    // ── Vertical ──
    const espacioAbajo = vh - rect.bottom - margen
    const espacioArriba = rect.top - margen
    const cabeAbajo = espacioAbajo >= h
    const cabeArriba = espacioArriba >= h
    let pos: Posicion
    if (posicion === 'abajo') {
      pos = cabeAbajo || espacioAbajo >= espacioArriba ? 'abajo' : 'arriba'
    } else {
      pos = cabeArriba || espacioArriba >= espacioAbajo ? 'arriba' : 'abajo'
    }
    let top = pos === 'abajo' ? rect.bottom + OFFSET : rect.top - h - OFFSET
    top = Math.max(margen, Math.min(top, vh - h - margen))

    // ── Horizontal: probar alineaciones en orden ──
    const triggerCentro = rect.left + rect.width / 2
    const enMitadIzquierda = triggerCentro < vw / 2
    // Si el trigger está en la mitad izquierda, preferimos alinear el panel
    // a la izquierda del trigger; si está a la derecha, alineado a la derecha.
    const opciones = enMitadIzquierda
      ? [rect.left, triggerCentro - w / 2, rect.right - w]
      : [rect.right - w, triggerCentro - w / 2, rect.left]

    let left = opciones.find(
      (l) => l >= margen && l + w <= vw - margen,
    )
    if (left === undefined) {
      // Ninguna opción entra completa: usar la primera y clamp
      left = opciones[0]
    }
    left = Math.max(margen, Math.min(left, vw - w - margen))

    setPosicionFinal(pos)
    setCoords({ top, left })
  }, [posicion, esMobile])

  const mostrar = useCallback(() => {
    // En mobile no se usa hover
    if (esMobile) return
    clearTimeout(refTimer.current)
    refTimer.current = setTimeout(() => setVisible(true), delay)
  }, [delay, esMobile])

  const ocultar = useCallback(() => {
    if (esMobile) return
    clearTimeout(refTimer.current)
    refTimer.current = undefined
    // Delay para permitir cruzar al panel y scrollear sin que se desvanezca
    setTimeout(() => {
      if (!refDentroPanel.current) setVisible(false)
    }, 250)
  }, [esMobile])

  const toggleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setVisible((v) => !v)
  }, [])

  const cerrarManual = useCallback(() => {
    setVisible(false)
  }, [])

  useEffect(() => {
    if (visible && !esMobile) calcularPosicion()
  }, [visible, esMobile, calcularPosicion])

  // Bloquear scroll del body cuando el modal está abierto en mobile
  useEffect(() => {
    if (!visible || !esMobile) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [visible, esMobile])

  // Cerrar al click fuera (desktop) y al scroll fuera del panel
  useEffect(() => {
    if (!visible || esMobile) return
    const esDentroDelPanel = (target: EventTarget | null): boolean => {
      if (!target || !refPanel.current) return false
      return refPanel.current.contains(target as Node)
    }
    const cerrarSiAfuera = (e: Event) => {
      if (esDentroDelPanel(e.target)) return
      if (e.type === 'pointerdown' && refTrigger.current?.contains(e.target as Node)) return
      clearTimeout(refTimer.current)
      setVisible(false)
    }
    const cerrarSiempre = () => {
      clearTimeout(refTimer.current)
      setVisible(false)
    }
    window.addEventListener('scroll', cerrarSiAfuera, true)
    window.addEventListener('pointerdown', cerrarSiAfuera)
    window.addEventListener('resize', cerrarSiempre)
    return () => {
      window.removeEventListener('scroll', cerrarSiAfuera, true)
      window.removeEventListener('pointerdown', cerrarSiAfuera)
      window.removeEventListener('resize', cerrarSiempre)
    }
  }, [visible, esMobile])

  // Cerrar con Escape
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  useEffect(() => () => clearTimeout(refTimer.current), [])

  const animacionInicial = posicionFinal === 'arriba' ? { opacity: 0, y: 4 } : { opacity: 0, y: -4 }

  return (
    <>
      <button
        ref={refTrigger}
        type="button"
        aria-label={titulo}
        onMouseEnter={mostrar}
        onMouseLeave={ocultar}
        onClick={toggleClick}
        // Padding invisible para que el tap target sea cómodo en mobile
        // (el ícono es chico pero el área clickeable no debería serlo)
        className={`inline-flex items-center justify-center text-texto-terciario/60 hover:text-texto-secundario transition-colors cursor-help shrink-0 -m-1.5 p-1.5 ${className}`}
      >
        <Info size={tamano} strokeWidth={1.75} />
      </button>

      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {visible && (
            esMobile ? (
              // ─── Mobile: bottom-sheet con backdrop ───
              <>
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                  style={{ zIndex: 'var(--z-popover)' as unknown as number }}
                  onClick={cerrarManual}
                />
                <motion.div
                  key="sheet"
                  ref={refPanel}
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="fixed left-0 right-0 bottom-0 max-h-[85vh] flex flex-col rounded-t-2xl border-t border-borde-sutil bg-superficie-elevada shadow-2xl"
                  style={{
                    zIndex: 'var(--z-popover)' as unknown as number,
                    paddingBottom: 'env(safe-area-inset-bottom)',
                  }}
                >
                  {/* Handle visual del bottom sheet */}
                  <div className="flex justify-center pt-2 pb-1 shrink-0">
                    <span className="size-1 w-10 h-1 rounded-full bg-texto-terciario/30" />
                  </div>
                  {/* Encabezado con título + X */}
                  <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-borde-sutil/60 shrink-0">
                    <p className="text-base font-semibold text-texto-primario">{titulo}</p>
                    <button
                      type="button"
                      onClick={cerrarManual}
                      aria-label="Cerrar"
                      className="size-8 rounded-full flex items-center justify-center text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover/60 transition-colors"
                    >
                      <X size={18} strokeWidth={1.75} />
                    </button>
                  </div>
                  {/* Contenido scrolleable */}
                  <div className="px-5 py-4 space-y-5 overflow-y-auto">
                    {secciones.map((s, i) => (
                      <div key={i}>
                        <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium mb-1.5">
                          {s.titulo}
                        </p>
                        <div className="text-sm text-texto-secundario leading-relaxed">
                          {s.contenido}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            ) : (
              // ─── Desktop: popover anclado al trigger ───
              <motion.div
                key="popover"
                ref={refPanel}
                initial={animacionInicial}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onMouseEnter={() => { refDentroPanel.current = true }}
                onMouseLeave={() => { refDentroPanel.current = false; ocultar() }}
                className="fixed w-[720px] max-w-[calc(100vw-16px)] rounded-card border border-borde-sutil bg-superficie-elevada shadow-lg backdrop-blur-md overflow-hidden"
                style={{
                  top: coords.top,
                  left: coords.left,
                  zIndex: 'var(--z-popover)' as unknown as number,
                }}
              >
                <div className="px-5 py-3 border-b border-borde-sutil/60">
                  <p className="text-sm font-semibold text-texto-primario">{titulo}</p>
                </div>
                <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  {secciones.map((s, i) => (
                    <div key={i}>
                      <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium mb-1.5">
                        {s.titulo}
                      </p>
                      <div className="text-xs text-texto-secundario leading-relaxed">
                        {s.contenido}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export { InfoBoton }
export type { PropiedadesInfoBoton, SeccionInfo }

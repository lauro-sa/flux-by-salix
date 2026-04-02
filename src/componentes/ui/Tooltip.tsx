'use client'

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Tooltip — Texto flotante ligero al hacer hover sobre un elemento.
 * Más simple y liviano que Popover (solo texto, sin interactividad interna).
 * Calcula posición automática para no salir del viewport.
 * Se usa en: botones de iconos, badges, elementos sin texto visible.
 */

type PosicionTooltip = 'arriba' | 'abajo' | 'izquierda' | 'derecha'

interface PropiedadesTooltip {
  /** Elemento que activa el tooltip al hover */
  children: ReactNode
  /** Texto del tooltip */
  contenido: string
  /** Posición preferida (se ajusta si no cabe) */
  posicion?: PosicionTooltip
  /** Delay antes de mostrar en ms */
  delay?: number
  /** Deshabilitado */
  deshabilitado?: boolean
}

const OFFSET = 8

function Tooltip({
  children,
  contenido,
  posicion = 'arriba',
  delay = 1200,
  deshabilitado = false,
}: PropiedadesTooltip) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [posicionFinal, setPosicionFinal] = useState(posicion)
  const refTrigger = useRef<HTMLSpanElement>(null)
  const refTooltip = useRef<HTMLDivElement>(null)
  const refTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const calcularPosicion = useCallback(() => {
    if (!refTrigger.current || !refTooltip.current) return

    const rect = refTrigger.current.getBoundingClientRect()
    const tt = refTooltip.current.getBoundingClientRect()
    let pos = posicion
    let top = 0
    let left = 0

    // Calcular según posición preferida
    const calcular = (p: PosicionTooltip) => {
      switch (p) {
        case 'arriba':
          top = rect.top - tt.height - OFFSET
          left = rect.left + rect.width / 2 - tt.width / 2
          break
        case 'abajo':
          top = rect.bottom + OFFSET
          left = rect.left + rect.width / 2 - tt.width / 2
          break
        case 'izquierda':
          top = rect.top + rect.height / 2 - tt.height / 2
          left = rect.left - tt.width - OFFSET
          break
        case 'derecha':
          top = rect.top + rect.height / 2 - tt.height / 2
          left = rect.right + OFFSET
          break
      }
    }

    calcular(pos)

    // Flipear si no cabe
    if (top < 4 && pos === 'arriba') { pos = 'abajo'; calcular(pos) }
    if (top + tt.height > window.innerHeight - 4 && pos === 'abajo') { pos = 'arriba'; calcular(pos) }
    if (left < 4 && pos === 'izquierda') { pos = 'derecha'; calcular(pos) }
    if (left + tt.width > window.innerWidth - 4 && pos === 'derecha') { pos = 'izquierda'; calcular(pos) }

    // Clamp para no salir de pantalla
    left = Math.max(4, Math.min(left, window.innerWidth - tt.width - 4))
    top = Math.max(4, Math.min(top, window.innerHeight - tt.height - 4))

    setPosicionFinal(pos)
    setCoords({ top, left })
  }, [posicion])

  const mostrar = useCallback(() => {
    if (deshabilitado) return
    refTimer.current = setTimeout(() => setVisible(true), delay)
  }, [delay, deshabilitado])

  const ocultar = useCallback(() => {
    clearTimeout(refTimer.current)
    setVisible(false)
  }, [])

  useEffect(() => {
    if (visible) calcularPosicion()
  }, [visible, calcularPosicion])

  useEffect(() => () => clearTimeout(refTimer.current), [])

  if (!contenido) return <>{children}</>

  const animacionInicial = posicionFinal === 'arriba' ? { opacity: 0, y: 4 }
    : posicionFinal === 'abajo' ? { opacity: 0, y: -4 }
    : posicionFinal === 'izquierda' ? { opacity: 0, x: 4 }
    : { opacity: 0, x: -4 }

  return (
    <>
      <span
        ref={refTrigger}
        onMouseEnter={mostrar}
        onMouseLeave={ocultar}
        onFocus={mostrar}
        onBlur={ocultar}
        className="inline-flex"
      >
        {children}
      </span>
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {visible && (
            <motion.div
              ref={refTooltip}
              initial={animacionInicial}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[9999] pointer-events-none px-2.5 py-1.5 rounded-lg text-xs font-medium max-w-64 text-center shadow-md"
              style={{
                top: coords.top,
                left: coords.left,
                backgroundColor: 'var(--texto-primario)',
                color: 'var(--superficie-app)',
              }}
            >
              {contenido.includes('\n')
              ? contenido.split('\n').map((linea, i) => (
                <span key={i} className="block">{linea}</span>
              ))
              : contenido}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export { Tooltip }
export type { PropiedadesTooltip }

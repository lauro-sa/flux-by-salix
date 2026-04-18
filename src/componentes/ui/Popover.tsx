'use client'

import {
  useState, useRef, useEffect, useCallback,
  type ReactNode, type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTema } from '@/hooks/useTema'

/**
 * Popover — Panel flotante anclado a un trigger, estilo Linear/Attio.
 * Genérico y reutilizable: se le pasa el trigger (children) y el contenido.
 * Calcula posición automáticamente para no salir del viewport.
 * Si no cabe abajo, abre hacia arriba. Soporta modo cristal.
 * Se usa en: Header (notificaciones), RecordatoriosHeader, y cualquier panel flotante.
 */

type Alineacion = 'inicio' | 'centro' | 'fin'
type Lado = 'abajo' | 'arriba'

interface PropiedadesPopover {
  /** Elemento que abre/cierra el popover (botón, ícono, etc.) */
  children: ReactNode
  /** Contenido del panel flotante */
  contenido: ReactNode
  /** Abierto controlado externamente */
  abierto?: boolean
  /** Callback al cambiar estado abierto/cerrado */
  onCambio?: (abierto: boolean) => void
  /** Alineación horizontal respecto al trigger */
  alineacion?: Alineacion
  /** Lado preferido para abrir */
  lado?: Lado
  /** Ancho del panel en px o string CSS */
  ancho?: number | string
  /** Alto máximo del panel */
  altoMaximo?: number | string
  /** Offset vertical adicional en px */
  offset?: number
  /** Clase CSS adicional para el panel */
  clasePan?: string
  /** Deshabilitar cierre al click fuera */
  sinCerrarClickFuera?: boolean
  /** Clase CSS para el wrapper del trigger (default: inline-flex) */
  claseTrigger?: string
}

function Popover({
  children,
  contenido,
  abierto: abiertoExterno,
  onCambio,
  alineacion = 'fin',
  lado = 'abajo',
  ancho = 380,
  altoMaximo = '80dvh',
  offset = 8,
  clasePan = '',
  claseTrigger,
  sinCerrarClickFuera = false,
}: PropiedadesPopover) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'

  /* Estado interno o controlado */
  const [abiertoInterno, setAbiertoInterno] = useState(false)
  const esControlado = abiertoExterno !== undefined
  const abierto = esControlado ? abiertoExterno : abiertoInterno

  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [posicion, setPosicion] = useState<CSSProperties>({})
  const [abreArriba, setAbreArriba] = useState(false)
  const [montado, setMontado] = useState(false)

  useEffect(() => { setMontado(true) }, [])

  const cambiar = useCallback((valor: boolean) => {
    if (!esControlado) setAbiertoInterno(valor)
    onCambio?.(valor)
  }, [esControlado, onCambio])

  const toggle = useCallback(() => cambiar(!abierto), [abierto, cambiar])
  const cerrar = useCallback(() => cambiar(false), [cambiar])

  /* Calcular posición al abrir */
  useEffect(() => {
    if (!abierto || !triggerRef.current) return

    const calcular = () => {
      const rect = triggerRef.current!.getBoundingClientRect()
      const anchoRaw = typeof ancho === 'number' ? ancho : 380
      const margen = 12
      const anchoNum = Math.min(anchoRaw, window.innerWidth - margen * 2)

      /* Alto real del panel (si ya está renderizado) o estimación */
      const altoPanel = panelRef.current?.scrollHeight || 300

      /* Espacio disponible arriba y abajo del trigger */
      const espacioAbajo = window.innerHeight - rect.bottom - offset - margen
      const espacioArriba = rect.top - offset - margen

      /* Decidir dirección: preferencia del prop, pero voltea si no cabe */
      const debeAbrirArriba = lado === 'arriba'
        || (lado === 'abajo' && espacioAbajo < Math.min(altoPanel, 250) && espacioArriba > espacioAbajo)

      setAbreArriba(debeAbrirArriba)

      /* Posición horizontal */
      let left: number
      if (alineacion === 'fin') {
        left = rect.right - anchoNum
        if (left < margen) left = margen
      } else if (alineacion === 'inicio') {
        left = rect.left
        if (left + anchoNum > window.innerWidth - margen) {
          left = window.innerWidth - margen - anchoNum
        }
      } else {
        left = rect.left + rect.width / 2 - anchoNum / 2
        if (left < margen) left = margen
        if (left + anchoNum > window.innerWidth - margen) {
          left = window.innerWidth - margen - anchoNum
        }
      }

      /* Calcular maxHeight numérico */
      const espacioDisponible = debeAbrirArriba ? espacioArriba : espacioAbajo
      const altoMaxNum = typeof altoMaximo === 'number' ? altoMaximo : parseFloat(altoMaximo) || 9999
      const maxH = typeof altoMaximo === 'string' && altoMaximo.includes('vh')
        ? Math.min(window.innerHeight * parseFloat(altoMaximo) / 100, espacioDisponible)
        : Math.min(altoMaxNum, espacioDisponible)

      setPosicion({
        position: 'fixed',
        ...(debeAbrirArriba
          ? { bottom: window.innerHeight - rect.top + offset }
          : { top: rect.bottom + offset }
        ),
        left,
        width: typeof ancho === 'number' ? ancho : ancho,
        maxHeight: maxH,
        zIndex: 'var(--z-popover)' as unknown as number,
      })
    }

    calcular()
    /* Re-medir tras render para capturar alto real del panel */
    const rafId = requestAnimationFrame(calcular)
    window.addEventListener('resize', calcular)
    window.addEventListener('scroll', calcular, true)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', calcular)
      window.removeEventListener('scroll', calcular, true)
    }
  }, [abierto, alineacion, lado, ancho, altoMaximo, offset])

  /* Cerrar con click fuera — ignora clicks en portales flotantes (Select, SelectorFecha, etc.) */
  useEffect(() => {
    if (!abierto || sinCerrarClickFuera) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) return

      /* Ignorar clicks en portales flotantes (dropdowns, calendarios, etc.)
         Solo ignoramos elementos con z-index muy alto (portales renderizados en body) */
      let el = target as HTMLElement | null
      while (el) {
        const zRaw = window.getComputedStyle(el).zIndex
        const zIndex = parseInt(zRaw || '0', 10)
        if (zIndex >= 9000 && el !== panelRef.current) return
        el = el.parentElement
      }

      cerrar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto, cerrar, sinCerrarClickFuera])

  /* Cerrar con Escape */
  useEffect(() => {
    if (!abierto) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [abierto, cerrar])

  const estiloPanel: CSSProperties = esCristal ? {
    backgroundColor: 'var(--superficie-flotante)',
    backdropFilter: 'blur(32px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
  } : {
    backgroundColor: 'var(--superficie-elevada)',
  }

  const animacion = {
    initial: { opacity: 0, y: abreArriba ? 6 : -6, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: abreArriba ? 6 : -6, scale: 0.97 },
    transition: { duration: 0.15, ease: 'easeOut' as const },
  }

  return (
    <>
      {/* Trigger */}
      <div ref={triggerRef} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }} role="button" tabIndex={0} className={claseTrigger || 'inline-flex'}>
        {children}
      </div>

      {/* Panel flotante (portal) */}
      {montado && createPortal(
        <AnimatePresence>
          {abierto && (
            <motion.div
              ref={panelRef}
              {...animacion}
              className={`border border-borde-sutil rounded-popover shadow-elevada overflow-y-auto overflow-x-hidden flex flex-col ${clasePan}`}
              style={{ ...posicion, ...estiloPanel }}
            >
              {contenido}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export { Popover }
export type { PropiedadesPopover, Alineacion, Lado }

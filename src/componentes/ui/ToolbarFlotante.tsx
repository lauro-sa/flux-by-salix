'use client'

import { useRef, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useTema } from '@/hooks/useTema'

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Acción individual que se muestra en el toolbar flotante */
interface AccionToolbar {
  /** Identificador único de la acción */
  id: string
  /** Ícono como ReactNode (lucide-react o cualquier JSX) */
  icono: ReactNode
  /** Tooltip / título accesible */
  etiqueta: string
  /** Callback al hacer clic */
  onClick: () => void
  /** Si está activo (ej: negrita activa en la selección) */
  activo?: boolean
  /** Deshabilitar esta acción */
  deshabilitado?: boolean
}

/** Grupo de acciones separadas visualmente por un divisor */
interface GrupoAcciones {
  /** Identificador del grupo */
  id: string
  /** Acciones dentro del grupo */
  acciones: AccionToolbar[]
}

interface PropiedadesToolbarFlotante {
  /** Si es true, el toolbar se muestra */
  visible: boolean
  /** Contenido del toolbar — grupos de acciones con separadores */
  grupos: GrupoAcciones[]
  /** Callback cuando se cierra el toolbar (Escape) */
  onCerrar?: () => void
  /** Contenido expandido debajo del toolbar (ej: selector de color, panel de IA) */
  panelExpandido?: ReactNode
  /** Título del panel expandido */
  tituloPanelExpandido?: string
  /** Cerrar el panel expandido */
  onCerrarPanel?: () => void
  /** Elemento de referencia para posicionar el toolbar (BubbleMenu pasa esto) */
  referencia?: HTMLElement | null
  /** Posición fija manual (alternativa a referencia) */
  posicion?: { top: number; left: number }
}

// ── Componente ───────────────────────────────────────────────────────────────

/**
 * ToolbarFlotante — Barra de herramientas flotante para formateo de texto.
 *
 * Se renderiza via portal con posición fixed. Diseñado para usarse con
 * el EditorTexto (TipTap BubbleMenu) pero también funciona standalone.
 *
 * Muestra grupos de acciones separados por divisores verticales.
 * Cada acción puede tener estado activo (ej: negrita activada).
 * Soporta un panel expandido para selectores complejos (color, links, etc.).
 *
 * Desktop: toolbar + dropdown panel debajo.
 * Mobile (< 640px): toolbar + bottom sheet para panel expandido.
 */
function ToolbarFlotante({
  visible,
  grupos,
  onCerrar,
  panelExpandido,
  tituloPanelExpandido,
  onCerrarPanel,
  referencia,
  posicion: posicionManual,
}: PropiedadesToolbarFlotante) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const toolbarRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [esMobile, setEsMobile] = useState(false)
  const [posCalculada, setPosCalculada] = useState<{ top: number; left: number } | null>(null)

  // Detectar mobile
  useEffect(() => {
    const verificar = () => setEsMobile(window.innerWidth < 640)
    verificar()
    window.addEventListener('resize', verificar, { passive: true })
    return () => window.removeEventListener('resize', verificar)
  }, [])

  // Calcular posición desde el elemento de referencia
  useEffect(() => {
    if (posicionManual) {
      setPosCalculada(posicionManual)
      return
    }
    if (!referencia || !visible) return
    const rect = referencia.getBoundingClientRect()
    const margen = 8
    // Arriba del elemento, centrado
    const top = Math.max(margen, rect.top - 44)
    const left = Math.max(margen, Math.min(
      rect.left + rect.width / 2 - 150,
      window.innerWidth - 320
    ))
    setPosCalculada({ top, left })
  }, [referencia, visible, posicionManual])

  // Cerrar con Escape
  useEffect(() => {
    if (!visible) return
    const manejar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (panelExpandido && onCerrarPanel) onCerrarPanel()
        else onCerrar?.()
      }
    }
    document.addEventListener('keydown', manejar)
    return () => document.removeEventListener('keydown', manejar)
  }, [visible, panelExpandido, onCerrar, onCerrarPanel])

  // Cerrar panel al clic fuera (desktop)
  useEffect(() => {
    if (!panelExpandido || esMobile) return
    const manejar = (e: MouseEvent) => {
      const dentroToolbar = toolbarRef.current?.contains(e.target as Node)
      const dentroPanel = panelRef.current?.contains(e.target as Node)
      if (!dentroToolbar && !dentroPanel) onCerrarPanel?.()
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', manejar), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', manejar)
    }
  }, [panelExpandido, esMobile, onCerrarPanel])

  if (typeof window === 'undefined' || !posCalculada) return null

  // ── Estilos de superficie ────────────────────────────────────────────────

  const estiloSuperficie = esCristal
    ? {
        backgroundColor: 'var(--superficie-flotante)',
        backdropFilter: 'blur(32px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
      }
    : { backgroundColor: 'var(--superficie-elevada)' }

  // ── Botón de acción ──────────────────────────────────────────────────────

  const renderBoton = (accion: AccionToolbar) => (
    <button
      key={accion.id}
      type="button"
      disabled={accion.deshabilitado}
      onClick={accion.onClick}
      onMouseDown={(e) => e.preventDefault()}
      className={[
        'flex items-center justify-center size-8 rounded-md transition-all duration-100 cursor-pointer',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        'active:scale-90',
        accion.activo
          ? 'bg-texto-marca/15 text-texto-marca'
          : 'text-texto-secundario hover:text-texto-primario hover:bg-superficie-hover',
      ].join(' ')}
      title={accion.etiqueta}
    >
      {accion.icono}
    </button>
  )

  // ── Separador vertical ───────────────────────────────────────────────────

  const separador = <div className="w-px h-5 bg-borde-sutil mx-0.5 shrink-0" />

  // ── Toolbar ──────────────────────────────────────────────────────────────

  const toolbar = (
    <motion.div
      ref={toolbarRef}
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className="fixed z-[9999] flex items-center gap-0.5 px-1.5 py-1 rounded-lg shadow-elevada border border-borde-sutil"
      style={{ top: posCalculada.top, left: posCalculada.left, ...estiloSuperficie }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {grupos.map((grupo, i) => (
        <div key={grupo.id} className="flex items-center gap-0.5">
          {i > 0 && separador}
          {grupo.acciones.map(renderBoton)}
        </div>
      ))}
    </motion.div>
  )

  // ── Panel expandido desktop ──────────────────────────────────────────────

  const panelDesktop = panelExpandido && !esMobile && (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className="fixed z-[9998] w-[320px] max-h-[360px] rounded-lg shadow-elevada border border-borde-sutil flex flex-col overflow-hidden"
      style={{
        top: posCalculada.top + 48,
        left: Math.max(12, Math.min(posCalculada.left, window.innerWidth - 332)),
        ...estiloSuperficie,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {tituloPanelExpandido && (
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-borde-sutil shrink-0">
          <span className="text-xs font-semibold text-texto-primario">{tituloPanelExpandido}</span>
          {onCerrarPanel && (
            <button
              type="button"
              onClick={onCerrarPanel}
              className="flex items-center justify-center size-6 rounded-md text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0">{panelExpandido}</div>
    </motion.div>
  )

  // ── Panel expandido mobile (bottom sheet) ────────────────────────────────

  const panelMobile = panelExpandido && esMobile && (
    <div className="fixed inset-0 z-[9998] flex items-end" role="dialog">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ backgroundColor: esCristal ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)' }}
        onClick={onCerrarPanel}
      />
      <motion.div
        ref={panelRef}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full max-h-[85dvh] flex flex-col rounded-t-xl border border-borde-sutil overflow-hidden"
        style={estiloSuperficie}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-borde-fuerte" />
        </div>
        {tituloPanelExpandido && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-borde-sutil shrink-0">
            <span className="text-sm font-semibold text-texto-primario">{tituloPanelExpandido}</span>
            {onCerrarPanel && (
              <button type="button" onClick={onCerrarPanel} className="flex items-center justify-center size-8 rounded-md text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">{panelExpandido}</div>
      </motion.div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return createPortal(
    <AnimatePresence>
      {visible && (
        <>
          {toolbar}
          {panelDesktop}
          {panelMobile}
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

export {
  ToolbarFlotante,
  type PropiedadesToolbarFlotante,
  type AccionToolbar,
  type GrupoAcciones,
}

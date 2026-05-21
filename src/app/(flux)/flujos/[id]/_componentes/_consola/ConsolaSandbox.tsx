'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { BottomSheet } from '@/componentes/ui/BottomSheet'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import VistaPreviaEstatica from './VistaPreviaEstatica'
import TimelineDryRun from './TimelineDryRun'
import { useDryRun } from './hooks/useDryRun'
import type { TabConsola } from './tipos'

/**
 * Panel inferior tipo consola del editor de flujos (sub-PR 19.5).
 *
 * Decisiones del scope plan:
 *   • D4: altura fija 40dvh en desktop (sin resize). Persistencia
 *         abierta/cerrada en localStorage (manejado por useConsolaSandbox
 *         del padre, NO acá).
 *   • D5: en mobile renderizamos como `BottomSheet` altura "alto" (85dvh)
 *         reusando el componente UI existente.
 *
 * El componente NO controla su propia visibilidad — recibe `abierta` por
 * prop. El padre (EditorFlujo) decide cuándo renderizarlo.
 *
 * Tabs:
 *   • "Vista previa" → resuelve variables sin ejecutar (sub-PR 19.5 D3=A).
 *   • "Dry-run"      → corre el endpoint `/probar` con flag dry_run.
 *
 * El contexto del preview lo provee el padre (mismo que usa el
 * PickerVariables — `usePreviewContexto` del 19.3b). Cuando el dry-run
 * termina, su `respuesta.contexto_usado` es la fuente de verdad para
 * el lado server (puede diferir del cliente si el server enriquece más).
 */

export interface PropsConsolaSandbox {
  abierta: boolean
  flujoId: string
  /** Acciones a previsualizar (la versión EDITABLE del flujo). */
  acciones: unknown[]
  /** Contexto enriquecido para resolver variables (del PickerVariables). */
  contexto: ContextoVariables
  /** Tab actual + handler de cambio (estado en el padre). */
  tab: TabConsola
  onCambiarTab: (t: TabConsola) => void
  onCerrar: () => void
  /** Flush del autoguardado pendiente (decisión D8: forzar antes de correr). */
  flush?: () => Promise<void> | void
  /** Resumen del evento de prueba para el chip. null si cron/webhook. */
  eventoSimulado?: {
    tipo_entidad: string | null
    resumen: string
  } | null
  /**
   * En mobile (≤ md) el padre puede preferir renderizar como BottomSheet.
   * Cuando `enMobile=true`, se monta `BottomSheet`; si no, panel inferior
   * sticky 40dvh. El padre decide via media query / hook.
   */
  enMobile?: boolean
}

export default function ConsolaSandbox(props: PropsConsolaSandbox) {
  if (props.enMobile) return <ConsolaMobile {...props} />
  return <ConsolaDesktop {...props} />
}

// =============================================================
// Variante desktop: panel inferior sticky 40dvh con animación
// =============================================================

function ConsolaDesktop(props: PropsConsolaSandbox) {
  // Altura redimensionable persistida en localStorage. Default 40%
  // del viewport; cap entre 20% y 85% para no romper layout (sin
  // tapar el header global ni dejar tira inutilizable).
  const ALTURA_KEY = 'flujos.consola.altura_pct'
  const [alturaPct, setAlturaPct] = useState<number>(() => {
    if (typeof window === 'undefined') return 40
    const v = Number(window.localStorage.getItem(ALTURA_KEY))
    return Number.isFinite(v) && v >= 20 && v <= 85 ? v : 40
  })
  const alturaPctRef = useRef(alturaPct)
  alturaPctRef.current = alturaPct
  const [redimensionando, setRedimensionando] = useState(false)

  const onPointerDownHandle = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setRedimensionando(true)
  }, [])

  useEffect(() => {
    if (!redimensionando) return
    const onMove = (e: PointerEvent) => {
      const h = window.innerHeight
      const desdeAbajo = h - e.clientY
      const pct = Math.max(20, Math.min(85, (desdeAbajo / h) * 100))
      setAlturaPct(pct)
    }
    const onUp = () => {
      setRedimensionando(false)
      try {
        window.localStorage.setItem(ALTURA_KEY, String(Math.round(alturaPctRef.current)))
      } catch {
        /* ignorar — privacidad / cuota */
      }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [redimensionando])

  return (
    <AnimatePresence>
      {props.abierta && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          // Altura controlada por state; cuando el usuario está
          // redimensionando deshabilitamos la transición animada del
          // estilo inline (sino se ve "saltón" al arrastrar).
          style={{
            height: `${alturaPct}dvh`,
            userSelect: redimensionando ? 'none' : undefined,
          }}
          className="absolute inset-x-0 bottom-0 z-30 border-t border-borde-sutil bg-superficie-app shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)] flex flex-col"
        >
          {/* Drag handle de resize en el borde superior. Visualmente:
              una franja delgada con un "tirador" centrado. Cursor
              vertical-resize para indicar el affordance. */}
          <div
            onPointerDown={onPointerDownHandle}
            className="absolute top-0 left-0 right-0 h-3 -translate-y-1.5 cursor-ns-resize flex items-center justify-center group"
            aria-label="Redimensionar consola"
            role="separator"
          >
            <div className="w-12 h-1 rounded-full bg-borde-fuerte/60 group-hover:bg-texto-marca/60 transition-colors" />
          </div>
          <CabeceraConsola
            tab={props.tab}
            onCambiarTab={props.onCambiarTab}
            onCerrar={props.onCerrar}
            eventoSimulado={props.eventoSimulado ?? null}
          />
          <CuerpoConsola {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// =============================================================
// Variante mobile: BottomSheet "alto" (85dvh) reusable
// =============================================================

function ConsolaMobile(props: PropsConsolaSandbox) {
  const { t } = useTraduccion()
  return (
    <BottomSheet
      abierto={props.abierta}
      onCerrar={props.onCerrar}
      titulo={t('flujos.editor.consola.titulo')}
      altura="alto"
      sinPadding
    >
      <div className="flex flex-col h-full">
        <CabeceraTabs
          tab={props.tab}
          onCambiarTab={props.onCambiarTab}
          eventoSimulado={props.eventoSimulado ?? null}
          // Sin botón cerrar acá: el BottomSheet ya provee uno via su header.
          mostrarCerrar={false}
          onCerrar={props.onCerrar}
        />
        <CuerpoConsola {...props} />
      </div>
    </BottomSheet>
  )
}

// =============================================================
// Cabecera: título + tabs + chip evento + cerrar
// =============================================================

function CabeceraConsola({
  tab,
  onCambiarTab,
  onCerrar,
  eventoSimulado,
}: {
  tab: TabConsola
  onCambiarTab: (t: TabConsola) => void
  onCerrar: () => void
  eventoSimulado: { tipo_entidad: string | null; resumen: string } | null
}) {
  const { t } = useTraduccion()
  return (
    <div className="shrink-0 flex items-center gap-3 px-3 sm:px-4 h-11 border-b border-borde-sutil">
      <div className="flex-1 min-w-0 flex items-center gap-3 overflow-hidden">
        <span className="text-xs font-medium text-texto-secundario truncate">
          {t('flujos.editor.consola.titulo')}
        </span>
        <CabeceraTabs
          tab={tab}
          onCambiarTab={onCambiarTab}
          eventoSimulado={eventoSimulado}
          mostrarCerrar={false}
          onCerrar={onCerrar}
          inline
        />
      </div>
      <button
        type="button"
        onClick={onCerrar}
        aria-label={t('flujos.editor.consola.cerrar')}
        className="size-7 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-white/[0.04] text-texto-secundario transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function CabeceraTabs({
  tab,
  onCambiarTab,
  eventoSimulado,
  mostrarCerrar,
  onCerrar,
  inline = false,
}: {
  tab: TabConsola
  onCambiarTab: (t: TabConsola) => void
  eventoSimulado: { tipo_entidad: string | null; resumen: string } | null
  mostrarCerrar: boolean
  onCerrar: () => void
  inline?: boolean
}) {
  const { t } = useTraduccion()
  return (
    <div
      className={[
        'flex items-center gap-3 min-w-0',
        inline ? '' : 'shrink-0 px-3 sm:px-4 h-11 border-b border-borde-sutil',
      ].join(' ')}
    >
      <div className="flex items-center gap-1 shrink-0">
        <BotonTab activo={tab === 'preview'} onClick={() => onCambiarTab('preview')}>
          {t('flujos.editor.consola.tab_preview')}
        </BotonTab>
        <BotonTab activo={tab === 'dryrun'} onClick={() => onCambiarTab('dryrun')}>
          {t('flujos.editor.consola.tab_dryrun')}
        </BotonTab>
      </div>
      {eventoSimulado ? (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-texto-terciario truncate min-w-0">
          <Calendar size={12} className="shrink-0" />
          <span className="shrink-0">{t('flujos.editor.consola.evento_label')}</span>
          <span className="text-texto-secundario truncate">{eventoSimulado.resumen}</span>
        </div>
      ) : (
        <span className="hidden md:inline text-xs text-texto-terciario truncate">
          {t('flujos.editor.consola.evento_sin_evento')}
        </span>
      )}
      {mostrarCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          aria-label={t('flujos.editor.consola.cerrar')}
          className="size-7 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-white/[0.04] text-texto-secundario transition-colors ml-auto"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

function BotonTab({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-7 px-2.5 rounded-md text-xs font-medium transition-colors',
        activo
          ? 'bg-texto-marca/15 text-texto-marca border border-texto-marca/40'
          : 'text-texto-secundario hover:bg-white/[0.04] border border-transparent',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// =============================================================
// Cuerpo: vista previa o dry-run según tab
// =============================================================

function CuerpoConsola(props: PropsConsolaSandbox) {
  const { estado, correr } = useDryRun({
    flujoId: props.flujoId,
    flushPendiente: props.flush,
  })

  // Cuando se abre la consola en tab "dryrun" sin haber corrido nunca,
  // dejamos el estado idle — el usuario decide cuándo correr. Si abre
  // en "preview", no se llama al endpoint todavía (solo resolver client-side).
  //
  // El cuerpo es `flex flex-col` SIN overflow propio: el scroll lo
  // gestiona cada tab adentro (TimelineDryRun separa log scrolleable +
  // footer sticky; VistaPreviaEstatica scrollea entera). Sin esto, el
  // footer "Volver a ejecutar" quedaba pegado al final del log y al
  // agrandar la consola flotaba en el medio del espacio vacío.

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {props.tab === 'preview' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <VistaPreviaEstatica acciones={props.acciones} contexto={props.contexto} />
        </div>
      ) : (
        <TimelineDryRun estado={estado} onCorrer={correr} acciones={props.acciones} />
      )}
    </div>
  )
}

// Hook utilitario: detectar si renderizar en mobile. Lo exportamos porque
// el padre (EditorFlujo) lo necesita para decidir entre bottom-sheet y
// panel sticky 40dvh.
export function useEsMobile(breakpointPx: number = 768): boolean {
  const [esMobile, setEsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const sync = () => setEsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [breakpointPx])
  return esMobile
}

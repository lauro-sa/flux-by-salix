'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, X, CheckSquare } from 'lucide-react'
import type { AccionLote } from '@/componentes/tablas/tipos-tabla'
import { Tooltip } from '@/componentes/ui/Tooltip'

/* ════════════════════════════════════════════
   Barra flotante de acciones masivas
   Desktop: superficie elevada centrada, arrastrable arriba/abajo, atajos en <kbd>
   Móvil: barra full-width fija abajo, solo íconos, respeta safe areas
   ════════════════════════════════════════════ */

export function BarraAccionesLote({
  seleccionados,
  accionesLote,
  onLimpiarSeleccion,
  preferencias,
  guardarPreferencias,
}: {
  seleccionados: Set<string>
  accionesLote: AccionLote[]
  onLimpiarSeleccion: () => void
  preferencias: { config_tablas: Record<string, unknown> }
  guardarPreferencias: (cambios: Record<string, unknown>) => void
}) {
  const posGuardada = ((preferencias.config_tablas?.['__global'] as Record<string, string> | undefined)?.barraAccionesPosicion || 'abajo') as 'arriba' | 'abajo'
  const [posicion, setPosicion] = useState<'arriba' | 'abajo'>(posGuardada)
  const [arrastrando, setArrastrando] = useState(false)
  const [sidebarAncho, setSidebarAncho] = useState(0)
  const [esMobil, setEsMobil] = useState(false)
  const barraRef = useRef<HTMLDivElement>(null)

  // Detectar móvil con matchMedia (< 640px = sm breakpoint)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setEsMobil(mq.matches)
    const handler = (e: MediaQueryListEvent) => setEsMobil(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Detectar ancho real del sidebar (dinámico: expandido/colapsado/mobile)
  useEffect(() => {
    const detectar = () => {
      const sidebar = document.querySelector('aside')
      setSidebarAncho(sidebar ? sidebar.getBoundingClientRect().width : 0)
    }
    detectar()
    const obs = new ResizeObserver(detectar)
    const sidebar = document.querySelector('aside')
    if (sidebar) obs.observe(sidebar)
    window.addEventListener('resize', detectar)
    return () => { obs.disconnect(); window.removeEventListener('resize', detectar) }
  }, [])

  // Sincronizar con preferencias guardadas
  useEffect(() => { setPosicion(posGuardada) }, [posGuardada])

  // Atajos de teclado globales cuando la barra está visible
  useEffect(() => {
    if (seleccionados.size === 0 || accionesLote.length === 0) return

    const manejar = (e: KeyboardEvent) => {
      // Esc para deseleccionar
      if (e.key === 'Escape') {
        e.preventDefault()
        onLimpiarSeleccion()
        return
      }

      // Atajos de acciones (solo si no hay input/textarea enfocado)
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      for (const accion of accionesLote) {
        if (!accion.atajo) continue
        const atajoLower = accion.atajo.toLowerCase()
        // Soporte para teclas simples (ej: 'E', 'Del') y combinaciones
        if (
          ((atajoLower === 'delete' || atajoLower === 'supr') && (e.key === 'Delete' || e.key === 'Backspace')) ||
          (atajoLower === e.key.toLowerCase() && !e.metaKey && !e.ctrlKey)
        ) {
          e.preventDefault()
          accion.onClick(seleccionados)
          if (accion.peligro) return // No limpiar selección en peligro (el handler lo decide)
          break
        }
      }
    }

    window.addEventListener('keydown', manejar)
    return () => window.removeEventListener('keydown', manejar)
  }, [seleccionados, accionesLote, onLimpiarSeleccion])

  const guardarPosicion = useCallback((pos: 'arriba' | 'abajo') => {
    setPosicion(pos)
    const globalActual = (preferencias.config_tablas?.['__global'] || {}) as Record<string, string>
    guardarPreferencias({
      config_tablas: {
        ...preferencias.config_tablas,
        __global: { ...globalActual, barraAccionesPosicion: pos },
      },
    })
  }, [preferencias.config_tablas, guardarPreferencias])

  const visible = seleccionados.size > 0 && accionesLote.length > 0
  const esArriba = posicion === 'arriba'

  // Agrupar acciones con separadores entre grupos
  const accionesAgrupadas = agruparAcciones(accionesLote)

  /* ── Versión móvil: píldora flotante compacta, solo íconos, centrada abajo ── */
  if (esMobil) {
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            key="barra-acciones-lote-mobil"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="fixed z-[var(--z-modal)] flex items-center gap-1.5 px-2 py-1.5 rounded-2xl select-none"
            style={{
              backgroundColor: 'var(--superficie-elevada)',
              border: '1px solid var(--borde-sutil)',
              boxShadow: 'var(--sombra-md), var(--sombra-sm)',
              backdropFilter: 'blur(10px)',
              left: 0,
              right: 0,
              width: 'fit-content',
              margin: '0 auto',
              bottom: 'max(env(safe-area-inset-bottom, 12px), 12px)',
            }}
          >
            {/* Conteo */}
            <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm font-semibold tabular-nums shrink-0"
              style={{ color: 'var(--texto-primario)' }}
            >
              <CheckSquare size={14} className="opacity-60" />
              <span>{seleccionados.size}</span>
            </div>

            <Separador />

            {/* Acciones — solo ícono con touch target grande */}
            {accionesAgrupadas.map((item, i) => {
              if (item.tipo === 'separador') return <Separador key={`sep-${i}`} />
              const accion = item.accion!
              return (
                <BotonAccionMovil
                  key={accion.id}
                  accion={accion}
                  seleccionados={seleccionados}
                  onClick={() => { accion.onClick(seleccionados); if (!accion.peligro && !accion.noLimpiarSeleccion) onLimpiarSeleccion() }}
                />
              )
            })}

            <Separador />

            {/* Deseleccionar */}
            <button
              onClick={onLimpiarSeleccion}
              className="flex items-center justify-center size-9 rounded-xl transition-colors shrink-0 cursor-pointer active:scale-90"
              style={{ color: 'var(--texto-terciario)' }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  /* ── Versión desktop: barra flotante centrada, arrastrable ── */
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={barraRef}
          key="barra-acciones-lote"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.5}
          onDragStart={() => setArrastrando(true)}
          onDragEnd={(_, info) => {
            setArrastrando(false)
            if (esArriba && info.offset.y > 80) guardarPosicion('abajo')
            else if (!esArriba && info.offset.y < -80) guardarPosicion('arriba')
          }}
          initial={{ opacity: 0, y: esArriba ? -12 : 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: esArriba ? -12 : 12, scale: 0.95 }}
          transition={arrastrando ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 350 }}
          className={[
            'fixed z-[var(--z-modal)] flex items-center gap-1 px-1.5 py-1.5 rounded-2xl select-none group/barra',
            esArriba ? 'top-20' : 'bottom-6',
          ].join(' ')}
          style={{
            backgroundColor: 'var(--superficie-elevada)',
            border: '1px solid var(--borde-sutil)',
            touchAction: 'none',
            left: sidebarAncho,
            right: 0,
            width: 'fit-content',
            margin: '0 auto',
            boxShadow: 'var(--sombra-md), var(--sombra-sm)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Drag handle — visible solo en hover */}
          <div className="flex items-center justify-center w-7 h-8 rounded-xl opacity-0 group-hover/barra:opacity-100 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0 touch-none"
            style={{ color: 'var(--texto-terciario)' }}
          >
            <GripVertical size={14} />
          </div>

          {/* Conteo con ícono checkbox */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold tabular-nums shrink-0"
            style={{ color: 'var(--texto-primario)' }}
          >
            <CheckSquare size={14} className="opacity-60" />
            <span>{seleccionados.size}</span>
          </div>

          <Separador />

          {/* Acciones agrupadas */}
          {accionesAgrupadas.map((item, i) => {
            if (item.tipo === 'separador') return <Separador key={`sep-${i}`} />
            const accion = item.accion!
            return (
              <BotonAccion
                key={accion.id}
                accion={accion}
                seleccionados={seleccionados}
                onClick={() => { accion.onClick(seleccionados); if (!accion.peligro && !accion.noLimpiarSeleccion) onLimpiarSeleccion() }}
              />
            )
          })}

          <Separador />

          {/* Deseleccionar con Esc */}
          <Tooltip contenido="Deseleccionar todo (Esc)">
            <button
              onClick={onLimpiarSeleccion}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2"
              style={{ color: 'var(--texto-secundario)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--superficie-hover)'
                e.currentTarget.style.color = 'var(--texto-primario)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--texto-secundario)'
              }}
            >
              <X size={14} />
              <Tecla>Esc</Tecla>
            </button>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Botón de acción individual (desktop — con texto y atajo) ── */
function BotonAccion({
  accion,
  seleccionados,
  onClick,
}: {
  accion: AccionLote
  seleccionados: Set<string>
  onClick: () => void
}) {
  const esPeligro = accion.peligro
  const textoEtiqueta = typeof accion.etiqueta === 'function' ? accion.etiqueta(seleccionados) : accion.etiqueta
  const textoTooltip = accion.atajo ? `${textoEtiqueta} (${accion.atajo})` : textoEtiqueta

  return (
    <Tooltip contenido={textoTooltip}>
      <button
        data-accion-lote={accion.id}
        onClick={onClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2"
        style={{
          color: esPeligro ? 'var(--insignia-peligro)' : 'var(--texto-primario)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = esPeligro ? 'var(--insignia-peligro-fondo)' : 'var(--superficie-hover)'
          e.currentTarget.style.color = esPeligro ? 'var(--insignia-peligro-texto)' : 'var(--texto-primario)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = esPeligro ? 'var(--insignia-peligro)' : 'var(--texto-primario)'
        }}
      >
        {accion.icono && <span className="shrink-0 [&_svg]:size-3.5">{accion.icono}</span>}
        <span>{textoEtiqueta}</span>
        {accion.atajo && <Tecla>{accion.atajo}</Tecla>}
      </button>
    </Tooltip>
  )
}

/* ── Botón de acción móvil (solo ícono, touch target 36px) ── */
function BotonAccionMovil({
  accion,
  seleccionados,
  onClick,
}: {
  accion: AccionLote
  seleccionados: Set<string>
  onClick: () => void
}) {
  const esPeligro = accion.peligro
  const textoEtiqueta = typeof accion.etiqueta === 'function' ? accion.etiqueta(seleccionados) : accion.etiqueta

  return (
    <Tooltip contenido={textoEtiqueta}>
      <button
        data-accion-lote={accion.id}
        onClick={onClick}
        className="flex items-center justify-center size-9 rounded-xl transition-colors shrink-0 cursor-pointer active:scale-90"
        style={{
          color: esPeligro ? 'var(--insignia-peligro)' : 'var(--texto-primario)',
        }}
      >
        {accion.icono && <span className="[&_svg]:size-4">{accion.icono}</span>}
      </button>
    </Tooltip>
  )
}

/* ── Separador vertical (desktop) ── */
function Separador() {
  return <div className="w-px h-4 shrink-0" style={{ backgroundColor: 'var(--borde-fuerte)' }} />
}

/* ── Badge de atajo de teclado ── */
function Tecla({ children }: { children: string }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded text-xxs font-medium leading-none ml-1.5 shrink-0"
      style={{
        backgroundColor: 'var(--superficie-activa)',
        color: 'var(--texto-terciario)',
        border: '1px solid var(--borde-sutil)',
      }}
    >
      {children}
    </kbd>
  )
}

/* ── Agrupa acciones por grupo con separadores entre ellos ── */
type ElementoAgrupado = { tipo: 'accion'; accion: AccionLote } | { tipo: 'separador' }

function agruparAcciones(acciones: AccionLote[]): ElementoAgrupado[] {
  if (acciones.length === 0) return []

  // Orden de grupos: edicion > organizacion > exportar > peligro > sin grupo
  const ordenGrupo: Record<string, number> = { edicion: 0, organizacion: 1, exportar: 2, peligro: 3 }

  // Ordenar por grupo (manteniendo orden original dentro del grupo)
  const ordenadas = [...acciones].sort((a, b) => {
    const ga = a.grupo ? ordenGrupo[a.grupo] ?? 2.5 : (a.peligro ? 3 : 2.5)
    const gb = b.grupo ? ordenGrupo[b.grupo] ?? 2.5 : (b.peligro ? 3 : 2.5)
    return ga - gb
  })

  const resultado: ElementoAgrupado[] = []
  let grupoAnterior: string | undefined

  for (const accion of ordenadas) {
    const grupoActual = accion.grupo || (accion.peligro ? 'peligro' : '__default')
    if (grupoAnterior && grupoActual !== grupoAnterior) {
      resultado.push({ tipo: 'separador' })
    }
    resultado.push({ tipo: 'accion', accion })
    grupoAnterior = grupoActual
  }

  return resultado
}

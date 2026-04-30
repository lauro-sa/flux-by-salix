'use client'

import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { X, Check, BookmarkPlus, Bookmark, Star, ChevronDown, Smile, GripVertical } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Input } from '@/componentes/ui/Input'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useTraduccion } from '@/lib/i18n'
import type { FiltroTabla } from '@/componentes/tablas/tipos-tabla'
import type { VistaGuardada, EstadoDetector } from '@/hooks/useVistasGuardadas'

/* ════════════════════════════════════════════
   Sub-componente: Dropdown individual de filtro
   ════════════════════════════════════════════ */

/** Dropdown individual de un filtro — se posiciona debajo de su botón trigger */
export function DropdownFiltro({ filtro, onCerrar }: { filtro: FiltroTabla; onCerrar: () => void }) {
  const { t } = useTraduccion()
  const [busqueda, setBusqueda] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onCerrar])

  const opcionesFiltradas = filtro.opciones?.filter(op =>
    !busqueda || op.etiqueta.toLowerCase().includes(busqueda.toLowerCase())
  ) || []

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 mt-1 w-52 bg-superficie-elevada border border-borde-sutil rounded-popover shadow-lg z-50 overflow-hidden"
    >
      {/* Selección / Múltiple (incluye multiple-compacto cuando se usa como chip en la barra) */}
      {(filtro.tipo === 'seleccion' || filtro.tipo === 'multiple' || filtro.tipo === 'multiple-compacto') && filtro.opciones && (
        <div className="flex flex-col">
          {/* Buscador si >6 opciones */}
          {filtro.opciones.length > 6 && (
            <div className="p-2 pb-0">
              <Input
                tipo="search"
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar..."
                compacto
                formato={null}
              />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto p-1.5 flex flex-col gap-px">
            {opcionesFiltradas.map(op => {
              const esMultiple = filtro.tipo === 'multiple' || filtro.tipo === 'multiple-compacto'
              const seleccionado = esMultiple
                ? Array.isArray(filtro.valor) && filtro.valor.includes(op.valor)
                : op.valor === filtro.valor
              return (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => {
                    if (esMultiple) {
                      const actual = Array.isArray(filtro.valor) ? filtro.valor : []
                      filtro.onChange(seleccionado ? actual.filter(v => v !== op.valor) : [...actual, op.valor])
                    } else {
                      filtro.onChange(op.valor === filtro.valor ? '' : op.valor)
                      if (op.valor !== filtro.valor) onCerrar()
                    }
                  }}
                  className={[
                    'flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded-boton cursor-pointer transition-colors border-none focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                    seleccionado
                      ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                      : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                  ].join(' ')}
                >
                  {esMultiple && (
                    <span
                      className="inline-flex items-center justify-center size-3.5 rounded border shrink-0 transition-colors"
                      style={seleccionado ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' } : { borderColor: 'var(--borde-fuerte)' }}
                    >
                      {seleccionado && <Check size={8} className="text-texto-inverso" />}
                    </span>
                  )}
                  <span className="flex-1 truncate">{op.etiqueta}</span>
                  {filtro.tipo === 'seleccion' && seleccionado && <Check size={13} className="shrink-0" />}
                </button>
              )
            })}
          </div>
          {/* Limpiar para múltiple */}
          {(filtro.tipo === 'multiple' || filtro.tipo === 'multiple-compacto') && Array.isArray(filtro.valor) && filtro.valor.length > 0 && (
            <div className="border-t border-borde-sutil p-1.5">
              <Boton
                variante="fantasma"
                tamano="xs"
                onClick={() => { filtro.onChange([]); onCerrar() }}
                anchoCompleto
              >
                {t('paginacion.limpiar_seleccion')}
              </Boton>
            </div>
          )}
        </div>
      )}

      {/* Fecha */}
      {filtro.tipo === 'fecha' && (
        <div className="p-2.5 flex flex-col gap-2">
          <SelectorFecha
            valor={typeof filtro.valor === 'string' ? filtro.valor : null}
            onChange={(v) => { filtro.onChange(v || ''); if (v) onCerrar() }}
            limpiable
          />
          {filtro.valor && (
            <Boton
              variante="fantasma"
              tamano="xs"
              onClick={() => { filtro.onChange(''); onCerrar() }}
            >
              Limpiar
            </Boton>
          )}
        </div>
      )}
    </motion.div>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Trigger compacto con popover (para 'multiple-compacto')
   Botón con "N seleccionados" + popover con buscador y checkboxes.
   Ideal para filtros con muchas opciones (10+) o etiquetas largas.
   ════════════════════════════════════════════ */

function MultipleCompactoTrigger({ filtro }: { filtro: FiltroTabla }) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [posicion, setPosicion] = useState<CSSProperties>({})
  const [montado, setMontado] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { t } = useTraduccion()

  useEffect(() => { setMontado(true) }, [])

  // Modo single-select (seleccion-compacto) o multi (multiple-compacto).
  const esSingle = filtro.tipo === 'seleccion-compacto'
  const valorSingle = typeof filtro.valor === 'string' ? filtro.valor : ''
  const valores = esSingle
    ? (valorSingle ? [valorSingle] : [])
    : (Array.isArray(filtro.valor) ? filtro.valor : [])
  const opciones = filtro.opciones || []
  const opcionesFiltradas = opciones.filter(op =>
    !busqueda || op.etiqueta.toLowerCase().includes(busqueda.toLowerCase()),
  )

  const seleccionadas = opciones.filter(o => valores.includes(o.valor))
  const mostrarChips = seleccionadas.slice(0, 2)
  const restantes = seleccionadas.length - mostrarChips.length

  // Calcular posición del popover (fixed, basado en el trigger)
  useEffect(() => {
    if (!abierto || !triggerRef.current) return
    const calcular = () => {
      const rect = triggerRef.current!.getBoundingClientRect()
      const espacioAbajo = window.innerHeight - rect.bottom
      const altoEstimado = Math.min(360, opciones.length * 32 + 80)
      const abreArriba = espacioAbajo < altoEstimado && rect.top > espacioAbajo

      setPosicion({
        position: 'fixed',
        left: rect.left,
        width: Math.max(rect.width, 240),
        ...(abreArriba
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    calcular()
    window.addEventListener('resize', calcular)
    window.addEventListener('scroll', calcular, true)
    return () => {
      window.removeEventListener('resize', calcular)
      window.removeEventListener('scroll', calcular, true)
    }
  }, [abierto, opciones.length])

  // Cerrar al click fuera (trigger o panel)
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setAbierto(false)
      setBusqueda('')
    }
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAbierto(false); setBusqueda('') }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [abierto])

  const toggle = (valor: string) => {
    if (esSingle) {
      // Single-select: seleccionar deselecciona si ya estaba, y cierra popover al elegir uno nuevo.
      if (valorSingle === valor) {
        filtro.onChange('')
      } else {
        filtro.onChange(valor)
        setAbierto(false)
        setBusqueda('')
      }
      return
    }
    // Multi-select: toggle normal.
    if (valores.includes(valor)) {
      filtro.onChange(valores.filter(v => v !== valor))
    } else {
      filtro.onChange([...valores, valor])
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setAbierto(!abierto)}
        className={[
          'w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-boton text-sm text-left border cursor-pointer transition-colors',
          'focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
          valores.length > 0
            ? 'bg-superficie-seleccionada border-texto-marca/40 text-texto-primario'
            : 'bg-superficie-tarjeta border-borde-sutil text-texto-secundario hover:bg-superficie-hover',
        ].join(' ')}
      >
        <span className="flex-1 flex items-center gap-1 flex-wrap min-w-0">
          {seleccionadas.length === 0 ? (
            <span className="text-texto-terciario">Todos</span>
          ) : (
            <>
              {mostrarChips.map(s => (
                <span
                  key={s.valor}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-texto-marca/15 text-texto-marca text-xxs max-w-[140px]"
                >
                  <span className="truncate">{s.etiqueta}</span>
                </span>
              ))}
              {restantes > 0 && (
                <span className="text-xxs text-texto-terciario">+{restantes}</span>
              )}
            </>
          )}
        </span>
        <ChevronDown
          size={13}
          className={['text-texto-terciario transition-transform', abierto ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {/* Popover renderizado por portal — queda por encima del panel de filtros */}
      {montado && createPortal(
        <AnimatePresence>
          {abierto && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              style={{ ...posicion, zIndex: 100 }}
              className="bg-superficie-elevada border border-borde-sutil rounded-popover shadow-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {opciones.length > 6 && (
                <div className="p-2 pb-0">
                  <Input
                    tipo="search"
                    autoFocus
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar..."
                    compacto
                    formato={null}
                  />
                </div>
              )}

              <div className="max-h-56 overflow-y-auto p-1.5 flex flex-col gap-px">
                {opcionesFiltradas.length === 0 ? (
                  <span className="text-xs text-texto-terciario text-center py-3">Sin resultados</span>
                ) : opcionesFiltradas.map(op => {
                  const sel = valores.includes(op.valor)
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => toggle(op.valor)}
                      className={[
                        'flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded-boton cursor-pointer transition-colors border-none',
                        'focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                        sel ? 'bg-superficie-seleccionada text-texto-marca font-medium' : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                      ].join(' ')}
                    >
                      <span
                        className="inline-flex items-center justify-center size-3.5 rounded border shrink-0 transition-colors"
                        style={sel
                          ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' }
                          : { borderColor: 'var(--borde-fuerte)' }}
                      >
                        {sel && <Check size={8} className="text-texto-inverso" />}
                      </span>
                      <span className="flex-1 truncate">{op.etiqueta}</span>
                    </button>
                  )
                })}
              </div>

              {valores.length > 0 && (
                <div className="border-t border-borde-sutil p-1.5">
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    onClick={() => filtro.onChange([])}
                    anchoCompleto
                  >
                    {t('paginacion.limpiar_seleccion')}
                  </Boton>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Sección de filtro dentro del panel
   ════════════════════════════════════════════ */

/** Sección de filtro dentro del panel — adapta UI según tipo (pills, seleccion, multiple, fecha) */
export function SeccionFiltroPanel({ filtro }: { filtro: FiltroTabla }) {
  const { t } = useTraduccion()
  // Pills: botones horizontales con "Todos" al inicio
  if (filtro.tipo === 'pills' && filtro.opciones) {
    const valorActual = typeof filtro.valor === 'string' ? filtro.valor : ''
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{filtro.etiqueta}</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => filtro.onChange('')}
            className={[
              'px-3 py-1.5 rounded-boton text-xs font-medium cursor-pointer border-none transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
              !valorActual ? 'bg-texto-marca text-white' : 'bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover',
            ].join(' ')}>
            Todos
          </button>
          {filtro.opciones.map(op => (
            <button key={op.valor} type="button"
              onClick={() => filtro.onChange(op.valor === valorActual ? '' : op.valor)}
              className={[
                'px-3 py-1.5 rounded-boton text-xs font-medium cursor-pointer border-none transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                op.valor === valorActual ? 'bg-texto-marca text-white' : 'bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover',
              ].join(' ')}>
              {op.etiqueta}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Múltiple compacto / Selección compacta: botón con popover
  // (ideal para 10+ opciones o etiquetas largas; o single-select que no queremos apilar verticalmente).
  if ((filtro.tipo === 'multiple-compacto' || filtro.tipo === 'seleccion-compacto') && filtro.opciones) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{filtro.etiqueta}</span>
        <MultipleCompactoTrigger filtro={filtro} />
      </div>
    )
  }

  // Selección / Múltiple: lista vertical con check/checkbox
  if ((filtro.tipo === 'seleccion' || filtro.tipo === 'multiple') && filtro.opciones) {
    const valorActual = typeof filtro.valor === 'string' ? filtro.valor : ''
    const valoresActuales = Array.isArray(filtro.valor) ? filtro.valor : []
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{filtro.etiqueta}</span>
        {/* "Todos" como primera opción */}
        <button type="button"
          onClick={() => filtro.onChange(filtro.tipo === 'multiple' ? [] : '')}
          className={[
            'flex items-center gap-2 px-2.5 py-1.5 rounded-boton text-sm text-left cursor-pointer border-none transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
            (filtro.tipo === 'multiple' ? valoresActuales.length === 0 : !valorActual)
              ? 'bg-superficie-seleccionada text-texto-marca font-medium'
              : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
          ].join(' ')}>
          <Check size={13} className={(filtro.tipo === 'multiple' ? valoresActuales.length === 0 : !valorActual) ? 'text-texto-marca' : 'text-transparent'} />
          <span className="flex-1">Todos</span>
          {(filtro.tipo === 'multiple' ? valoresActuales.length === 0 : !valorActual) && <Check size={13} className="text-texto-marca" />}
        </button>
        {filtro.opciones.map(op => {
          const sel = filtro.tipo === 'multiple'
            ? valoresActuales.includes(op.valor)
            : op.valor === valorActual
          return (
            <button key={op.valor} type="button"
              onClick={() => {
                if (filtro.tipo === 'multiple') {
                  filtro.onChange(sel ? valoresActuales.filter(v => v !== op.valor) : [...valoresActuales, op.valor])
                } else {
                  filtro.onChange(op.valor === valorActual ? '' : op.valor)
                }
              }}
              className={[
                'flex items-center gap-2 px-2.5 py-1.5 rounded-boton text-sm text-left cursor-pointer border-none transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                sel ? 'bg-superficie-seleccionada text-texto-marca font-medium' : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
              ].join(' ')}>
              {filtro.tipo === 'multiple' ? (
                <span className="inline-flex items-center justify-center size-3.5 rounded border shrink-0 transition-colors"
                  style={sel ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' } : { borderColor: 'var(--borde-fuerte)' }}>
                  {sel && <Check size={8} className="text-texto-inverso" />}
                </span>
              ) : (
                <span className={`size-3.5 shrink-0 ${sel ? '' : 'opacity-0'}`}>{sel && <Check size={13} className="text-texto-marca" />}</span>
              )}
              <span className="flex-1">{op.etiqueta}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // Fecha
  if (filtro.tipo === 'fecha') {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{filtro.etiqueta}</span>
        <div className="flex items-center gap-2">
          <SelectorFecha
            valor={typeof filtro.valor === 'string' ? filtro.valor : null}
            onChange={(v) => filtro.onChange(v || '')}
            limpiable
          />
          {filtro.valor && (
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              titulo={t('paginacion.limpiar_filtro')}
              icono={<X size={13} />}
              onClick={() => filtro.onChange('')}
            />
          )}
        </div>
      </div>
    )
  }

  return null
}

/* ════════════════════════════════════════════
   Sub-componente: Selector de emoji compacto para vistas guardadas
   Grilla pre-curada + input para emoji custom.
   ════════════════════════════════════════════ */

const EMOJIS_VISTAS = [
  '⭐', '❤️', '🔥', '⚡', '✨', '💎', '🏆',
  '📧', '📝', '📋', '📊', '📦', '🗂️', '📁',
  '✅', '⚠️', '❌', '🚩', '🎯', '🔔', '⏰',
  '👤', '👥', '🤝', '💼', '🏢', '🏠', '🌎',
  '🟢', '🟡', '🟠', '🔴', '🔵', '🟣', '⚫',
]

function SelectorEmoji({
  valor,
  onChange,
  compacto = false,
}: {
  valor?: string | null
  onChange: (emoji: string | null) => void
  compacto?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [custom, setCustom] = useState('')
  const [posicion, setPosicion] = useState<CSSProperties>({})
  const [montado, setMontado] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMontado(true) }, [])

  // Posicionar popover usando coords del trigger (fixed → sale por fuera del panel de filtros)
  useEffect(() => {
    if (!abierto || !triggerRef.current) return
    const calcular = () => {
      const rect = triggerRef.current!.getBoundingClientRect()
      const anchoPanel = 240
      const altoEstimado = 260
      const espacioAbajo = window.innerHeight - rect.bottom
      const abreArriba = espacioAbajo < altoEstimado && rect.top > espacioAbajo
      const left = Math.min(rect.left, window.innerWidth - anchoPanel - 8)
      setPosicion({
        position: 'fixed',
        left: Math.max(8, left),
        width: anchoPanel,
        ...(abreArriba
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    calcular()
    window.addEventListener('resize', calcular)
    window.addEventListener('scroll', calcular, true)
    return () => {
      window.removeEventListener('resize', calcular)
      window.removeEventListener('scroll', calcular, true)
    }
  }, [abierto])

  // Cerrar al click fuera o Esc
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setAbierto(false)
    }
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [abierto])

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setAbierto(!abierto) }}
        className={[
          'inline-flex items-center justify-center rounded-boton border border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-hover cursor-pointer transition-colors shrink-0',
          compacto ? 'size-6 text-sm' : 'size-7 text-base',
        ].join(' ')}
        title="Elegir emoji"
      >
        {valor || <Smile size={compacto ? 13 : 14} className="text-texto-terciario" />}
      </button>

      {montado && createPortal(
        <AnimatePresence>
          {abierto && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              style={{ ...posicion, zIndex: 200 }}
              className="bg-superficie-elevada border border-borde-sutil rounded-popover shadow-lg p-2"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-7 gap-0.5 mb-2">
                {EMOJIS_VISTAS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChange(emoji); setAbierto(false) }}
                    className={[
                      'size-7 flex items-center justify-center rounded-boton cursor-pointer transition-colors border-none',
                      valor === emoji ? 'bg-superficie-seleccionada' : 'bg-transparent hover:bg-superficie-hover',
                    ].join(' ')}
                  >
                    <span className="text-base">{emoji}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-borde-sutil">
                <Input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && custom.trim()) {
                      e.stopPropagation()
                      onChange(custom.trim())
                      setCustom('')
                      setAbierto(false)
                    }
                  }}
                  placeholder="Otro emoji..."
                  compacto
                  variante="plano"
                  className="flex-1"
                  formato={null}
                />
                {valor && (
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    onClick={(e) => { e.stopPropagation(); onChange(null); setAbierto(false) }}
                  >
                    Quitar
                  </Boton>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Guardar vista inline
   ════════════════════════════════════════════ */

/** Botón inline para guardar la vista actual — incluye selector de emoji opcional */
export function GuardarVistaInline({
  onGuardar,
}: {
  onGuardar: (nombre: string, icono?: string | null) => void
}) {
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [icono, setIcono] = useState<string | null>(null)
  const { t } = useTraduccion()

  const confirmar = () => {
    if (!nombre.trim()) return
    onGuardar(nombre.trim(), icono)
    setNombre(''); setIcono(null); setCreando(false)
  }
  const cancelar = () => { setNombre(''); setIcono(null); setCreando(false) }

  if (!creando) {
    return (
      <Boton
        variante="fantasma"
        tamano="xs"
        icono={<BookmarkPlus size={13} />}
        onClick={() => setCreando(true)}
        className="mt-1 text-texto-marca"
      >
        Guardar actual
      </Boton>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <SelectorEmoji valor={icono} onChange={setIcono} compacto />
      <Input
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirmar()
          if (e.key === 'Escape') cancelar()
        }}
        placeholder="Nombre..."
        compacto
        variante="plano"
        className="flex-1"
        formato={null}
      />
      <Boton
        variante="fantasma"
        tamano="xs"
        disabled={!nombre.trim()}
        onClick={confirmar}
        className="text-texto-marca"
      >
        {t('comun.guardar')}
      </Boton>
    </div>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Panel de vistas guardadas
   ════════════════════════════════════════════ */

/* ═══ Fila de una vista guardada (exportada para uso desde TablaDinamica) ═══ */
export function FilaVista({
  vista,
  esActiva,
  puedeArrastrar,
  onAplicar,
  onRenombrar,
  onCambiarIcono,
  onMarcarPredefinida,
  onEliminar,
}: {
  vista: VistaGuardada
  esActiva: boolean
  puedeArrastrar: boolean
  onAplicar?: () => void
  onRenombrar?: (nombre: string) => void
  onCambiarIcono?: (icono: string | null) => void
  onMarcarPredefinida?: () => void
  onEliminar?: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [valorNombre, setValorNombre] = useState(vista.nombre)

  useEffect(() => { setValorNombre(vista.nombre) }, [vista.nombre])

  const confirmarRenombrar = () => {
    const n = valorNombre.trim()
    if (n && n !== vista.nombre && onRenombrar) onRenombrar(n)
    else setValorNombre(vista.nombre)
    setEditando(false)
  }

  return (
    <div
      className={[
        'group flex items-center gap-1.5 px-1.5 py-1.5 rounded-boton transition-colors',
        editando ? 'bg-superficie-hover' : 'cursor-pointer hover:bg-superficie-hover',
      ].join(' ')}
      onClick={() => { if (!editando) onAplicar?.() }}
    >
      {/* Drag handle */}
      {puedeArrastrar && (
        <span
          onPointerDown={(e) => e.stopPropagation()}
          className="size-5 flex items-center justify-center text-texto-terciario opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity shrink-0"
        >
          <GripVertical size={12} />
        </span>
      )}

      {/* Emoji / icono */}
      {onCambiarIcono ? (
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <SelectorEmoji valor={vista.icono} onChange={onCambiarIcono} compacto />
        </div>
      ) : (
        <span className="size-6 inline-flex items-center justify-center shrink-0">
          {vista.icono || <Bookmark size={13} className={esActiva ? 'text-texto-marca fill-current' : 'text-texto-terciario'} />}
        </span>
      )}

      {/* Nombre (renombrable inline con doble click) */}
      {editando ? (
        <Input
          autoFocus
          value={valorNombre}
          onChange={(e) => setValorNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmarRenombrar()
            if (e.key === 'Escape') { setValorNombre(vista.nombre); setEditando(false) }
          }}
          onBlur={confirmarRenombrar}
          onClick={(e) => e.stopPropagation()}
          compacto
          variante="plano"
          className="flex-1"
          formato={null}
        />
      ) : (
        <span
          onDoubleClick={(e) => { if (onRenombrar) { e.stopPropagation(); setEditando(true) } }}
          className={[
            'flex-1 text-sm truncate select-none',
            esActiva ? 'font-semibold text-texto-marca' : 'text-texto-primario',
          ].join(' ')}
          title={onRenombrar ? 'Doble click para renombrar' : undefined}
        >
          {vista.nombre}
        </span>
      )}

      {/* Badges */}
      {vista.es_sistema && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-texto-terciario shrink-0">Sistema</span>
      )}
      {/* Estrella siempre visible cuando es predefinida — se queda persistente
          (no en hover) para que el usuario sepa cuál es la predefinida.
          El click toggle vive en el botón de acciones de abajo. */}
      {vista.predefinida && !onMarcarPredefinida && (
        <Star size={11} className="text-texto-marca fill-current shrink-0" />
      )}
      {esActiva && <Check size={13} className="text-texto-marca shrink-0" />}

      {/* Acciones (la estrella queda visible si es predefinida; el resto en hover) */}
      <div className="flex items-center gap-0.5 transition-all shrink-0">
        {onMarcarPredefinida && !vista.es_sistema && (
          <Tooltip contenido={vista.predefinida ? 'Quitar como predefinida' : 'Marcar como predefinida'}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarcarPredefinida() }}
              className={[
                'size-5 inline-flex items-center justify-center rounded-boton cursor-pointer border-none bg-transparent transition-colors',
                vista.predefinida
                  ? 'text-texto-marca hover:bg-superficie-hover'
                  : 'opacity-0 group-hover:opacity-100 text-texto-terciario hover:text-texto-marca hover:bg-superficie-hover',
              ].join(' ')}
            >
              <Star size={11} className={vista.predefinida ? 'fill-current' : ''} />
            </button>
          </Tooltip>
        )}
        {onEliminar && !vista.es_sistema && (
          <Tooltip contenido="Eliminar vista">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEliminar() }}
              className="size-5 inline-flex items-center justify-center rounded-boton hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent text-texto-terciario hover:text-insignia-peligro-texto transition-colors opacity-0 group-hover:opacity-100"
            >
              <X size={11} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

/** Sección de vistas guardadas — se renderiza inline dentro del panel de filtros */
export function PanelVistasGuardadas({
  vistasGuardadas,
  detector,
  onAplicarVista,
  onGuardarVista,
  onEliminarVista,
  onSobrescribirVista,
  onMarcarPredefinida,
  onRenombrarVista,
  onCambiarIconoVista,
  onReordenarVistas,
}: {
  vistasGuardadas?: VistaGuardada[]
  detector?: { tipo: EstadoDetector; vistaActiva: VistaGuardada | null }
  onAplicarVista?: (id: string) => void
  onGuardarVista?: (nombre: string, icono?: string | null) => void
  onEliminarVista?: (id: string) => void
  onSobrescribirVista?: (id: string) => void
  onMarcarPredefinida?: (id: string) => void
  onRenombrarVista?: (id: string, nombre: string) => void
  onCambiarIconoVista?: (id: string, icono: string | null) => void
  onReordenarVistas?: (idsOrdenados: string[]) => void
}) {
  const { t } = useTraduccion()
  const [nombreNueva, setNombreNueva] = useState('')
  const [iconoNueva, setIconoNueva] = useState<string | null>(null)
  const [creandoVista, setCreandoVista] = useState(false)

  const vistas = vistasGuardadas || []
  const vistasSistema = vistas.filter(v => v.es_sistema)
  const vistasPersonales = vistas.filter(v => !v.es_sistema)

  const tieneContenido = vistas.length > 0 || (onGuardarVista && detector?.tipo !== 'default')
  if (!tieneContenido) return null

  return (
    <div className="border-t border-borde-sutil p-3 flex flex-col gap-3">

      {/* ═══ Vistas del sistema (si existen) ═══ */}
      {vistasSistema.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider px-1.5 mb-1">
            Del sistema
          </span>
          {vistasSistema.map(v => (
            <FilaVista
              key={v.id}
              vista={v}
              esActiva={detector?.vistaActiva?.id === v.id}
              puedeArrastrar={false}
              onAplicar={() => onAplicarVista?.(v.id)}
            />
          ))}
        </div>
      )}

      {/* ═══ Vistas personales (drag-and-drop) ═══ */}
      {vistasPersonales.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider px-1.5 mb-1">
            {vistasSistema.length > 0 ? 'Mis vistas' : 'Vistas guardadas'}
          </span>
          {onReordenarVistas ? (
            <Reorder.Group
              axis="y"
              values={vistasPersonales}
              onReorder={(nuevoOrden) => onReordenarVistas(nuevoOrden.map(v => v.id))}
              className="flex flex-col gap-0.5"
            >
              {vistasPersonales.map(v => (
                <Reorder.Item key={v.id} value={v} dragListener={true} className="list-none">
                  <FilaVista
                    vista={v}
                    esActiva={detector?.vistaActiva?.id === v.id}
                    puedeArrastrar
                    onAplicar={() => onAplicarVista?.(v.id)}
                    onRenombrar={onRenombrarVista ? (n) => onRenombrarVista(v.id, n) : undefined}
                    onCambiarIcono={onCambiarIconoVista ? (i) => onCambiarIconoVista(v.id, i) : undefined}
                    onMarcarPredefinida={onMarcarPredefinida ? () => onMarcarPredefinida(v.id) : undefined}
                    onEliminar={onEliminarVista ? () => onEliminarVista(v.id) : undefined}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            vistasPersonales.map(v => (
              <FilaVista
                key={v.id}
                vista={v}
                esActiva={detector?.vistaActiva?.id === v.id}
                puedeArrastrar={false}
                onAplicar={() => onAplicarVista?.(v.id)}
                onRenombrar={onRenombrarVista ? (n) => onRenombrarVista(v.id, n) : undefined}
                onCambiarIcono={onCambiarIconoVista ? (i) => onCambiarIconoVista(v.id, i) : undefined}
                onMarcarPredefinida={onMarcarPredefinida ? () => onMarcarPredefinida(v.id) : undefined}
                onEliminar={onEliminarVista ? () => onEliminarVista(v.id) : undefined}
              />
            ))
          )}
        </div>
      )}

      {/* ═══ Sobrescribir vista existente ═══ */}
      {detector?.tipo === 'sin_guardar' && vistasPersonales.length > 0 && onSobrescribirVista && (
        <div className="flex flex-col gap-1">
          <span className="text-xxs text-texto-terciario">Sobrescribir:</span>
          <div className="flex flex-wrap gap-1">
            {vistasPersonales.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onSobrescribirVista(v.id)}
                className="text-xs px-2 py-0.5 rounded-boton border border-borde-sutil bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
              >
                {v.icono ? `${v.icono} ${v.nombre}` : v.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Guardar como vista nueva ═══ */}
      {onGuardarVista && detector?.tipo !== 'default' && (
        <div className="flex flex-col gap-1.5">
          {!creandoVista ? (
            <Boton
              variante="fantasma"
              tamano="xs"
              icono={<BookmarkPlus size={13} />}
              onClick={() => setCreandoVista(true)}
              className="text-texto-marca"
            >
              Guardar vista
            </Boton>
          ) : (
            <div className="flex items-center gap-1.5">
              <SelectorEmoji valor={iconoNueva} onChange={setIconoNueva} compacto />
              <Input
                autoFocus
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nombreNueva.trim()) {
                    onGuardarVista(nombreNueva.trim(), iconoNueva)
                    setNombreNueva(''); setIconoNueva(null); setCreandoVista(false)
                  }
                  if (e.key === 'Escape') { setNombreNueva(''); setIconoNueva(null); setCreandoVista(false) }
                }}
                placeholder="Nombre..."
                compacto
                variante="plano"
                className="flex-1"
                formato={null}
              />
              <Boton
                variante="fantasma"
                tamano="xs"
                disabled={!nombreNueva.trim()}
                onClick={() => {
                  if (nombreNueva.trim()) {
                    onGuardarVista(nombreNueva.trim(), iconoNueva)
                    setNombreNueva(''); setIconoNueva(null); setCreandoVista(false)
                  }
                }}
                className="text-texto-marca"
              >
                {t('comun.guardar')}
              </Boton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

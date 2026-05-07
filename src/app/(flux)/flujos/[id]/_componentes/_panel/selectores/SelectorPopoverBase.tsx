'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, X } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

/**
 * Popover base reusado por los 5 selectores autocomplete del editor
 * (sub-PR 19.3c). NO es un selector genérico — los selectores
 * específicos viven en archivos aparte y le pasan a este popover sus
 * opciones, label seleccionado, y handlers de selección.
 *
 * Razón de existir: los 5 selectores comparten el wiring del popover
 * (trigger button + portal + buscador + lista + cierre por click fuera).
 * Sin este base, repetiríamos ~80 LOC en cada selector.
 *
 * El componente NO tipa las opciones — cada selector específico les da
 * shape via `renderOpcion`. Lo único que sabe la base es: cuántas
 * opciones hay, cuál está seleccionada, qué texto mostrar en el trigger
 * y qué texto pasarle al filtro de búsqueda.
 */

export interface OpcionSelector {
  /** Identificador único. */
  id: string
  /** Texto a mostrar en el trigger cuando está seleccionada. */
  etiqueta: string
  /** Texto adicional para search (descripción, email, etc). Opcional. */
  busqueda?: string
}

interface Props {
  /** Texto a mostrar cuando NO hay nada seleccionado. */
  placeholder: string
  /** Opción actualmente seleccionada (si está). */
  seleccionada: OpcionSelector | null
  opciones: OpcionSelector[]
  cargando?: boolean
  error?: string | null
  /**
   * Callback al elegir una opción. La base se cierra automáticamente
   * al hacer click; si querés mantenerlo abierto (ej: multi-select) usá
   * `mantenerAbierto`.
   */
  onSeleccionar: (opcion: OpcionSelector) => void
  /** Si está en true, el popover NO se cierra al elegir (modo multi). */
  mantenerAbierto?: boolean
  /** Render custom de cada opción. Si no se pasa, mostramos `etiqueta`. */
  renderOpcion?: (opcion: OpcionSelector) => ReactNode
  disabled?: boolean
  /** Slot opcional adentro del trigger (ej: chips de seleccionados en multi). */
  contenidoTrigger?: ReactNode
  /** Texto del placeholder del buscador. Si no, usa "flujos.selector.buscar". */
  placeholderBusqueda?: string
  /** Texto para vacío. Si no, usa "flujos.selector.sin_resultados". */
  textoSinResultados?: string
}

export default function SelectorPopoverBase({
  placeholder,
  seleccionada,
  opciones,
  cargando,
  error,
  onSeleccionar,
  mantenerAbierto = false,
  renderOpcion,
  disabled,
  contenidoTrigger,
  placeholderBusqueda,
  textoSinResultados,
}: Props) {
  const { t } = useTraduccion()
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const refTrigger = useRef<HTMLButtonElement>(null)
  const refPopover = useRef<HTMLDivElement>(null)
  const refBuscador = useRef<HTMLInputElement>(null)

  // Posición portal
  useEffect(() => {
    if (!abierto || !refTrigger.current) return
    const r = refTrigger.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    setTimeout(() => refBuscador.current?.focus(), 30)
  }, [abierto])

  // Click fuera cierra
  useEffect(() => {
    if (!abierto) return
    const h = (e: MouseEvent) => {
      if (refTrigger.current?.contains(e.target as Node)) return
      if (refPopover.current?.contains(e.target as Node)) return
      setAbierto(false)
      setBusqueda('')
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [abierto])

  // Filtrar opciones por búsqueda (case-insensitive contra etiqueta + busqueda)
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return opciones
    return opciones.filter((o) => {
      const blob = `${o.etiqueta} ${o.busqueda ?? ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [opciones, busqueda])

  return (
    <>
      <button
        ref={refTrigger}
        type="button"
        onClick={() => !disabled && setAbierto((v) => !v)}
        disabled={disabled}
        className={[
          'flex items-center gap-2 w-full rounded-input border border-borde-fuerte bg-superficie-tarjeta px-3 py-2 text-sm text-left transition-colors',
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-borde-foco',
          abierto ? 'border-borde-foco shadow-foco' : '',
        ].join(' ')}
      >
        <span className="flex-1 min-w-0">
          {contenidoTrigger ??
            (seleccionada ? (
              <span className="truncate text-texto-primario">{seleccionada.etiqueta}</span>
            ) : (
              <span className="truncate text-texto-placeholder">{placeholder}</span>
            ))}
        </span>
        <ChevronDown
          size={14}
          className={['shrink-0 text-texto-terciario transition-transform', abierto ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {abierto && (
              <motion.div
                ref={refPopover}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="fixed rounded-popover border border-borde-sutil bg-superficie-elevada shadow-elevada overflow-hidden z-50"
                style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 280) }}
              >
                <div className="flex items-center gap-2 px-3 py-2 border-b border-borde-sutil">
                  <Search size={14} className="shrink-0 text-texto-terciario" />
                  <input
                    ref={refBuscador}
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder={placeholderBusqueda ?? t('flujos.selector.buscar')}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-placeholder"
                  />
                  {busqueda.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBusqueda('')}
                      className="shrink-0 p-0.5 rounded hover:bg-superficie-hover text-texto-terciario"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto py-1">
                  {cargando && (
                    <p className="px-3 py-3 text-center text-xs text-texto-terciario">
                      {t('flujos.selector.cargando')}
                    </p>
                  )}
                  {!cargando && error && (
                    <p className="px-3 py-3 text-center text-xs text-insignia-peligro-texto">
                      {t('flujos.selector.error_cargar')}
                    </p>
                  )}
                  {!cargando && !error && filtradas.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-texto-terciario">
                      {textoSinResultados ?? t('flujos.selector.sin_resultados')}
                    </p>
                  )}
                  {!cargando &&
                    !error &&
                    filtradas.map((opcion) => {
                      const seleccionado = seleccionada?.id === opcion.id
                      return (
                        <button
                          key={opcion.id}
                          type="button"
                          onClick={() => {
                            onSeleccionar(opcion)
                            if (!mantenerAbierto) {
                              setAbierto(false)
                              setBusqueda('')
                            }
                          }}
                          className={[
                            'w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer',
                            seleccionado
                              ? 'bg-texto-marca/10 text-texto-marca'
                              : 'hover:bg-superficie-hover text-texto-primario',
                          ].join(' ')}
                        >
                          {renderOpcion ? renderOpcion(opcion) : opcion.etiqueta}
                        </button>
                      )
                    })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}

'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Braces, ChevronRight, ArrowLeft } from 'lucide-react'
import { useTema } from '@/hooks/useTema'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { obtenerEntidades, buscarVariables, obtenerVariablesAgrupadas } from '@/lib/variables/registro'
import type { DefinicionEntidad, DefinicionVariable, ContextoVariables } from '@/lib/variables/tipos'
// Side-effect: registra todas las entidades al importar este componente
import '@/lib/variables/entidades'

interface PropiedadesSelectorVariables {
  /** Callback cuando se selecciona una variable — recibe '{{entidad.campo}}' */
  onSeleccionar: (variable: string) => void
  /** Controlar apertura externamente */
  abierto?: boolean
  /** Callback al cerrar */
  onCerrar?: () => void
  /** Posición del popover relativa al trigger */
  posicion?: 'arriba' | 'abajo'
  /** Clase CSS adicional */
  className?: string
  /** Datos reales del contexto actual para mostrar preview de valores */
  contexto?: ContextoVariables
}

/**
 * SelectorVariables — Popover para insertar variables dinámicas en campos de texto.
 * Muestra entidades como categorías con sus variables agrupadas.
 * Búsqueda global por nombre de variable, entidad o descripción.
 * Si se pasa contexto, muestra el valor real que tendrá la variable.
 *
 * Se usa en: ModalEnviarDocumento, plantillas de documentos, emails, mensajes WhatsApp.
 */
function SelectorVariables({
  onSeleccionar,
  abierto: abiertoExterno,
  onCerrar,
  posicion = 'abajo',
  className = '',
  contexto,
}: PropiedadesSelectorVariables) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const [abiertoInterno, setAbiertoInterno] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [entidadActiva, setEntidadActiva] = useState<string | null>(null)
  const [indiceActivo, setIndiceActivo] = useState(0)
  const refContenedor = useRef<HTMLDivElement>(null)
  const refPopover = useRef<HTMLDivElement>(null)
  const refBuscador = useRef<HTMLInputElement>(null)
  const refLista = useRef<HTMLDivElement>(null)
  const [posPopover, setPosPopover] = useState<{ top: number; left: number } | null>(null)

  const abierto = abiertoExterno !== undefined ? abiertoExterno : abiertoInterno

  const cerrar = useCallback(() => {
    setAbiertoInterno(false)
    setBusqueda('')
    setEntidadActiva(null)
    setIndiceActivo(0)
    onCerrar?.()
  }, [onCerrar])

  // Entidades disponibles
  const entidades = useMemo(() => obtenerEntidades(), [])

  // Resultados de búsqueda global
  const resultadosBusqueda = useMemo(() => {
    if (!busqueda.trim()) return null
    return buscarVariables(busqueda)
  }, [busqueda])

  // Variables de la entidad activa, agrupadas
  const gruposEntidadActiva = useMemo(() => {
    if (!entidadActiva) return []
    return obtenerVariablesAgrupadas(entidadActiva)
  }, [entidadActiva])

  // Lista plana de items navegables con teclado
  const itemsNavegables = useMemo(() => {
    if (resultadosBusqueda) {
      return resultadosBusqueda.map((r) => ({
        tipo: 'variable' as const,
        clave: r.clave_completa,
        variable: r.variable,
        entidad: r.entidad,
      }))
    }
    if (entidadActiva) {
      return gruposEntidadActiva.flatMap((g) =>
        g.variables.map((v) => ({
          tipo: 'variable' as const,
          clave: `${entidadActiva}.${v.clave}`,
          variable: v,
          entidad: obtenerEntidades().find((e) => e.clave === entidadActiva)!,
        }))
      )
    }
    return entidades.map((e) => ({
      tipo: 'entidad' as const,
      clave: e.clave,
      entidad: e,
    }))
  }, [resultadosBusqueda, entidadActiva, gruposEntidadActiva, entidades])

  // Reset índice al cambiar lista
  useEffect(() => {
    setIndiceActivo(0)
  }, [busqueda, entidadActiva])

  // Calcular posición del popover al abrir
  useEffect(() => {
    if (abierto && refContenedor.current) {
      const rect = refContenedor.current.getBoundingClientRect()
      const anchoPopover = 360
      const altoPopover = 400
      let top: number
      if (posicion === 'arriba') {
        top = rect.top - altoPopover - 8
        if (top < 8) top = rect.bottom + 8
      } else {
        top = rect.bottom + 8
        if (top + altoPopover > window.innerHeight - 8) top = rect.top - altoPopover - 8
      }
      let left = rect.right - anchoPopover
      if (left < 8) left = 8
      if (left + anchoPopover > window.innerWidth - 8) left = window.innerWidth - anchoPopover - 8
      setPosPopover({ top, left })
      setTimeout(() => refBuscador.current?.focus(), 50)
    }
  }, [abierto, posicion])

  // Cerrar al click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (refContenedor.current?.contains(target)) return
      if (refPopover.current?.contains(target)) return
      cerrar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto, cerrar])

  // Navegación con teclado
  const manejarTeclado = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setIndiceActivo((prev) => Math.min(prev + 1, itemsNavegables.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setIndiceActivo((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter': {
        e.preventDefault()
        const item = itemsNavegables[indiceActivo]
        if (!item) break
        if (item.tipo === 'entidad') {
          setEntidadActiva(item.clave)
          setBusqueda('')
        } else {
          onSeleccionar(`{{${item.clave}}}`)
          cerrar()
        }
        break
      }
      case 'Backspace':
        if (!busqueda && entidadActiva) {
          setEntidadActiva(null)
        }
        break
      case 'Escape':
        if (entidadActiva && !busqueda) {
          setEntidadActiva(null)
        } else {
          cerrar()
        }
        break
    }
  }, [itemsNavegables, indiceActivo, busqueda, entidadActiva, onSeleccionar, cerrar])

  // Scroll al item activo
  useEffect(() => {
    if (!refLista.current) return
    const itemActivo = refLista.current.querySelector(`[data-indice="${indiceActivo}"]`)
    itemActivo?.scrollIntoView({ block: 'nearest' })
  }, [indiceActivo])

  const seleccionarVariable = (claveEntidad: string, claveVariable: string) => {
    onSeleccionar(`{{${claveEntidad}.${claveVariable}}}`)
    cerrar()
  }

  // Obtener valor real de una variable desde el contexto
  const obtenerValorPreview = (claveEntidad: string, claveVariable: string): string | null => {
    if (!contexto) return null
    const datos = contexto[claveEntidad]
    if (!datos) return null
    const valor = datos[claveVariable]
    if (valor === undefined || valor === null || valor === '') return null
    return String(valor)
  }

  // ─── Renderizar una variable (resultado de búsqueda o listado) ───

  const renderizarVariable = (
    variable: DefinicionVariable,
    claveEntidad: string,
    entidad: DefinicionEntidad,
    indice: number,
    mostrarEntidad: boolean,
  ) => {
    const preview = obtenerValorPreview(claveEntidad, variable.clave)
    const activo = indice === indiceActivo

    return (
      <button
        key={`${claveEntidad}.${variable.clave}`}
        type="button"
        data-indice={indice}
        onClick={() => seleccionarVariable(claveEntidad, variable.clave)}
        className={[
          'flex flex-col gap-0.5 w-full px-3 py-2 text-left border-none cursor-pointer transition-colors duration-75',
          activo
            ? 'bg-superficie-seleccionada'
            : 'bg-transparent hover:bg-superficie-hover',
        ].join(' ')}
      >
        {/* Fila superior: etiqueta + badge entidad */}
        <div className="flex items-center gap-2 w-full">
          <span className={`text-sm font-medium flex-1 truncate ${activo ? 'text-texto-marca' : 'text-texto-primario'}`}>
            {variable.etiqueta}
          </span>
          {mostrarEntidad && (
            <span
              className="text-xxs px-1.5 py-0.5 rounded-full shrink-0 font-medium"
              style={{
                background: entidad.color ? `var(--seccion-${claveEntidad}, var(--superficie-hover))` : 'var(--superficie-hover)',
                color: 'var(--texto-secundario)',
              }}
            >
              {entidad.etiqueta}
            </span>
          )}
        </div>
        {/* Fila inferior: preview del valor real o la clave técnica */}
        <div className="flex items-center gap-2 w-full">
          {preview ? (
            <span className="text-xs truncate" style={{ color: 'var(--texto-marca)' }}>
              → {preview}
            </span>
          ) : (
            <span className="text-xs font-mono truncate" style={{ color: 'var(--texto-terciario)' }}>
              {`{{${claveEntidad}.${variable.clave}}}`}
            </span>
          )}
        </div>
      </button>
    )
  }

  // ─── Renderizar entidad (lista inicial) ───

  const renderizarEntidad = (entidad: DefinicionEntidad, indice: number) => {
    const activo = indice === indiceActivo
    // Contar cuántas variables tienen valor real en el contexto
    const tieneContexto = contexto?.[entidad.clave]
    const varsConValor = tieneContexto
      ? entidad.variables.filter(v => {
          const val = contexto[entidad.clave]?.[v.clave]
          return val !== undefined && val !== null && val !== ''
        }).length
      : 0

    return (
      <button
        key={entidad.clave}
        type="button"
        data-indice={indice}
        onClick={() => setEntidadActiva(entidad.clave)}
        className={[
          'flex items-center gap-3 w-full px-3 py-2.5 text-left border-none cursor-pointer transition-colors duration-75',
          activo
            ? 'bg-superficie-seleccionada'
            : 'bg-transparent hover:bg-superficie-hover',
        ].join(' ')}
      >
        <span className="shrink-0 flex items-center" style={{ color: activo ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}>
          {entidad.icono}
        </span>
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${activo ? 'text-texto-marca' : 'text-texto-primario'}`}>
            {entidad.etiqueta}
          </span>
          {tieneContexto && varsConValor > 0 && (
            <span className="text-xxs ml-1.5" style={{ color: 'var(--insignia-exito)' }}>
              {varsConValor} con datos
            </span>
          )}
        </div>
        <span className="text-xxs shrink-0" style={{ color: 'var(--texto-terciario)' }}>
          {entidad.variables.length}
        </span>
        <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--texto-terciario)' }} />
      </button>
    )
  }

  return (
    <div ref={refContenedor} className={`relative inline-block ${className}`}>
      {/* Botón trigger (solo si no se controla externamente) */}
      {abiertoExterno === undefined && (
        <Tooltip contenido="Insertar variable">
          <button
            type="button"
            onClick={() => setAbiertoInterno(!abiertoInterno)}
            className={[
              'flex items-center justify-center size-8 rounded-boton border transition-all duration-150 cursor-pointer',
              abierto
                ? 'border-borde-foco bg-superficie-seleccionada text-texto-marca'
                : 'border-borde-sutil bg-superficie-tarjeta text-texto-terciario hover:text-texto-secundario hover:border-borde-fuerte',
            ].join(' ')}
          >
            <Braces size={16} />
          </button>
        </Tooltip>
      )}

      {/* Popover — renderizado en portal para no ser cortado por overflow de padres */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && posPopover && (
            <motion.div
              ref={refPopover}
              initial={{ opacity: 0, y: posicion === 'arriba' ? 4 : -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: posicion === 'arriba' ? 4 : -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="fixed rounded-popover border border-borde-sutil shadow-elevada overflow-hidden"
              style={{
                zIndex: 'var(--z-modal, 9999)' as unknown as number,
                top: posPopover.top,
                left: posPopover.left,
                width: 360,
                ...(esCristal ? {
                  backgroundColor: 'var(--superficie-flotante)',
                  backdropFilter: 'blur(32px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
                } : {
                  backgroundColor: 'var(--superficie-elevada)',
                }),
              }}
            >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-borde-sutil">
              {/* Botón volver si hay entidad activa */}
              {entidadActiva && !resultadosBusqueda && (
                <button
                  type="button"
                  onClick={() => { setEntidadActiva(null); setBusqueda('') }}
                  className="flex items-center justify-center size-6 rounded-boton shrink-0 transition-colors hover:bg-superficie-hover"
                  style={{ color: 'var(--texto-terciario)' }}
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              {!entidadActiva && (
                <Search size={14} className="shrink-0" style={{ color: 'var(--texto-terciario)' }} />
              )}

              {/* Breadcrumb de entidad activa */}
              {entidadActiva && !resultadosBusqueda && (
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                >
                  {entidades.find((e) => e.clave === entidadActiva)?.etiqueta}
                </span>
              )}

              <input
                ref={refBuscador}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={manejarTeclado}
                placeholder={entidadActiva ? 'Filtrar...' : 'Buscar variable...'}
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-texto-placeholder"
                style={{ color: 'var(--texto-primario)' }}
              />

              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="shrink-0 p-0.5 rounded hover:bg-superficie-hover transition-colors"
                  style={{ color: 'var(--texto-terciario)' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Lista */}
            <div ref={refLista} className="max-h-80 overflow-y-auto">
              {/* Resultados de búsqueda global */}
              {resultadosBusqueda && (
                resultadosBusqueda.length > 0 ? (
                  <div className="py-1">
                    {resultadosBusqueda.map((resultado, i) =>
                      renderizarVariable(
                        resultado.variable,
                        resultado.entidad.clave,
                        resultado.entidad,
                        i,
                        true,
                      )
                    )}
                  </div>
                ) : (
                  <div className="px-3 py-8 text-center text-sm" style={{ color: 'var(--texto-terciario)' }}>
                    No se encontraron variables
                  </div>
                )
              )}

              {/* Lista de entidades (sin búsqueda, sin entidad activa) */}
              {!resultadosBusqueda && !entidadActiva && (
                <div className="py-1">
                  {entidades.length > 0 ? entidades.map((entidad, i) =>
                    renderizarEntidad(entidad, i)
                  ) : (
                    <div className="px-3 py-8 text-center text-sm" style={{ color: 'var(--texto-terciario)' }}>
                      No hay entidades registradas
                    </div>
                  )}
                </div>
              )}

              {/* Variables de la entidad activa, agrupadas */}
              {!resultadosBusqueda && entidadActiva && (
                <div className="py-1">
                  {gruposEntidadActiva.length > 0 ? (
                    gruposEntidadActiva.map((grupo) => {
                      let indiceBase = 0
                      for (const g of gruposEntidadActiva) {
                        if (g.clave === grupo.clave) break
                        indiceBase += g.variables.length
                      }
                      const entidad = entidades.find(e => e.clave === entidadActiva)!

                      return (
                        <div key={grupo.clave}>
                          {gruposEntidadActiva.length > 1 && (
                            <div className="px-3 pt-2 pb-1 text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                              {grupo.etiqueta}
                            </div>
                          )}
                          {grupo.variables.map((variable, i) =>
                            renderizarVariable(variable, entidadActiva, entidad, indiceBase + i, false)
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="px-3 py-8 text-center text-sm" style={{ color: 'var(--texto-terciario)' }}>
                      Esta entidad no tiene variables
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-3 py-1.5 border-t border-borde-sutil text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded text-texto-terciario font-mono" style={{ background: 'var(--superficie-hover)' }}>↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded text-texto-terciario font-mono" style={{ background: 'var(--superficie-hover)' }}>↵</kbd>
                seleccionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded text-texto-terciario font-mono" style={{ background: 'var(--superficie-hover)' }}>esc</kbd>
                cerrar
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  )
}

export { SelectorVariables, type PropiedadesSelectorVariables }

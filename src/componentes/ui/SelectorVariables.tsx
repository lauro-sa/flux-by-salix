'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Braces, ChevronRight } from 'lucide-react'
import { useTema } from '@/hooks/useTema'
import { obtenerEntidades, buscarVariables, obtenerVariablesAgrupadas } from '@/lib/variables/registro'
import type { DefinicionEntidad, DefinicionVariable } from '@/lib/variables/tipos'

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
}

/**
 * SelectorVariables — Popover para insertar variables dinámicas en campos de texto.
 * Muestra entidades como categorías con sus variables agrupadas.
 * Búsqueda global por nombre de variable, entidad o descripción.
 *
 * Se usa en: plantillas de documentos, emails, mensajes WhatsApp, notas con variables.
 */
function SelectorVariables({
  onSeleccionar,
  abierto: abiertoExterno,
  onCerrar,
  posicion = 'abajo',
  className = '',
}: PropiedadesSelectorVariables) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const [abiertoInterno, setAbiertoInterno] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [entidadActiva, setEntidadActiva] = useState<string | null>(null)
  const [indiceActivo, setIndiceActivo] = useState(0)
  const refContenedor = useRef<HTMLDivElement>(null)
  const refBuscador = useRef<HTMLInputElement>(null)
  const refLista = useRef<HTMLDivElement>(null)

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

  // Focus en buscador al abrir
  useEffect(() => {
    if (abierto) {
      setTimeout(() => refBuscador.current?.focus(), 50)
    }
  }, [abierto])

  // Cerrar al click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (refContenedor.current && !refContenedor.current.contains(e.target as Node)) {
        cerrar()
      }
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

  // Renderizar una variable individual
  const renderizarVariable = (
    variable: DefinicionVariable,
    claveEntidad: string,
    indice: number,
    mostrarEntidad?: string,
  ) => (
    <button
      key={`${claveEntidad}.${variable.clave}`}
      type="button"
      data-indice={indice}
      onClick={() => seleccionarVariable(claveEntidad, variable.clave)}
      className={[
        'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left border-none cursor-pointer transition-colors duration-75',
        indice === indiceActivo
          ? 'bg-superficie-seleccionada text-texto-marca'
          : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
      ].join(' ')}
    >
      <code className="text-xs font-mono text-texto-terciario bg-superficie-hover px-1 py-0.5 rounded shrink-0">
        {variable.clave}
      </code>
      <span className="flex-1 truncate">{variable.etiqueta}</span>
      {mostrarEntidad && (
        <span className="text-xs text-texto-terciario shrink-0">{mostrarEntidad}</span>
      )}
      {variable.origen === 'calculado' && (
        <span className="text-xxs text-texto-terciario bg-superficie-hover px-1 rounded">calc</span>
      )}
    </button>
  )

  return (
    <div ref={refContenedor} className={`relative inline-block ${className}`}>
      {/* Botón trigger (solo si no se controla externamente) */}
      {abiertoExterno === undefined && (
        <button
          type="button"
          onClick={() => setAbiertoInterno(!abiertoInterno)}
          title="Insertar variable"
          className={[
            'flex items-center justify-center size-8 rounded-md border transition-all duration-150 cursor-pointer',
            abierto
              ? 'border-borde-foco bg-superficie-seleccionada text-texto-marca'
              : 'border-borde-sutil bg-superficie-tarjeta text-texto-terciario hover:text-texto-secundario hover:border-borde-fuerte',
          ].join(' ')}
        >
          <Braces size={16} />
        </button>
      )}

      {/* Popover */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: posicion === 'arriba' ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: posicion === 'arriba' ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={[
              'absolute z-50 w-80 rounded-lg border border-borde-sutil shadow-lg overflow-hidden',
              posicion === 'arriba' ? 'bottom-full mb-2' : 'top-full mt-2',
              'left-0',
            ].join(' ')}
            style={esCristal ? {
              backgroundColor: 'var(--superficie-flotante)',
              backdropFilter: 'blur(32px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
            } : {
              backgroundColor: 'var(--superficie-elevada)',
            }}
          >
            {/* Header con buscador */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-borde-sutil">
              <Search size={14} className="text-texto-terciario shrink-0" />

              {/* Breadcrumb de entidad activa */}
              {entidadActiva && !resultadosBusqueda && (
                <button
                  type="button"
                  onClick={() => { setEntidadActiva(null); setBusqueda('') }}
                  className="flex items-center gap-1 text-xs text-texto-marca bg-superficie-seleccionada px-1.5 py-0.5 rounded cursor-pointer border-none shrink-0 hover:bg-superficie-hover transition-colors"
                >
                  {entidades.find((e) => e.clave === entidadActiva)?.etiqueta}
                  <X size={10} />
                </button>
              )}

              <input
                ref={refBuscador}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={manejarTeclado}
                placeholder={entidadActiva ? 'Filtrar variables...' : 'Buscar variable...'}
                className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-terciario"
              />

              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="text-texto-terciario hover:text-texto-secundario bg-transparent border-none cursor-pointer p-0"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Lista */}
            <div ref={refLista} className="max-h-72 overflow-y-auto">
              {/* Resultados de búsqueda global */}
              {resultadosBusqueda && (
                resultadosBusqueda.length > 0 ? (
                  <div className="py-1">
                    {resultadosBusqueda.map((resultado, i) =>
                      renderizarVariable(
                        resultado.variable,
                        resultado.entidad.clave,
                        i,
                        resultado.entidad.etiqueta,
                      )
                    )}
                  </div>
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-texto-terciario">
                    No se encontraron variables
                  </div>
                )
              )}

              {/* Lista de entidades (sin búsqueda, sin entidad activa) */}
              {!resultadosBusqueda && !entidadActiva && (
                <div className="py-1">
                  {entidades.length > 0 ? entidades.map((entidad, i) => (
                    <button
                      key={entidad.clave}
                      type="button"
                      data-indice={i}
                      onClick={() => setEntidadActiva(entidad.clave)}
                      className={[
                        'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left border-none cursor-pointer transition-colors duration-75',
                        i === indiceActivo
                          ? 'bg-superficie-seleccionada text-texto-marca'
                          : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                      ].join(' ')}
                    >
                      <span className="shrink-0 flex items-center text-texto-terciario">
                        {entidad.icono}
                      </span>
                      <span className="flex-1 font-medium">{entidad.etiqueta}</span>
                      <span className="text-xs text-texto-terciario">
                        {entidad.variables.length} var
                      </span>
                      <ChevronRight size={14} className="text-texto-terciario shrink-0" />
                    </button>
                  )) : (
                    <div className="px-3 py-6 text-center text-sm text-texto-terciario">
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
                      // Calcular índice base para este grupo
                      let indiceBase = 0
                      for (const g of gruposEntidadActiva) {
                        if (g.clave === grupo.clave) break
                        indiceBase += g.variables.length
                      }

                      return (
                        <div key={grupo.clave}>
                          {gruposEntidadActiva.length > 1 && (
                            <div className="px-3 py-1 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">
                              {grupo.etiqueta}
                            </div>
                          )}
                          {grupo.variables.map((variable, i) =>
                            renderizarVariable(variable, entidadActiva, indiceBase + i)
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="px-3 py-6 text-center text-sm text-texto-terciario">
                      Esta entidad no tiene variables
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer con ayuda */}
            <div className="flex items-center gap-3 px-3 py-1.5 border-t border-borde-sutil text-xxs text-texto-terciario">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-superficie-hover text-texto-terciario font-mono">↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-superficie-hover text-texto-terciario font-mono">↵</kbd>
                seleccionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-superficie-hover text-texto-terciario font-mono">esc</kbd>
                cerrar
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { SelectorVariables, type PropiedadesSelectorVariables }

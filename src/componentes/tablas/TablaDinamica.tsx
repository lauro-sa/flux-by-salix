'use client'

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Search, X, Check, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  GripVertical, Pin, PinOff, Columns3, RotateCcw, Eye, EyeOff,
  SlidersHorizontal, Bookmark, BookmarkPlus, MoreHorizontal, ArrowUpDown,
  List, LayoutGrid, Rows3, Minus, Plus, ChevronsLeft, ChevronsRight,
  AlignJustify, StretchHorizontal, Star,
} from 'lucide-react'
import { usePreferencias, type ConfigTabla } from '@/hooks/usePreferencias'
import {
  useVistasGuardadas, useDetectorVistas,
  type EstadoVistaDatos, type VistaGuardada, type EstadoDetector,
} from '@/hooks/useVistasGuardadas'

/* ════════════════════════════════════════════
   Tipos
   ════════════════════════════════════════════ */

/** Tipo de dato de la columna — usado para cálculos del resumen */
type TipoDato = 'texto' | 'numero' | 'fecha' | 'moneda' | 'booleano'

/** Tipo de cálculo para el pie de tabla */
type TipoCalculo = 'conteo' | 'suma' | 'promedio' | 'min' | 'max' | 'ninguno'

/** Dirección de ordenamiento */
type DireccionOrden = 'asc' | 'desc'

/** Vistas disponibles */
type TipoVista = 'lista' | 'tarjetas'

/** Configuración de una columna */
interface ColumnaDinamica<T> {
  clave: string
  etiqueta: string
  ancho?: number
  anchoMinimo?: number
  render?: (fila: T) => ReactNode
  ordenable?: boolean
  tipo?: TipoDato
  obtenerValor?: (fila: T) => string | number | Date | boolean
  resumen?: TipoCalculo
  alineacion?: 'left' | 'center' | 'right'
  /** Si true, esta columna genera un filtro automático en la barra de la tabla */
  filtrable?: boolean
  /** Tipo de filtro a generar: seleccion (default), multiple, o fecha */
  tipoFiltro?: 'seleccion' | 'multiple' | 'fecha'
  /** Opciones del filtro (requerido para seleccion/multiple, ignorado en fecha) */
  opcionesFiltro?: { valor: string; etiqueta: string }[]
}

/** Estado visual de la tabla */
interface OpcionesVisuales {
  mostrarDivisores: boolean
  filasAlternas: boolean
  bordesColumnas: boolean
}

/* VistaGuardada y EstadoVistaDatos se importan de useVistasGuardadas */

/** Filtro reutilizable (compatible con BarraBusqueda) */
interface FiltroTabla {
  id: string
  etiqueta: string
  icono?: ReactNode
  tipo: 'seleccion' | 'multiple' | 'fecha'
  valor: string | string[]
  onChange: (valor: string | string[]) => void
  opciones?: { valor: string; etiqueta: string }[]
}

/** Acción en lote */
interface AccionLote {
  id: string
  etiqueta: string
  icono?: ReactNode
  onClick: (ids: Set<string>) => void
  peligro?: boolean
}

/** Props principales del componente */
interface PropiedadesTablaDinamica<T> {
  /* Datos */
  columnas: ColumnaDinamica<T>[]
  datos: T[]
  claveFila: (fila: T) => string
  totalRegistros?: number

  /* Vistas */
  vistas?: TipoVista[]
  vistaInicial?: TipoVista

  /* Tarjetas */
  renderTarjeta?: (fila: T) => ReactNode

  /* Paginación */
  registrosPorPagina?: number

  /* Selección */
  seleccionables?: boolean

  /* Búsqueda */
  busqueda?: string
  onBusqueda?: (texto: string) => void
  placeholder?: string

  /* Filtros */
  filtros?: FiltroTabla[]
  onLimpiarFiltros?: () => void

  /* Acciones en lote (el botón de acción principal va en el cabecero de la página, fuera de la tabla) */
  accionesLote?: AccionLote[]

  /* Eventos */
  onClickFila?: (fila: T) => void

  /* Resumen / calculador */
  mostrarResumen?: boolean

  /* Estado vacío personalizado — se muestra cuando no hay datos */
  estadoVacio?: ReactNode

  /** ID del módulo para persistir config por usuario+dispositivo (ej: 'usuarios', 'contactos') */
  idModulo?: string

  className?: string
}

/* ════════════════════════════════════════════
   Constantes
   ════════════════════════════════════════════ */

const ANCHO_MINIMO_COLUMNA = 80
const ANCHO_DEFAULT_COLUMNA = 150
const REGISTROS_POR_PAGINA_DEFAULT = 50

/* ════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════ */

/** Obtiene el valor de una celda para ordenamiento/cálculo */
function obtenerValorCelda<T>(fila: T, columna: ColumnaDinamica<T>): string | number | Date | boolean {
  if (columna.obtenerValor) return columna.obtenerValor(fila)
  const valor = (fila as Record<string, unknown>)[columna.clave]
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor
  if (valor instanceof Date) return valor
  return String(valor)
}

/** Compara dos valores para ordenamiento */
function compararValores(a: unknown, b: unknown, direccion: DireccionOrden): number {
  const mul = direccion === 'asc' ? 1 : -1
  if (a === b) return 0
  if (a === '' || a === null || a === undefined) return 1
  if (b === '' || b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * mul
  if (a instanceof Date && b instanceof Date) return (a.getTime() - b.getTime()) * mul
  return String(a).localeCompare(String(b), 'es') * mul
}

/** Formatea un número para mostrar */
function formatearNumero(n: number): string {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

/** Calcula un resumen sobre un arreglo de valores numéricos */
function calcularResumen(valores: number[], tipo: TipoCalculo): string {
  if (valores.length === 0) return '—'
  switch (tipo) {
    case 'conteo': return formatearNumero(valores.length)
    case 'suma': return formatearNumero(valores.reduce((a, b) => a + b, 0))
    case 'promedio': return formatearNumero(valores.reduce((a, b) => a + b, 0) / valores.length)
    case 'min': return formatearNumero(Math.min(...valores))
    case 'max': return formatearNumero(Math.max(...valores))
    default: return '—'
  }
}

/* ════════════════════════════════════════════
   Sub-componente: Panel de columnas
   ════════════════════════════════════════════ */

interface PropsPanelColumnas<T> {
  columnas: ColumnaDinamica<T>[]
  columnasVisibles: string[]
  ordenColumnas: string[]
  columnasAncladas: string[]
  opcionesVisuales: OpcionesVisuales
  onToggleColumna: (clave: string) => void
  onReordenar: (nuevo: string[]) => void
  onToggleAnclar: (clave: string) => void
  onCambiarOpcionVisual: (opcion: keyof OpcionesVisuales) => void
  onRestablecer: () => void
  onAjustarAnchosAuto: () => void
  onCerrar: () => void
}

function PanelColumnas<T>({
  columnas,
  columnasVisibles,
  ordenColumnas,
  columnasAncladas,
  opcionesVisuales,
  onToggleColumna,
  onReordenar,
  onToggleAnclar,
  onCambiarOpcionVisual,
  onRestablecer,
  onAjustarAnchosAuto,
  onCerrar,
}: PropsPanelColumnas<T>) {
  /* Mapa para buscar rápido */
  const mapaColumnas = useMemo(() => {
    const m = new Map<string, ColumnaDinamica<T>>()
    columnas.forEach((c) => m.set(c.clave, c))
    return m
  }, [columnas])

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', duration: 0.25 }}
      className="fixed top-0 right-0 h-full w-[320px] bg-superficie-elevada border-l border-borde-sutil shadow-2xl z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil shrink-0">
        <span className="text-sm font-semibold text-texto-primario">Configurar columnas</span>
        <button
          type="button"
          onClick={onCerrar}
          className="size-7 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
        {/* Lista reordenable de columnas */}
        <Reorder.Group axis="y" values={ordenColumnas} onReorder={onReordenar} className="flex flex-col gap-0.5">
          {ordenColumnas.map((clave) => {
            const col = mapaColumnas.get(clave)
            if (!col) return null
            const visible = columnasVisibles.includes(clave)
            const anclada = columnasAncladas.includes(clave)

            return (
              <Reorder.Item
                key={clave}
                value={clave}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-superficie-hover group cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={14} className="text-texto-terciario opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />

                {/* Toggle visibilidad */}
                <button
                  type="button"
                  onClick={() => onToggleColumna(clave)}
                  className="shrink-0 size-5 inline-flex items-center justify-center rounded border border-borde-sutil cursor-pointer bg-transparent transition-colors"
                  style={visible ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' } : {}}
                >
                  {visible && <Check size={10} className="text-texto-inverso" />}
                </button>

                {/* Nombre */}
                <span className={`flex-1 text-sm truncate ${visible ? 'text-texto-primario' : 'text-texto-terciario line-through'}`}>
                  {col.etiqueta}
                </span>

                {/* Pin */}
                <button
                  type="button"
                  onClick={() => onToggleAnclar(clave)}
                  className={`shrink-0 size-6 inline-flex items-center justify-center rounded cursor-pointer border-none bg-transparent transition-colors ${
                    anclada
                      ? 'text-texto-marca'
                      : 'text-texto-terciario opacity-0 group-hover:opacity-100'
                  }`}
                  title={anclada ? 'Desanclar' : 'Anclar columna'}
                >
                  {anclada ? <PinOff size={12} /> : <Pin size={12} />}
                </button>
              </Reorder.Item>
            )
          })}
        </Reorder.Group>
      </div>

      {/* Separador */}
      <div className="border-t border-borde-sutil" />

      {/* Opciones visuales */}
      <div className="p-3 flex flex-col gap-2">
        <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Opciones visuales</span>

        {([
          { clave: 'mostrarDivisores' as const, etiqueta: 'Divisores entre filas' },
          { clave: 'filasAlternas' as const, etiqueta: 'Filas alternas' },
          { clave: 'bordesColumnas' as const, etiqueta: 'Bordes de columnas' },
        ]).map((op) => (
          <div
            key={op.clave}
            onClick={() => onCambiarOpcionVisual(op.clave)}
            className="flex items-center gap-2 cursor-pointer select-none py-0.5"
          >
            <div
              className="shrink-0 size-5 inline-flex items-center justify-center rounded border border-borde-sutil transition-colors"
              style={opcionesVisuales[op.clave] ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' } : {}}
            >
              {opcionesVisuales[op.clave] && <Check size={10} className="text-texto-inverso" />}
            </div>
            <span className="text-sm text-texto-primario">{op.etiqueta}</span>
          </div>
        ))}
      </div>

      {/* Acciones — fijas abajo del sidebar */}
      <div className="shrink-0 border-t border-borde-sutil p-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={onAjustarAnchosAuto}
          className="flex items-center gap-2 px-2 py-1.5 text-sm text-texto-primario rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent w-full text-left transition-colors"
        >
          <StretchHorizontal size={14} className="text-texto-terciario" />
          Ajustar anchos automático
        </button>
        <button
          type="button"
          onClick={onRestablecer}
          className="flex items-center gap-2 px-2 py-1.5 text-sm text-insignia-peligro-texto rounded hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent w-full text-left transition-colors"
        >
          <RotateCcw size={14} />
          Restablecer columnas
        </button>
      </div>
    </motion.div>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Panel de filtros
   ════════════════════════════════════════════ */

function PanelFiltrosTabla({
  filtros,
  onLimpiarFiltros,
  vistasGuardadas,
  detector,
  onAplicarVista,
  onGuardarVista,
  onEliminarVista,
  onSobrescribirVista,
  onMarcarPredefinida,
}: {
  filtros: FiltroTabla[]
  onLimpiarFiltros?: () => void
  vistasGuardadas?: VistaGuardada[]
  detector?: { tipo: EstadoDetector; vistaActiva: VistaGuardada | null }
  onAplicarVista?: (id: string) => void
  onGuardarVista?: (nombre: string) => void
  onEliminarVista?: (id: string) => void
  onSobrescribirVista?: (id: string) => void
  onMarcarPredefinida?: (id: string) => void
}) {
  const [nombreNueva, setNombreNueva] = useState('')
  const [creandoVista, setCreandoVista] = useState(false)
  const [busquedaOpciones, setBusquedaOpciones] = useState<Record<string, string>>({})

  const numActivos = filtros.filter((f) => {
    if (Array.isArray(f.valor)) return f.valor.length > 0
    return f.valor !== ''
  }).length

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', duration: 0.3 }}
      className="absolute top-full left-0 right-0 mt-2 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 overflow-hidden"
    >
      <div className="max-h-[420px] overflow-y-auto p-3 flex flex-col gap-3">
        {/* Filtros */}
        {filtros.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Filtros</span>
              {numActivos > 0 && onLimpiarFiltros && (
                <button
                  type="button"
                  onClick={onLimpiarFiltros}
                  className="text-xs text-insignia-peligro-texto bg-insignia-peligro-fondo px-2 py-0.5 rounded-full cursor-pointer border-none font-medium"
                >
                  Limpiar ({numActivos})
                </button>
              )}
            </div>
            {filtros.map((filtro) => (
              <div key={filtro.id} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-texto-secundario flex items-center gap-1.5">
                  {filtro.icono && <span className="shrink-0">{filtro.icono}</span>}
                  {filtro.etiqueta}
                </span>

                {/* Selección simple */}
                {filtro.tipo === 'seleccion' && filtro.opciones && (
                  <div className="flex flex-col">
                    {filtro.opciones.length > 8 && (
                      <input
                        type="text"
                        value={busquedaOpciones[filtro.id] || ''}
                        onChange={(e) => setBusquedaOpciones({ ...busquedaOpciones, [filtro.id]: e.target.value })}
                        placeholder="Buscar..."
                        className="mb-1 px-2 py-1 rounded border border-borde-sutil bg-superficie-tarjeta text-xs text-texto-primario placeholder:text-texto-terciario outline-none focus:border-borde-foco"
                      />
                    )}
                    <div className="max-h-40 overflow-y-auto flex flex-col">
                      {filtro.opciones
                        .filter((op) => {
                          const bq = busquedaOpciones[filtro.id]?.toLowerCase()
                          return !bq || op.etiqueta.toLowerCase().includes(bq)
                        })
                        .map((op) => (
                          <button
                            key={op.valor}
                            type="button"
                            onClick={() => filtro.onChange(op.valor === filtro.valor ? '' : op.valor)}
                            className={[
                              'flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded cursor-pointer transition-colors duration-100 border-none',
                              op.valor === filtro.valor
                                ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                                : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                            ].join(' ')}
                          >
                            <span className="flex-1">{op.etiqueta}</span>
                            {op.valor === filtro.valor && <Check size={14} />}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Selección múltiple */}
                {filtro.tipo === 'multiple' && filtro.opciones && (
                  <div className="flex flex-col">
                    {Array.isArray(filtro.valor) && filtro.valor.length > 0 && (
                      <button
                        type="button"
                        onClick={() => filtro.onChange([])}
                        className="self-start text-xs text-insignia-peligro-texto bg-insignia-peligro-fondo px-2 py-0.5 rounded-full mb-1 cursor-pointer border-none font-medium"
                      >
                        Limpiar ({(filtro.valor as string[]).length})
                      </button>
                    )}
                    <div className="max-h-40 overflow-y-auto flex flex-col">
                      {filtro.opciones.map((op) => {
                        const seleccionado = Array.isArray(filtro.valor) && filtro.valor.includes(op.valor)
                        return (
                          <button
                            key={op.valor}
                            type="button"
                            onClick={() => {
                              const actual = Array.isArray(filtro.valor) ? filtro.valor : []
                              filtro.onChange(seleccionado ? actual.filter((v) => v !== op.valor) : [...actual, op.valor])
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded cursor-pointer transition-colors duration-100 border-none bg-transparent text-texto-primario hover:bg-superficie-hover"
                          >
                            <span
                              className="inline-flex items-center justify-center size-4 rounded border transition-colors"
                              style={seleccionado ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' } : { borderColor: 'var(--borde-fuerte)' }}
                            >
                              {seleccionado && <Check size={10} className="text-texto-inverso" />}
                            </span>
                            <span className="flex-1">{op.etiqueta}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Fecha */}
                {filtro.tipo === 'fecha' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={typeof filtro.valor === 'string' ? filtro.valor : ''}
                      onChange={(e) => filtro.onChange(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded border border-borde-sutil bg-superficie-tarjeta text-xs text-texto-primario outline-none focus:border-borde-foco"
                    />
                    {filtro.valor && (
                      <button
                        type="button"
                        onClick={() => filtro.onChange('')}
                        className="size-6 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Vistas guardadas */}
        {vistasGuardadas && vistasGuardadas.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="border-t border-borde-sutil" />
            <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Vistas guardadas</span>
            {vistasGuardadas.map((v) => {
              const esActiva = detector?.vistaActiva?.id === v.id
              return (
                <div
                  key={v.id}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-superficie-hover transition-colors"
                  onClick={() => onAplicarVista?.(v.id)}
                >
                  <Bookmark size={14} className={esActiva ? 'text-texto-marca fill-current' : 'text-texto-terciario'} />
                  <span className={`flex-1 text-sm ${esActiva ? 'font-semibold text-texto-marca' : 'text-texto-primario'}`}>
                    {v.nombre}
                  </span>
                  {v.predefinida && <Star size={12} className="text-texto-marca fill-current shrink-0" />}
                  {esActiva && <Check size={14} className="text-texto-marca" />}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                    {onMarcarPredefinida && !v.predefinida && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMarcarPredefinida(v.id) }}
                        className="size-5 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-marca transition-colors"
                        title="Marcar como predefinida"
                      >
                        <Star size={12} />
                      </button>
                    )}
                    {onEliminarVista && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEliminarVista(v.id) }}
                        className="size-5 inline-flex items-center justify-center rounded hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent text-texto-terciario hover:text-insignia-peligro-texto transition-colors"
                        title="Eliminar vista"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Sobrescribir vista existente — cuando hay cambios sin guardar y hay vistas */}
        {detector?.tipo === 'sin_guardar' && vistasGuardadas && vistasGuardadas.length > 0 && onSobrescribirVista && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-texto-terciario">Sobrescribir vista:</span>
            <div className="flex flex-wrap gap-1">
              {vistasGuardadas.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSobrescribirVista(v.id)}
                  className="text-xs px-2 py-1 rounded border border-borde-sutil bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover cursor-pointer transition-colors"
                >
                  {v.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Guardar como vista nueva — solo cuando NO es estado default */}
        {onGuardarVista && detector?.tipo !== 'default' && (
          <div className="flex flex-col gap-1.5">
            {!creandoVista ? (
              <button
                type="button"
                onClick={() => setCreandoVista(true)}
                className="flex items-center gap-1.5 text-sm text-texto-marca font-medium cursor-pointer border-none bg-transparent p-0 text-left hover:underline"
              >
                <BookmarkPlus size={14} />
                Guardar como vista nueva
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={nombreNueva}
                  onChange={(e) => setNombreNueva(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nombreNueva.trim()) {
                      onGuardarVista(nombreNueva.trim())
                      setNombreNueva('')
                      setCreandoVista(false)
                    }
                    if (e.key === 'Escape') {
                      setNombreNueva('')
                      setCreandoVista(false)
                    }
                  }}
                  placeholder="Nombre de la vista..."
                  className="flex-1 px-2 py-1 rounded border border-borde-foco bg-superficie-tarjeta text-xs text-texto-primario placeholder:text-texto-terciario outline-none"
                />
                <button
                  type="button"
                  disabled={!nombreNueva.trim()}
                  onClick={() => {
                    if (nombreNueva.trim()) {
                      onGuardarVista(nombreNueva.trim())
                      setNombreNueva('')
                      setCreandoVista(false)
                    }
                  }}
                  className="text-sm font-medium text-texto-marca cursor-pointer border-none bg-transparent disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Paginador
   ════════════════════════════════════════════ */

function Paginador({
  paginaActual,
  totalPaginas,
  registroInicio,
  registroFin,
  totalRegistros,
  onCambiarPagina,
}: {
  paginaActual: number
  totalPaginas: number
  registroInicio: number
  registroFin: number
  totalRegistros: number
  onCambiarPagina: (pagina: number) => void
}) {
  /* Estado para el comportamiento "click centro = última, otro click = primera" */
  const [ultimoClickCentro, setUltimoClickCentro] = useState(false)

  const irAnterior = () => {
    if (paginaActual > 1) onCambiarPagina(paginaActual - 1)
    setUltimoClickCentro(false)
  }

  const irSiguiente = () => {
    if (paginaActual < totalPaginas) onCambiarPagina(paginaActual + 1)
    setUltimoClickCentro(false)
  }

  const clickCentro = () => {
    if (ultimoClickCentro) {
      onCambiarPagina(1)
      setUltimoClickCentro(false)
    } else {
      onCambiarPagina(totalPaginas)
      setUltimoClickCentro(true)
    }
  }

  if (totalPaginas <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-borde-sutil">
      {/* Info */}
      <span className="text-xs text-texto-terciario">
        {registroInicio}–{registroFin} de {totalRegistros.toLocaleString('es')}
      </span>

      {/* Controles */}
      <div className="flex items-center gap-1">
        {/* Primera página */}
        <button
          type="button"
          onClick={() => { onCambiarPagina(1); setUltimoClickCentro(false) }}
          disabled={paginaActual === 1}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Primera página"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Anterior */}
        <button
          type="button"
          onClick={irAnterior}
          disabled={paginaActual === 1}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Anterior"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Indicador central clickeable */}
        <button
          type="button"
          onClick={clickCentro}
          className="px-3 py-1 rounded text-xs font-medium text-texto-primario hover:bg-superficie-hover cursor-pointer border-none bg-transparent transition-colors"
          title={ultimoClickCentro ? 'Ir a la primera página' : 'Ir a la última página'}
        >
          {paginaActual} / {totalPaginas}
        </button>

        {/* Siguiente */}
        <button
          type="button"
          onClick={irSiguiente}
          disabled={paginaActual === totalPaginas}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Siguiente"
        >
          <ChevronRight size={14} />
        </button>

        {/* Última página */}
        <button
          type="button"
          onClick={() => { onCambiarPagina(totalPaginas); setUltimoClickCentro(true) }}
          disabled={paginaActual === totalPaginas}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Última página"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Pie de tabla (calculador)
   ════════════════════════════════════════════ */

/** Ciclo de tipos de cálculo al hacer click */
const CICLO_CALCULO: TipoCalculo[] = ['conteo', 'suma', 'promedio', 'min', 'max', 'ninguno']

/** PieResumenFila — renderiza como <tr> para vivir dentro de <tfoot> */
function PieResumenFila<T>({
  columnas,
  datos,
  columnasVisibles,
  columnasAncladas,
  anchoColumnas,
  seleccionables,
  opcionesVisuales,
  offsetAncladas,
}: {
  columnas: ColumnaDinamica<T>[]
  datos: T[]
  columnasVisibles: string[]
  columnasAncladas: string[]
  anchoColumnas: Record<string, number>
  seleccionables: boolean
  opcionesVisuales: OpcionesVisuales
  offsetAncladas: Record<string, number>
}) {
  const [overrides, setOverrides] = useState<Record<string, TipoCalculo>>({})

  const ciclarCalculo = (clave: string, tipoActual: TipoCalculo) => {
    const idx = CICLO_CALCULO.indexOf(tipoActual)
    const siguiente = CICLO_CALCULO[(idx + 1) % CICLO_CALCULO.length]
    setOverrides(prev => ({ ...prev, [clave]: siguiente }))
  }

  return (
    <tr className="border-t-2 border-borde-fuerte">
      {/* Celda del checkbox */}
      {seleccionables && <td className="w-10 min-w-10 px-2.5 py-2 sticky left-0 z-10" style={{ background: 'var(--superficie-activa)' }} />}

      {columnasVisibles.map((clave) => {
        const col = columnas.find((c) => c.clave === clave)
        if (!col) return null
        const ancho = anchoColumnas[clave] || col.ancho || ANCHO_DEFAULT_COLUMNA
        const anclada = columnasAncladas.includes(clave)

        const tipoCalculo: TipoCalculo = overrides[clave]
          || col.resumen
          || (col.tipo === 'numero' || col.tipo === 'moneda' ? 'suma' : 'conteo')

        let contenido: ReactNode = null
        if (tipoCalculo !== 'ninguno') {
          const valores = datos
            .map((fila) => {
              const v = obtenerValorCelda(fila, col)
              return typeof v === 'number' ? v : parseFloat(String(v))
            })
            .filter((v) => !isNaN(v))

          const etiquetaCalculo = tipoCalculo === 'conteo' ? 'Conteo'
            : tipoCalculo === 'suma' ? 'Suma'
            : tipoCalculo === 'promedio' ? 'Promedio'
            : tipoCalculo === 'min' ? 'Mínimo'
            : tipoCalculo === 'max' ? 'Máximo'
            : ''

          const valorCalculado = tipoCalculo === 'conteo'
            ? datos.length
            : calcularResumen(valores, tipoCalculo)

          contenido = (
            <div className="flex flex-col">
              <span className="text-[10px] text-texto-terciario uppercase leading-tight">{etiquetaCalculo}</span>
              <span className="text-xs font-semibold text-texto-primario">{valorCalculado}</span>
            </div>
          )
        } else {
          contenido = <span className="text-[10px] text-texto-terciario/40">—</span>
        }

        return (
          <td
            key={clave}
            onClick={() => ciclarCalculo(clave, tipoCalculo)}
            className={[
              'px-4 py-2 cursor-pointer hover:bg-superficie-hover/50 transition-colors select-none',
              anclada ? 'sticky z-10 border-r-2 border-r-borde-fuerte' : '',
              opcionesVisuales.bordesColumnas && !anclada ? 'border-r border-borde-sutil last:border-r-0' : '',
            ].join(' ')}
            style={{
              width: ancho,
              minWidth: col.anchoMinimo || ANCHO_MINIMO_COLUMNA,
              textAlign: col.alineacion || 'left',
              ...(anclada ? { left: offsetAncladas[clave], background: 'var(--superficie-activa)' } : {}),
            }}
            title="Click para cambiar cálculo"
          >
            {contenido}
          </td>
        )
      })}
    </tr>
  )
}

/** PieResumen original — se mantiene por compatibilidad pero ya no se usa directamente */
function PieResumen<T>({
  columnas,
  datos,
  columnasVisibles,
  columnasAncladas,
  anchoColumnas,
  seleccionables,
  opcionesVisuales,
}: {
  columnas: ColumnaDinamica<T>[]
  datos: T[]
  columnasVisibles: string[]
  columnasAncladas: string[]
  anchoColumnas: Record<string, number>
  seleccionables: boolean
  opcionesVisuales: OpcionesVisuales
}) {
  // Estado local: override de cálculo por columna (click para ciclar)
  const [overrides, setOverrides] = useState<Record<string, TipoCalculo>>({})

  const ciclarCalculo = (clave: string, tipoActual: TipoCalculo) => {
    const idx = CICLO_CALCULO.indexOf(tipoActual)
    const siguiente = CICLO_CALCULO[(idx + 1) % CICLO_CALCULO.length]
    setOverrides(prev => ({ ...prev, [clave]: siguiente }))
  }

  return (
    <div className="border-t-2 border-borde-fuerte bg-superficie-anclada">
      <div className="flex" style={{ minWidth: 'max-content' }}>
        {/* Espacio del checkbox */}
        {seleccionables && <div className="w-11 shrink-0 px-3 py-2" />}

        {/* Celdas — todas las columnas, con cálculo clickeable */}
        {columnasVisibles.map((clave) => {
          const col = columnas.find((c) => c.clave === clave)
          if (!col) return null
          const ancho = anchoColumnas[clave] || col.ancho || ANCHO_DEFAULT_COLUMNA
          const anclada = columnasAncladas.includes(clave)

          // Determinar tipo de cálculo: override > definido en columna > default
          const tipoCalculo: TipoCalculo = overrides[clave]
            || col.resumen
            || (col.tipo === 'numero' || col.tipo === 'moneda' ? 'suma' : 'conteo')

          // Calcular
          let contenido: ReactNode = null
          if (tipoCalculo !== 'ninguno') {
            const valores = datos
              .map((fila) => {
                const v = obtenerValorCelda(fila, col)
                return typeof v === 'number' ? v : parseFloat(String(v))
              })
              .filter((v) => !isNaN(v))

            const etiquetaCalculo = tipoCalculo === 'conteo' ? 'Conteo'
              : tipoCalculo === 'suma' ? 'Suma'
              : tipoCalculo === 'promedio' ? 'Promedio'
              : tipoCalculo === 'min' ? 'Mínimo'
              : tipoCalculo === 'max' ? 'Máximo'
              : ''

            const valorCalculado = tipoCalculo === 'conteo'
              ? datos.length
              : calcularResumen(valores, tipoCalculo)

            contenido = (
              <div className="flex flex-col">
                <span className="text-[10px] text-texto-terciario uppercase leading-tight">{etiquetaCalculo}</span>
                <span className="text-xs font-semibold text-texto-primario">{valorCalculado}</span>
              </div>
            )
          } else {
            contenido = (
              <span className="text-[10px] text-texto-terciario/40 uppercase">—</span>
            )
          }

          return (
            <div
              key={clave}
              onClick={() => ciclarCalculo(clave, tipoCalculo)}
              className={[
                'px-4 py-2 shrink-0 cursor-pointer hover:bg-superficie-hover/50 transition-colors select-none',
                anclada ? 'sticky left-0 z-10 bg-superficie-anclada border-r-2 border-r-borde-fuerte' : '',
                opcionesVisuales.bordesColumnas ? 'border-r border-borde-sutil last:border-r-0' : '',
              ].join(' ')}
              style={{ width: ancho, minWidth: col.anchoMinimo || ANCHO_MINIMO_COLUMNA, textAlign: col.alineacion || 'left' }}
              title="Click para cambiar cálculo"
            >
              {contenido}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   Componente principal: TablaDinamica
   ════════════════════════════════════════════ */

/**
 * TablaDinamica — Tabla de datos avanzada con múltiples vistas, filtros, paginación y personalización.
 * Se usa en: contactos, actividades, productos, documentos, órdenes, auditoría, etc.
 * Cada página define qué vistas están disponibles y el usuario puede alternar entre ellas.
 */
function TablaDinamica<T>({
  columnas,
  datos,
  claveFila,
  totalRegistros: totalRegistrosExternos,
  vistas = ['lista'],
  vistaInicial,
  renderTarjeta,
  registrosPorPagina = REGISTROS_POR_PAGINA_DEFAULT,
  seleccionables = false,
  busqueda: busquedaExterna,
  onBusqueda,
  placeholder = 'Buscar...',
  filtros = [],
  onLimpiarFiltros,
  accionesLote = [],
  onClickFila,
  mostrarResumen = false,
  estadoVacio,
  idModulo,
  className = '',
}: PropiedadesTablaDinamica<T>) {

  /* ── Preferencias (persistencia por usuario+dispositivo) ── */
  const { preferencias, cargando: cargandoPrefs, guardar: guardarPreferencias } = usePreferencias()
  const configGuardada = idModulo ? preferencias.config_tablas?.[idModulo] : undefined
  const configCargadaRef = useRef(false)

  /* Helper para guardar config de esta tabla */
  const guardarConfigTabla = useCallback((cambios: Partial<ConfigTabla>) => {
    if (!idModulo) return
    const configActual = preferencias.config_tablas[idModulo] || {}
    guardarPreferencias({
      config_tablas: {
        ...preferencias.config_tablas,
        [idModulo]: { ...configActual, ...cambios },
      },
    })
  }, [idModulo, preferencias.config_tablas, guardarPreferencias])

  /* ── Estado de vista ── */
  const [vistaActual, setVistaActual] = useState<TipoVista>(
    (configGuardada?.tipoVista as TipoVista) || vistaInicial || vistas[0] || 'lista'
  )

  /* ── Estado de búsqueda ── */
  const [busquedaInterna, setBusquedaInterna] = useState(busquedaExterna || '')
  const [valorInput, setValorInput] = useState(busquedaExterna || '')
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [inputEnfocado, setInputEnfocado] = useState(false)
  const [inputDesbordando, setInputDesbordando] = useState(false)

  /* ── Estado de selección ── */
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  /* ── Filtros automáticos (generados desde columnas con filtrable: true) ── */
  const columnasFiltrable = useMemo(
    () => columnas.filter(c => c.filtrable),
    [columnas]
  )

  /* Estado interno de cada filtro automático: { clave_columna: valor } */
  const [filtrosInternos, setFiltrosInternos] = useState<Record<string, string | string[]>>(() => {
    const inicial: Record<string, string | string[]> = {}
    columnasFiltrable.forEach(c => {
      const tipo = c.tipoFiltro || (c.tipo === 'fecha' ? 'fecha' : 'seleccion')
      inicial[c.clave] = tipo === 'multiple' ? [] : ''
    })
    return inicial
  })

  /* Generar FiltroTabla[] a partir de columnas filtrables + filtrosInternos */
  const filtrosAutoGenerados: FiltroTabla[] = useMemo(() => {
    return columnasFiltrable.map(col => {
      const tipo = col.tipoFiltro || (col.tipo === 'fecha' ? 'fecha' : 'seleccion')
      return {
        id: col.clave,
        etiqueta: col.etiqueta,
        tipo,
        valor: filtrosInternos[col.clave] ?? (tipo === 'multiple' ? [] : ''),
        onChange: (nuevoValor: string | string[]) => {
          setFiltrosInternos(prev => ({ ...prev, [col.clave]: nuevoValor }))
        },
        opciones: col.opcionesFiltro,
      }
    })
  }, [columnasFiltrable, filtrosInternos])

  /* Combinar filtros externos (prop) con auto-generados */
  const todosLosFiltros = useMemo(
    () => [...filtros, ...filtrosAutoGenerados],
    [filtros, filtrosAutoGenerados]
  )

  /* ── Vistas guardadas (auto-gestión cuando hay idModulo) ── */
  const {
    vistas: vistasGuardadas,
    guardar: guardarVistaBD,
    eliminar: eliminarVistaBD,
    sobrescribir: sobrescribirVistaBD,
    marcarPredefinida: marcarPredefinidaBD,
    vistaPredefinida,
  } = useVistasGuardadas(idModulo)

  /* ── Estado de columnas (inicializa desde config guardada si existe) ── */
  const columnasIniciales = useMemo(() => columnas.map((c) => c.clave), [columnas])
  const [columnasVisibles, setColumnasVisibles] = useState<string[]>(
    configGuardada?.columnasVisibles || columnasIniciales
  )
  const [ordenColumnas, setOrdenColumnas] = useState<string[]>(
    configGuardada?.ordenColumnas || columnasIniciales
  )
  const [columnasAncladas, setColumnasAncladas] = useState<string[]>(
    configGuardada?.columnasAncladas || []
  )
  const [anchoColumnas, setAnchoColumnas] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    columnas.forEach((c) => { m[c.clave] = c.ancho || ANCHO_DEFAULT_COLUMNA })
    return configGuardada?.anchoColumnas ? { ...m, ...configGuardada.anchoColumnas } : m
  })

  /* ── Estado de ordenamiento ── */
  const [ordenamiento, setOrdenamiento] = useState<{ clave: string; direccion: DireccionOrden }[]>([])

  /* ── Estado de opciones visuales ── */
  const [opcionesVisuales, setOpcionesVisuales] = useState<OpcionesVisuales>({
    mostrarDivisores: true,
    filasAlternas: false,
    bordesColumnas: false,
    ...(configGuardada?.opcionesVisuales as Partial<OpcionesVisuales> || {}),
  })

  /* ── Estado de paneles ── */
  const [panelColumnasAbierto, setPanelColumnasAbierto] = useState(false)
  const [panelFiltrosAbierto, setPanelFiltrosAbierto] = useState(false)
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState(false)

  /* ── Estado de paginación ── */
  const [paginaActual, setPaginaActual] = useState(1)

  /* ── Estado de resize ── */
  const [columnaRedimensionando, setColumnaRedimensionando] = useState<string | null>(null)
  const inicioResizeRef = useRef<{ x: number; anchoInicial: number }>({ x: 0, anchoInicial: 0 })

  /* ── Refs para cerrar paneles al click fuera ── */
  const contenedorRef = useRef<HTMLDivElement>(null)
  const panelColumnasRef = useRef<HTMLDivElement>(null)

  /* ══════════════════════════════════════
     Detector de vistas guardadas
     ══════════════════════════════════════ */

  /* Estado actual de datos — lo que se compara contra vistas guardadas.
     Incluye filtros internos (auto-generados) + filtros externos (prop). */
  const estadoActualDatos: EstadoVistaDatos = useMemo(() => {
    const todosLosFiltrosEstado: Record<string, string | string[]> = { ...filtrosInternos }
    /* Incorporar filtros externos al estado */
    filtros.forEach(f => {
      todosLosFiltrosEstado[f.id] = f.valor
    })
    return {
      busqueda: busquedaInterna,
      filtros: todosLosFiltrosEstado,
      ordenamiento,
    }
  }, [busquedaInterna, filtrosInternos, filtros, ordenamiento])

  /* Detector reactivo: default / vista_activa / sin_guardar */
  const detector = useDetectorVistas(estadoActualDatos, vistasGuardadas)

  /* Aplicar vista predefinida al cargar (solo una vez) */
  const vistaPredefAplicadaRef = useRef(false)
  useEffect(() => {
    if (vistaPredefAplicadaRef.current || !vistaPredefinida) return
    vistaPredefAplicadaRef.current = true
    aplicarEstadoVista(vistaPredefinida.estado)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaPredefinida])

  /* Helper: aplicar el estado de una vista (búsqueda + filtros + orden) */
  const aplicarEstadoVista = useCallback((estado: EstadoVistaDatos) => {
    /* Búsqueda */
    setValorInput(estado.busqueda)
    setBusquedaInterna(estado.busqueda)
    onBusqueda?.(estado.busqueda)

    /* Filtros internos */
    setFiltrosInternos(prev => {
      const nuevo = { ...prev }
      for (const clave of Object.keys(nuevo)) {
        nuevo[clave] = estado.filtros[clave] ?? (Array.isArray(nuevo[clave]) ? [] : '')
      }
      return nuevo
    })

    /* Filtros externos: llamar onChange de cada filtro pasado por prop */
    filtros.forEach(f => {
      const valor = estado.filtros[f.id]
      if (valor !== undefined) f.onChange(valor)
    })

    /* Ordenamiento */
    setOrdenamiento(estado.ordenamiento || [])
  }, [filtros, onBusqueda])

  /* Handlers de vistas */
  const manejarGuardarVista = useCallback((nombre: string) => {
    guardarVistaBD(nombre, estadoActualDatos)
  }, [guardarVistaBD, estadoActualDatos])

  const manejarEliminarVista = useCallback((id: string) => {
    eliminarVistaBD(id)
  }, [eliminarVistaBD])

  const manejarAplicarVista = useCallback((id: string) => {
    const vista = vistasGuardadas.find(v => v.id === id)
    if (vista) aplicarEstadoVista(vista.estado)
  }, [vistasGuardadas, aplicarEstadoVista])

  const manejarSobrescribirVista = useCallback((id: string) => {
    sobrescribirVistaBD(id, estadoActualDatos)
  }, [sobrescribirVistaBD, estadoActualDatos])

  const manejarMarcarPredefinida = useCallback((id: string) => {
    marcarPredefinidaBD(id)
  }, [marcarPredefinidaBD])

  /* Limpiar todo: búsqueda + filtros internos + filtros externos + orden */
  const limpiarTodo = useCallback(() => {
    setValorInput('')
    setBusquedaInterna('')
    onBusqueda?.('')
    setInputDesbordando(false)
    /* Reset filtros internos */
    setFiltrosInternos(prev => {
      const limpio: Record<string, string | string[]> = {}
      for (const clave of Object.keys(prev)) {
        limpio[clave] = Array.isArray(prev[clave]) ? [] : ''
      }
      return limpio
    })
    /* Reset filtros externos */
    onLimpiarFiltros?.()
    /* Reset orden */
    setOrdenamiento([])
  }, [onBusqueda, onLimpiarFiltros])

  /* ── Sincronizar búsqueda externa ── */
  useEffect(() => {
    if (busquedaExterna !== undefined) {
      setBusquedaInterna(busquedaExterna)
      setValorInput(busquedaExterna)
    }
  }, [busquedaExterna])

  /* ── Reset selección cuando cambian los datos ── */
  useEffect(() => {
    setSeleccionados(new Set())
  }, [datos])

  /* ── Reset página cuando cambia búsqueda/filtros ── */
  useEffect(() => {
    setPaginaActual(1)
  }, [busquedaInterna, filtros])

  /* ── Cerrar paneles al click fuera ── */
  useEffect(() => {
    if (!panelColumnasAbierto && !panelFiltrosAbierto && !menuAccionesAbierto) return
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setPanelColumnasAbierto(false)
        setPanelFiltrosAbierto(false)
        setMenuAccionesAbierto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelColumnasAbierto, panelFiltrosAbierto, menuAccionesAbierto])

  /* ── Resize de columnas (mouse events globales) ── */
  useEffect(() => {
    if (!columnaRedimensionando) return

    const manejarMove = (e: MouseEvent) => {
      const delta = e.clientX - inicioResizeRef.current.x
      const nuevoAncho = Math.max(
        columnas.find((c) => c.clave === columnaRedimensionando)?.anchoMinimo || ANCHO_MINIMO_COLUMNA,
        inicioResizeRef.current.anchoInicial + delta
      )
      setAnchoColumnas((prev) => ({ ...prev, [columnaRedimensionando]: nuevoAncho }))
    }

    const manejarUp = () => {
      setColumnaRedimensionando(null)
    }

    document.addEventListener('mousemove', manejarMove)
    document.addEventListener('mouseup', manejarUp)
    return () => {
      document.removeEventListener('mousemove', manejarMove)
      document.removeEventListener('mouseup', manejarUp)
    }
  }, [columnaRedimensionando, columnas])

  /* ── Handlers de búsqueda ── */
  const manejarCambioBusqueda = useCallback((v: string) => {
    setValorInput(v)
    // Detectar si el texto está por desbordar el input (>80% del ancho)
    if (inputRef.current) {
      const { scrollWidth, clientWidth } = inputRef.current
      setInputDesbordando(scrollWidth > clientWidth * 0.8)
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setBusquedaInterna(v)
      onBusqueda?.(v)
    }, 400)
  }, [onBusqueda])

  /* ── Restaurar config guardada cuando las preferencias terminan de cargar ── */
  useEffect(() => {
    if (cargandoPrefs || configCargadaRef.current || !idModulo) return
    const cfg = preferencias.config_tablas?.[idModulo]
    if (!cfg) { configCargadaRef.current = true; return }

    configCargadaRef.current = true
    if (cfg.columnasVisibles?.length) setColumnasVisibles(cfg.columnasVisibles)
    if (cfg.ordenColumnas?.length) setOrdenColumnas(cfg.ordenColumnas)
    if (cfg.columnasAncladas) setColumnasAncladas(cfg.columnasAncladas)
    if (cfg.anchoColumnas) setAnchoColumnas(prev => ({ ...prev, ...cfg.anchoColumnas }))
    if (cfg.tipoVista) setVistaActual(cfg.tipoVista as TipoVista)
    if (cfg.opcionesVisuales) setOpcionesVisuales(prev => ({ ...prev, ...cfg.opcionesVisuales as Partial<OpcionesVisuales> }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargandoPrefs, idModulo])

  /* ── Persistir config de tabla al cambiar (debounced) ── */
  const persistirRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const yaInicializado = useRef(false)

  useEffect(() => {
    // No guardar hasta que las preferencias se cargaron y se restauró la config
    if (!configCargadaRef.current || !yaInicializado.current) {
      yaInicializado.current = configCargadaRef.current
      return
    }
    if (!idModulo) return

    if (persistirRef.current) clearTimeout(persistirRef.current)
    persistirRef.current = setTimeout(() => {
      guardarConfigTabla({
        columnasVisibles,
        ordenColumnas,
        columnasAncladas,
        anchoColumnas,
        tipoVista: vistaActual,
        opcionesVisuales: opcionesVisuales as unknown as Record<string, boolean>,
      })
    }, 800)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnasVisibles, ordenColumnas, columnasAncladas, anchoColumnas, vistaActual, opcionesVisuales, idModulo])

  /* ── Handlers de columnas ── */
  const toggleColumna = (clave: string) => {
    setColumnasVisibles((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]
    )
  }

  const toggleAnclar = (clave: string) => {
    setColumnasAncladas((prev) => {
      if (prev.includes(clave)) {
        /* Desanclar: quitar esta columna y todas las que están después de ella */
        const indice = ordenColumnas.indexOf(clave)
        return prev.filter((c) => {
          const idx = ordenColumnas.indexOf(c)
          return idx < indice
        })
      } else {
        /* Anclar: anclar todas las columnas visibles desde la primera hasta esta (inclusive) */
        const indice = ordenColumnas.indexOf(clave)
        const nuevas: string[] = []
        for (let i = 0; i <= indice; i++) {
          const col = ordenColumnas[i]
          if (columnasVisibles.includes(col)) {
            nuevas.push(col)
          }
        }
        return nuevas
      }
    })
  }

  const restablecerColumnas = () => {
    setColumnasVisibles(columnasIniciales)
    setOrdenColumnas(columnasIniciales)
    setColumnasAncladas([])
    setAnchoColumnas(() => {
      const m: Record<string, number> = {}
      columnas.forEach((c) => { m[c.clave] = c.ancho || ANCHO_DEFAULT_COLUMNA })
      return m
    })
    setOpcionesVisuales({ mostrarDivisores: true, filasAlternas: false, bordesColumnas: false })
  }

  const ajustarAnchosAuto = () => {
    /* Mide el contenido real de cada columna (header + celdas) usando las celdas del DOM.
       Toma el ancho más grande entre el header y todas las celdas visibles de esa columna.
       Si no puede medir (ej: vista tarjetas), reparte equitativamente. */
    const tabla = contenedorRef.current?.querySelector('table')
    if (!tabla) return

    const nuevosAnchos: Record<string, number> = {}
    const anchoDisponible = contenedorRef.current?.clientWidth || 1000
    const paddingCelda = 32 /* px-4 = 16px * 2 */
    let anchoTotalMedido = seleccionables ? 44 : 0

    columnasVisibles.forEach((clave) => {
      const col = columnas.find((c) => c.clave === clave)
      if (!col) return

      /* Medir header: buscar el th con el texto de la etiqueta */
      let anchoMaximo = 0

      /* Recorrer todas las celdas de esta columna en la tabla */
      const indiceColumna = columnasRenderizar.findIndex((c) => c.clave === clave)
      if (indiceColumna === -1) return

      const indiceTd = indiceColumna + (seleccionables ? 1 : 0)

      /* Header */
      const th = tabla.querySelector(`thead tr th:nth-child(${indiceTd + 1})`)
      if (th) {
        /* Medir el contenido interno del header (sin padding ni handle de resize) */
        const contenidoHeader = th.querySelector('div')
        if (contenidoHeader) {
          anchoMaximo = Math.max(anchoMaximo, contenidoHeader.scrollWidth)
        }
      }

      /* Body — medir cada celda */
      const celdas = tabla.querySelectorAll(`tbody tr td:nth-child(${indiceTd + 1})`)
      celdas.forEach((td) => {
        /* scrollWidth del contenido hijo directo o del td mismo */
        const primerHijo = td.firstElementChild
        const anchoContenido = primerHijo ? primerHijo.scrollWidth : td.scrollWidth
        anchoMaximo = Math.max(anchoMaximo, anchoContenido)
      })

      /* Agregar padding + margen de seguridad */
      const anchoFinal = Math.max(
        col.anchoMinimo || ANCHO_MINIMO_COLUMNA,
        anchoMaximo + paddingCelda + 8 /* 8px extra de respiro */
      )

      nuevosAnchos[clave] = anchoFinal
      anchoTotalMedido += anchoFinal
    })

    /* Si el total medido es menor que el espacio disponible, expandir proporcionalmente */
    if (anchoTotalMedido < anchoDisponible) {
      const sobrante = anchoDisponible - anchoTotalMedido
      const numCols = columnasVisibles.length
      columnasVisibles.forEach((clave) => {
        if (nuevosAnchos[clave]) {
          nuevosAnchos[clave] += Math.floor(sobrante / numCols)
        }
      })
    }

    /* Columnas no visibles mantienen su ancho */
    columnas.forEach((c) => {
      if (!nuevosAnchos[c.clave]) {
        nuevosAnchos[c.clave] = c.ancho || ANCHO_DEFAULT_COLUMNA
      }
    })

    setAnchoColumnas(nuevosAnchos)
  }

  const cambiarOpcionVisual = (opcion: keyof OpcionesVisuales) => {
    setOpcionesVisuales((prev) => ({ ...prev, [opcion]: !prev[opcion] }))
  }

  /* ── Handler de ordenamiento ── */
  const toggleOrden = (clave: string) => {
    setOrdenamiento((prev) => {
      const existente = prev.find((o) => o.clave === clave)
      if (!existente) return [{ clave, direccion: 'asc' }]
      if (existente.direccion === 'asc') return [{ clave, direccion: 'desc' }]
      return [] // tercer click quita el orden
    })
  }

  /* ── Selección ── */
  const toggleTodos = () => {
    if (seleccionados.size === datosPaginados.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(datosPaginados.map(claveFila)))
    }
  }

  const toggleUno = (id: string) => {
    const nuevo = new Set(seleccionados)
    if (nuevo.has(id)) nuevo.delete(id)
    else nuevo.add(id)
    setSeleccionados(nuevo)
  }

  /* ── Iniciar resize ── */
  const iniciarResize = (clave: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setColumnaRedimensionando(clave)
    inicioResizeRef.current = { x: e.clientX, anchoInicial: anchoColumnas[clave] || ANCHO_DEFAULT_COLUMNA }
  }

  /* ── Procesamiento de datos ── */

  /* Filtros internos — filtra datos según los filtros auto-generados de columnas */
  const datosFiltrados = useMemo(() => {
    /* Verificar si hay algún filtro activo */
    const filtrosActivos = Object.entries(filtrosInternos).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v !== ''
    )
    if (filtrosActivos.length === 0) return datos

    return datos.filter(fila => {
      for (const [clave, valorFiltro] of filtrosActivos) {
        const obj = fila as Record<string, unknown>
        const valorCelda = String(obj[clave] ?? '').toLowerCase()

        if (Array.isArray(valorFiltro)) {
          /* Filtro múltiple: el valor de la celda debe estar en la lista */
          if (!valorFiltro.some(v => valorCelda === v.toLowerCase())) return false
        } else {
          /* Filtro simple: coincidencia exacta */
          if (valorCelda !== valorFiltro.toLowerCase()) return false
        }
      }
      return true
    })
  }, [datos, filtrosInternos])

  /* Búsqueda interna — filtra datos buscando en las columnas */
  const datosBuscados = useMemo(() => {
    if (!busquedaInterna.trim()) return datosFiltrados
    const termino = busquedaInterna.toLowerCase().trim()
    return datosFiltrados.filter(fila => {
      /* Buscar en todas las columnas */
      for (const col of columnas) {
        const valor = obtenerValorCelda(fila, col)
        if (valor !== null && valor !== undefined && valor !== '') {
          if (String(valor).toLowerCase().includes(termino)) return true
        }
      }
      /* También buscar en propiedades directas del objeto */
      const obj = fila as Record<string, unknown>
      for (const clave of Object.keys(obj)) {
        const v = obj[clave]
        if (typeof v === 'string' && v.toLowerCase().includes(termino)) return true
        if (typeof v === 'number' && String(v).includes(termino)) return true
      }
      return false
    })
  }, [datosFiltrados, busquedaInterna, columnas])

  /* Ordenar */
  const datosOrdenados = useMemo(() => {
    if (ordenamiento.length === 0) return datosBuscados
    const copia = [...datosBuscados]
    copia.sort((a, b) => {
      for (const { clave, direccion } of ordenamiento) {
        const col = columnas.find((c) => c.clave === clave)
        if (!col) continue
        const va = obtenerValorCelda(a, col)
        const vb = obtenerValorCelda(b, col)
        const resultado = compararValores(va, vb, direccion)
        if (resultado !== 0) return resultado
      }
      return 0
    })
    return copia
  }, [datosBuscados, ordenamiento, columnas])

  /* Paginar */
  const totalRegistros = totalRegistrosExternos ?? datosOrdenados.length
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / registrosPorPagina))
  const registroInicio = (paginaActual - 1) * registrosPorPagina + 1
  const registroFin = Math.min(paginaActual * registrosPorPagina, totalRegistros)
  const datosPaginados = datosOrdenados.slice((paginaActual - 1) * registrosPorPagina, paginaActual * registrosPorPagina)

  /* Columnas visibles en orden */
  const columnasRenderizar = useMemo(() => {
    return ordenColumnas
      .filter((clave) => columnasVisibles.includes(clave))
      .map((clave) => columnas.find((c) => c.clave === clave)!)
      .filter(Boolean)
  }, [ordenColumnas, columnasVisibles, columnas])

  /* Conteo de filtros activos */
  /* Conteo de filtros activos (todos: externos + auto-generados) */
  const numFiltrosActivos = todosLosFiltros.filter((f) => {
    if (Array.isArray(f.valor)) return f.valor.length > 0
    return f.valor !== ''
  }).length

  const hayBusquedaOFiltros = valorInput.length > 0 || numFiltrosActivos > 0 || ordenamiento.length > 0

  /* Iconos de vista */
  const iconosVista: Record<TipoVista, ReactNode> = {
    lista: <List size={14} />,
    tarjetas: <LayoutGrid size={14} />,
  }

  const todoSeleccionado = datosPaginados.length > 0 && seleccionados.size === datosPaginados.length

  /* ── Calcular offset left para columnas ancladas ── */
  const offsetAncladas = useMemo(() => {
    const offsets: Record<string, number> = {}
    let acumulado = seleccionables ? 44 : 0
    for (const clave of ordenColumnas) {
      if (!columnasVisibles.includes(clave)) continue
      if (columnasAncladas.includes(clave)) {
        offsets[clave] = acumulado
      }
      acumulado += anchoColumnas[clave] || ANCHO_DEFAULT_COLUMNA
    }
    return offsets
  }, [ordenColumnas, columnasVisibles, columnasAncladas, anchoColumnas, seleccionables])

  /* ════════════════════════════════════════════
     Render
     ════════════════════════════════════════════ */

  /* Placeholder dinámico: incluye el conteo de registros o seleccionados */
  const placeholderDinamico = useMemo(() => {
    if (seleccionados.size > 0) {
      return `${seleccionados.size} seleccionado${seleccionados.size > 1 ? 's' : ''}. ${placeholder}`
    }
    return `${totalRegistros.toLocaleString('es')} registro${totalRegistros !== 1 ? 's' : ''}. ${placeholder}`
  }, [seleccionados.size, totalRegistros, placeholder])

  return (
    <div ref={contenedorRef} className={`flex flex-col h-full ${className}`}>

      {/* ═══ TOOLBAR ═══ */}
      <div className="flex items-center gap-2 pb-4 px-4 sm:px-6 relative z-30 shrink-0">

        {/* Buscador — ancho se adapta al contenido, máximo 70% del toolbar */}
        <div className="min-w-0 relative" style={{ width: 'fit-content', maxWidth: '70%' }}>
          <div className={[
            'flex items-center gap-1.5 px-3 h-9 rounded-lg border bg-superficie-tarjeta transition-all duration-200',
            inputEnfocado ? 'border-borde-foco shadow-foco' : 'border-borde-sutil hover:border-borde-fuerte',
          ].join(' ')}>
            {/* Lupa */}
            <Search size={15} className="text-texto-terciario shrink-0" />

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={valorInput}
              onChange={(e) => manejarCambioBusqueda(e.target.value)}
              onFocus={() => setInputEnfocado(true)}
              onBlur={() => setInputEnfocado(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (valorInput) {
                    setValorInput('')
                    setBusquedaInterna('')
                    onBusqueda?.('')
                    setInputDesbordando(false)
                  } else {
                    inputRef.current?.blur()
                  }
                }
              }}
              placeholder={placeholderDinamico}
              className="w-52 sm:w-72 shrink min-w-0 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-terciario"
            />

            {/* Detector de vistas */}
            <AnimatePresence mode="popLayout">
              {detector.tipo === 'vista_activa' && detector.vistaActiva && (
                <motion.span
                  key="vista-activa"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-superficie-seleccionada text-texto-marca whitespace-nowrap shrink-0 border border-texto-marca/20"
                >
                  <Bookmark size={12} className="fill-current" />
                  {detector.vistaActiva.nombre}
                </motion.span>
              )}

              {detector.tipo === 'sin_guardar' && idModulo && (
                <motion.button
                  key="sin-guardar"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  type="button"
                  onClick={() => { setPanelFiltrosAbierto(true); setPanelColumnasAbierto(false) }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-texto-marca hover:bg-superficie-seleccionada whitespace-nowrap shrink-0 cursor-pointer border border-texto-marca/20 bg-transparent transition-colors"
                  title="Guardar vista"
                >
                  <BookmarkPlus size={12} />
                  Guardar vista
                </motion.button>
              )}
            </AnimatePresence>

            {/* Pills de filtros activos */}
            <AnimatePresence mode="popLayout">
              {todosLosFiltros
                .filter((f) => (Array.isArray(f.valor) ? f.valor.length > 0 : f.valor !== ''))
                .map((f) => {
                  const valorTexto = Array.isArray(f.valor)
                    ? `${f.valor.length} selec.`
                    : f.opciones?.find((o) => o.valor === f.valor)?.etiqueta || f.valor
                  return (
                    <motion.span
                      key={f.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-primario-fondo text-insignia-primario-texto whitespace-nowrap shrink-0"
                    >
                      <span className="text-xs opacity-70">{f.etiqueta}:</span>
                      {valorTexto}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); f.onChange(Array.isArray(f.valor) ? [] : '') }}
                        className="inline-flex items-center justify-center size-3.5 rounded-full hover:bg-black/10 cursor-pointer border-none bg-transparent text-current p-0"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )
                })}
            </AnimatePresence>

            {/* Limpiar todo */}
            {hayBusquedaOFiltros && (
              <button
                type="button"
                onClick={limpiarTodo}
                className="shrink-0 size-6 inline-flex items-center justify-center rounded hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent text-insignia-peligro-texto transition-colors"
                title="Limpiar todo"
              >
                <X size={12} />
              </button>
            )}

            {/* Botón filtros — siempre al final derecho */}
            {todosLosFiltros.length > 0 && (
              <button
                type="button"
                onClick={() => { setPanelFiltrosAbierto(!panelFiltrosAbierto); setPanelColumnasAbierto(false) }}
                className="relative shrink-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-secundario transition-colors"
                title="Filtros y vistas"
              >
                <SlidersHorizontal size={14} />
                {numFiltrosActivos > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-insignia-peligro" />
                )}
              </button>
            )}

            {/* Botón columnas — siempre al final derecho */}
            <button
              type="button"
              onClick={() => { setPanelColumnasAbierto(!panelColumnasAbierto); setPanelFiltrosAbierto(false) }}
              className="shrink-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-secundario transition-colors"
              title="Columnas"
            >
              <Columns3 size={14} />
            </button>
          </div>

          {/* Panel de filtros + vistas (desplegable) */}
          <AnimatePresence>
            {panelFiltrosAbierto && (todosLosFiltros.length > 0 || idModulo) && (
              <>
                {/* Overlay invisible para cerrar al click fuera */}
                <div className="fixed inset-0 z-40" onClick={() => setPanelFiltrosAbierto(false)} />
                <div className="relative z-50">
                  <PanelFiltrosTabla
                    filtros={todosLosFiltros}
                    onLimpiarFiltros={limpiarTodo}
                    vistasGuardadas={vistasGuardadas}
                    detector={detector}
                    onAplicarVista={manejarAplicarVista}
                    onGuardarVista={idModulo ? manejarGuardarVista : undefined}
                    onEliminarVista={idModulo ? manejarEliminarVista : undefined}
                    onSobrescribirVista={idModulo ? manejarSobrescribirVista : undefined}
                    onMarcarPredefinida={idModulo ? manejarMarcarPredefinida : undefined}
                  />
                </div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Espaciador — empuja controles a la derecha */}
        <div className="flex-1" />

        {/* Paginador compacto */}
        {totalPaginas > 1 && (
          <div className="hidden sm:flex items-center gap-0.5 shrink-0 border border-borde-sutil rounded-lg px-1 h-9">
            <button
              type="button"
              onClick={() => setPaginaActual(Math.max(1, paginaActual - 1))}
              disabled={paginaActual === 1}
              className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (paginaActual === totalPaginas) setPaginaActual(1)
                else setPaginaActual(totalPaginas)
              }}
              className="px-2 py-0.5 text-xs font-medium text-texto-primario hover:bg-superficie-hover cursor-pointer border-none bg-transparent rounded transition-colors whitespace-nowrap tabular-nums"
              title={paginaActual === totalPaginas ? 'Ir a la primera página' : 'Ir a la última página'}
            >
              {registroInicio}–{registroFin} / {totalRegistros.toLocaleString('es')}
            </button>
            <button
              type="button"
              onClick={() => setPaginaActual(Math.min(totalPaginas, paginaActual + 1))}
              disabled={paginaActual === totalPaginas}
              className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Switcher de vistas — compacto, sin contenedor */}
        {vistas.length > 1 && (
          <div className="flex items-center gap-0 shrink-0 border border-borde-sutil rounded-md overflow-hidden">
            {vistas.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVistaActual(v)}
                className={[
                  'size-8 inline-flex items-center justify-center cursor-pointer border-none transition-colors',
                  v === vistaActual
                    ? 'bg-superficie-hover text-texto-primario'
                    : 'bg-transparent text-texto-terciario hover:text-texto-secundario',
                ].join(' ')}
                title={v.charAt(0).toUpperCase() + v.slice(1)}
              >
                {iconosVista[v]}
              </button>
            ))}
          </div>
        )}

        {/* Acciones en lote (aparece cuando hay selección) */}
        <AnimatePresence>
          {seleccionados.size > 0 && accionesLote.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative shrink-0"
            >
              <button
                type="button"
                onClick={() => setMenuAccionesAbierto(!menuAccionesAbierto)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-borde-sutil bg-superficie-tarjeta text-sm font-medium text-texto-primario hover:bg-superficie-hover cursor-pointer transition-colors"
              >
                <MoreHorizontal size={14} />
                Acciones
              </button>

              <AnimatePresence>
                {menuAccionesAbierto && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full right-0 mt-1 min-w-[180px] bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 overflow-hidden"
                  >
                    {accionesLote.map((accion) => (
                      <button
                        key={accion.id}
                        type="button"
                        onClick={() => { accion.onClick(seleccionados); setMenuAccionesAbierto(false) }}
                        className={[
                          'flex items-center gap-2 w-full px-3 py-2 text-sm text-left border-none cursor-pointer transition-colors',
                          accion.peligro
                            ? 'text-insignia-peligro-texto bg-transparent hover:bg-insignia-peligro-fondo'
                            : 'text-texto-primario bg-transparent hover:bg-superficie-hover',
                        ].join(' ')}
                      >
                        {accion.icono}
                        {accion.etiqueta}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel de columnas (sidebar derecho fijo) */}
        <div ref={panelColumnasRef}>
          <AnimatePresence>
            {panelColumnasAbierto && (
              <>
              {/* Overlay para cerrar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 z-40"
                onClick={() => setPanelColumnasAbierto(false)}
              />
              <PanelColumnas
                columnas={columnas}
                columnasVisibles={columnasVisibles}
                ordenColumnas={ordenColumnas}
                columnasAncladas={columnasAncladas}
                opcionesVisuales={opcionesVisuales}
                onToggleColumna={toggleColumna}
                onReordenar={setOrdenColumnas}
                onToggleAnclar={toggleAnclar}
                onCambiarOpcionVisual={cambiarOpcionVisual}
                onRestablecer={restablecerColumnas}
                onAjustarAnchosAuto={ajustarAnchosAuto}
                onCerrar={() => setPanelColumnasAbierto(false)}
              />
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ═══ CONTENIDO — header fijo, filas scrollean, footer fijo abajo ═══ */}
      <div className="flex-1 min-h-0 flex flex-col bg-superficie-tarjeta border-t border-borde-sutil">
        {/* Estado vacío */}
        {datos.length === 0 && estadoVacio ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {estadoVacio}
          </div>
        ) : (
        <>
        <AnimatePresence mode="wait">
          {vistaActual === 'lista' && (
            <motion.div
              key="lista"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 min-h-0 overflow-auto overscroll-contain"
            >
              <table className="w-full border-collapse text-sm" style={{ minWidth: 'max-content' }}>
                {/* Header */}
                <thead>
                  <tr className="border-b border-borde-fuerte sticky top-0 z-20" style={{ background: 'var(--superficie-activa)' }}>
                    {/* Checkbox header */}
                    {seleccionables && (
                      <th className="w-10 min-w-10 px-2.5 py-2.5 text-center sticky left-0 z-30" style={{ background: 'var(--superficie-activa)' }}>
                        <input
                          type="checkbox"
                          checked={todoSeleccionado}
                          onChange={toggleTodos}
                          className="cursor-pointer"
                        />
                      </th>
                    )}

                    {/* Columnas */}
                    {columnasRenderizar.map((col) => {
                      const anclada = columnasAncladas.includes(col.clave)
                      const ordenActual = ordenamiento.find((o) => o.clave === col.clave)
                      const ancho = anchoColumnas[col.clave] || col.ancho || ANCHO_DEFAULT_COLUMNA

                      return (
                        <th
                          key={col.clave}
                          className={[
                            'px-4 py-2.5 text-xs font-semibold text-texto-terciario uppercase tracking-wide text-left relative select-none group',
                            anclada ? 'sticky z-30 border-r-2 border-r-borde-fuerte' : '',
                            col.ordenable !== false ? 'cursor-pointer hover:text-texto-secundario' : '',
                            opcionesVisuales.bordesColumnas && !anclada ? 'border-r border-borde-sutil last:border-r-0' : '',
                          ].join(' ')}
                          style={{
                            width: ancho,
                            minWidth: col.anchoMinimo || ANCHO_MINIMO_COLUMNA,
                            textAlign: col.alineacion,
                            ...(anclada ? { left: offsetAncladas[col.clave], background: 'var(--superficie-activa)' } : {}),
                          }}
                          onClick={() => col.ordenable !== false && toggleOrden(col.clave)}
                        >
                          <div className="flex items-center gap-1">
                            <span className="truncate">{col.etiqueta}</span>

                            {/* Indicador de orden */}
                            {col.ordenable !== false && (
                              <span className={`shrink-0 transition-opacity ${ordenActual ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
                                {ordenActual?.direccion === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                              </span>
                            )}

                            {/* Pin indicator */}
                            {anclada && (
                              <Pin size={10} className="text-texto-marca shrink-0" />
                            )}
                          </div>

                          {/* Handle de resize */}
                          <div
                            onMouseDown={(e) => iniciarResize(col.clave, e)}
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-texto-marca/30 active:bg-texto-marca/50 transition-colors"
                          />
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                {/* Body */}
                <tbody>
                  {datosPaginados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columnasRenderizar.length + (seleccionables ? 1 : 0)}
                        className="text-center py-16 text-texto-terciario text-sm"
                      >
                        Nada por acá... probá con otra búsqueda
                      </td>
                    </tr>
                  ) : (
                    datosPaginados.map((fila, indice) => {
                      const id = claveFila(fila)
                      const estaSeleccionado = seleccionados.has(id)
                      const esAlterna = opcionesVisuales.filasAlternas && indice % 2 === 1

                      /* Fondo sólido inline para celdas sticky — evita transparencias */
                      const fondoStickyFila = estaSeleccionado
                        ? 'var(--superficie-anclada-seleccionada)'
                        : esAlterna
                        ? 'var(--superficie-anclada-alterna)'
                        : 'var(--superficie-anclada)'

                      return (
                        <tr
                          key={id}
                          onClick={() => onClickFila?.(fila)}
                          className={[
                            'transition-colors duration-100',
                            opcionesVisuales.mostrarDivisores ? 'border-b border-borde-sutil last:border-b-0' : '',
                            onClickFila ? 'cursor-pointer' : '',
                            estaSeleccionado
                              ? 'bg-superficie-seleccionada'
                              : esAlterna
                              ? 'bg-superficie-anclada-alterna'
                              : '',
                            !estaSeleccionado ? 'hover:bg-superficie-hover' : '',
                          ].join(' ')}
                        >
                          {/* Checkbox — siempre sticky con fondo sólido */}
                          {seleccionables && (
                            <td className="w-10 min-w-10 px-2.5 py-2.5 text-center sticky left-0 z-10" style={{ background: fondoStickyFila }}>
                              <input
                                type="checkbox"
                                checked={estaSeleccionado}
                                onChange={() => toggleUno(id)}
                                onClick={(e) => e.stopPropagation()}
                                className="cursor-pointer"
                              />
                            </td>
                          )}

                          {/* Celdas */}
                          {columnasRenderizar.map((col) => {
                            const anclada = columnasAncladas.includes(col.clave)
                            const ancho = anchoColumnas[col.clave] || col.ancho || ANCHO_DEFAULT_COLUMNA

                            return (
                              <td
                                key={col.clave}
                                className={[
                                  'px-4 py-2.5 text-texto-primario',
                                  anclada ? 'sticky z-10 border-r-2 border-r-borde-fuerte' : '',
                                  opcionesVisuales.bordesColumnas && !anclada ? 'border-r border-borde-sutil last:border-r-0' : '',
                                ].join(' ')}
                                style={{
                                  width: ancho,
                                  minWidth: col.anchoMinimo || ANCHO_MINIMO_COLUMNA,
                                  textAlign: col.alineacion,
                                  ...(anclada ? { left: offsetAncladas[col.clave], background: fondoStickyFila } : {}),
                                }}
                              >
                                {col.render
                                  ? col.render(fila)
                                  : String((fila as Record<string, unknown>)[col.clave] ?? '')}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {/* Footer de cálculos — sticky abajo dentro de la tabla */}
                {mostrarResumen && datos.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20" style={{ background: 'var(--superficie-activa)' }}>
                    <PieResumenFila
                      columnas={columnas}
                      datos={datosOrdenados}
                      columnasVisibles={columnasVisibles.filter((c) => ordenColumnas.includes(c))}
                      columnasAncladas={columnasAncladas}
                      anchoColumnas={anchoColumnas}
                      seleccionables={seleccionables}
                      opcionesVisuales={opcionesVisuales}
                      offsetAncladas={offsetAncladas}
                    />
                  </tfoot>
                )}
              </table>
            </motion.div>
          )}

          {vistaActual === 'tarjetas' && (
            <motion.div
              key="tarjetas"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 min-h-0 overflow-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start"
            >
              {datosPaginados.length === 0 ? (
                <div className="col-span-full text-center py-16 text-texto-terciario text-sm">
                  No se encontraron registros
                </div>
              ) : (
                datosPaginados.map((fila) => {
                  const id = claveFila(fila)
                  const estaSeleccionado = seleccionados.has(id)

                  return (
                    <motion.div
                      key={id}
                      layout
                      className={[
                        'relative rounded-lg border p-3 transition-all duration-150 cursor-pointer',
                        estaSeleccionado
                          ? 'border-texto-marca bg-superficie-seleccionada'
                          : 'border-borde-sutil bg-superficie-tarjeta hover:border-borde-fuerte hover:shadow-sm',
                      ].join(' ')}
                      onClick={() => onClickFila?.(fila)}
                    >
                      {/* Checkbox en tarjeta */}
                      {seleccionables && (
                        <div className="absolute top-2 right-2">
                          <input
                            type="checkbox"
                            checked={estaSeleccionado}
                            onChange={() => toggleUno(id)}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer"
                          />
                        </div>
                      )}

                      {/* Contenido de la tarjeta */}
                      {renderTarjeta ? renderTarjeta(fila) : (
                        <div className="flex flex-col gap-1.5">
                          {columnasRenderizar.slice(0, 4).map((col) => (
                            <div key={col.clave} className="flex items-baseline gap-2">
                              <span className="text-xs text-texto-terciario shrink-0">{col.etiqueta}:</span>
                              <span className="text-sm text-texto-primario truncate">
                                {col.render
                                  ? col.render(fila)
                                  : String((fila as Record<string, unknown>)[col.clave] ?? '')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>

        </>
        )}

      </div>
    </div>
  )
}

export {
  TablaDinamica,
  Paginador,
  type PropiedadesTablaDinamica,
  type ColumnaDinamica,
  type TipoVista,
  type FiltroTabla,
  type AccionLote,
  type OpcionesVisuales,
  type TipoCalculo,
  type DireccionOrden,
}

'use client'

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, Bookmark, Columns2, X, Check, MoreVertical } from 'lucide-react'

/* ─── Tipos ─── */

type TipoFiltro = 'seleccion' | 'multiple' | 'fecha'

interface Filtro {
  id: string
  etiqueta: string
  icono?: ReactNode
  tipo: TipoFiltro
  valor: string | string[]
  onChange: (valor: string | string[]) => void
  opciones?: { valor: string; etiqueta: string }[]
}

interface PillGrupo {
  id: string
  etiqueta: string
  opciones: { id: string; etiqueta: string; icono?: ReactNode; conteo?: number }[]
  activo: string
  onChange: (id: string) => void
}

interface Plantilla {
  id: string
  nombre: string
  predefinida: boolean
}

interface OpcionVista {
  id: string
  icono: ReactNode
  etiqueta: string
  deshabilitada?: boolean
}

interface PropiedadesBarraBusqueda {
  /* Busqueda */
  busqueda: string
  onBusqueda: (texto: string) => void
  placeholder?: string
  contadorResultados?: number

  /* Filtros */
  filtros?: Filtro[]
  onLimpiarFiltros?: () => void

  /* Pills principales */
  pillsGrupos?: PillGrupo[]

  /* Vistas guardadas (favoritos) */
  plantillas?: Plantilla[]
  plantillaActivaId?: string
  onAplicarPlantilla?: (id: string) => void
  onGuardarNuevaPlantilla?: (nombre: string) => void
  onSobrescribirPlantilla?: (id: string) => void
  onEliminarPlantilla?: (id: string) => void

  /* Vistas (lista/tarjetas/kanban) */
  vistaActual?: string
  opcionesVista?: OpcionVista[]
  onCambiarVista?: (id: string) => void

  /* Columnas */
  mostrarBotonColumnas?: boolean
  onAbrirColumnas?: () => void

  className?: string
}

/* ─── Helpers ─── */

/** Cuenta cuantos filtros tienen valor activo */
function contarFiltrosActivos(filtros: Filtro[]): number {
  return filtros.filter((f) => {
    if (Array.isArray(f.valor)) return f.valor.length > 0
    return f.valor !== ''
  }).length
}

/** Genera el placeholder dinámico */
function generarPlaceholder(base: string, contador?: number, filtrosActivos?: number): string {
  if (filtrosActivos && filtrosActivos > 0) return `Buscar en ${filtrosActivos} filtro${filtrosActivos > 1 ? 's' : ''} activo${filtrosActivos > 1 ? 's' : ''}...`
  if (contador !== undefined) return `${base} (${contador.toLocaleString('es')} resultados)`
  return base
}

/* ─── Sub-componentes internos ─── */

/** Pill de filtro activo que aparece dentro de la cápsula */
function PillFiltroActivo({ etiqueta, valor, onRemover }: { etiqueta: string; valor: string; onRemover: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.2 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-primario-fondo text-insignia-primario-texto whitespace-nowrap shrink-0"
    >
      <span className="text-xs opacity-70">{etiqueta}:</span>
      {valor}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemover() }}
        className="inline-flex items-center justify-center size-3.5 rounded-full hover:bg-black/10 cursor-pointer border-none bg-transparent text-current p-0"
      >
        <X size={10} />
      </button>
    </motion.span>
  )
}

/** Panel desplegable de filtros */
function PanelFiltros({
  filtros,
  pillsGrupos,
  plantillas,
  plantillaActivaId,
  onAplicarPlantilla,
  onGuardarNuevaPlantilla,
  onEliminarPlantilla,
}: {
  filtros: Filtro[]
  pillsGrupos?: PillGrupo[]
  plantillas?: Plantilla[]
  plantillaActivaId?: string
  onAplicarPlantilla?: (id: string) => void
  onGuardarNuevaPlantilla?: (nombre: string) => void
  onEliminarPlantilla?: (id: string) => void
}) {
  const [nombreNueva, setNombreNueva] = useState('')
  const [creandoVista, setCreandoVista] = useState(false)
  const [busquedaOpciones, setBusquedaOpciones] = useState<Record<string, string>>({})

  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0.95 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.95 }}
      transition={{ type: 'spring', duration: 0.35 }}
      style={{ transformOrigin: 'top' }}
      className="absolute top-full left-0 right-0 mt-2 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 overflow-hidden"
    >
      <div className="max-h-[420px] overflow-y-auto p-3 flex flex-col gap-3">
        {/* Sección 1: Pills principales */}
        {pillsGrupos && pillsGrupos.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Grupos</span>
            {pillsGrupos.map((grupo) => (
              <div key={grupo.id} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-texto-secundario">{grupo.etiqueta}</span>
                <div className="flex flex-wrap gap-1.5">
                  {grupo.opciones.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => grupo.onChange(op.id === grupo.activo ? grupo.opciones[0].id : op.id)}
                      className={[
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium border cursor-pointer transition-all duration-150',
                        op.id === grupo.activo
                          ? 'bg-insignia-primario-fondo text-insignia-primario-texto border-texto-marca'
                          : 'bg-superficie-tarjeta text-texto-secundario border-borde-sutil hover:border-borde-fuerte',
                      ].join(' ')}
                    >
                      {op.icono}
                      {op.etiqueta}
                      {op.conteo !== undefined && (
                        <span className="text-xxs opacity-60">({op.conteo})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sección 2: Filtros secundarios */}
        {filtros.length > 0 && (
          <div className="flex flex-col gap-2">
            {(pillsGrupos && pillsGrupos.length > 0) && (
              <div className="border-t border-borde-sutil" />
            )}
            <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Filtros</span>
            {filtros.map((filtro) => (
              <div key={filtro.id} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-texto-secundario flex items-center gap-1.5">
                  {filtro.icono && <span className="shrink-0">{filtro.icono}</span>}
                  {filtro.etiqueta}
                </span>

                {/* Filtro tipo selección */}
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

                {/* Filtro tipo múltiple */}
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
                        .map((op) => {
                          const seleccionado = Array.isArray(filtro.valor) && filtro.valor.includes(op.valor)
                          return (
                            <button
                              key={op.valor}
                              type="button"
                              onClick={() => {
                                const actual = Array.isArray(filtro.valor) ? filtro.valor : []
                                filtro.onChange(
                                  seleccionado
                                    ? actual.filter((v) => v !== op.valor)
                                    : [...actual, op.valor]
                                )
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded cursor-pointer transition-colors duration-100 border-none bg-transparent text-texto-primario hover:bg-superficie-hover"
                            >
                              <span className={[
                                'inline-flex items-center justify-center size-4 rounded border transition-colors',
                                seleccionado
                                  ? 'bg-texto-marca border-texto-marca text-texto-inverso'
                                  : 'border-borde-fuerte bg-superficie-tarjeta',
                              ].join(' ')}>
                                {seleccionado && <Check size={10} />}
                              </span>
                              <span className="flex-1">{op.etiqueta}</span>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Filtro tipo fecha */}
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

        {/* Sección 3: Favoritos / Plantillas */}
        {plantillas && plantillas.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="border-t border-borde-sutil" />
            <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Vistas guardadas</span>
            {plantillas.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-superficie-hover transition-colors"
                onClick={() => onAplicarPlantilla?.(p.id)}
              >
                <span className={[
                  'flex-1 text-sm',
                  p.id === plantillaActivaId ? 'font-semibold text-texto-marca' : 'text-texto-primario',
                ].join(' ')}>
                  {p.nombre}
                </span>
                {p.id === plantillaActivaId && <Check size={14} />}
                {!p.predefinida && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEliminarPlantilla?.(p.id) }}
                    className="opacity-0 group-hover:opacity-100 size-5 inline-flex items-center justify-center rounded hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent text-texto-terciario hover:text-insignia-peligro-texto transition-all"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Guardar nueva vista */}
        {onGuardarNuevaPlantilla && (
          <div className="flex flex-col gap-1.5">
            {!creandoVista ? (
              <button
                type="button"
                onClick={() => setCreandoVista(true)}
                className="text-sm text-texto-marca font-medium cursor-pointer border-none bg-transparent p-0 text-left hover:underline"
              >
                + Guardar vista actual
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
                      onGuardarNuevaPlantilla(nombreNueva.trim())
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
                      onGuardarNuevaPlantilla(nombreNueva.trim())
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

/* ─── Componente principal ─── */

/**
 * BarraBusqueda — Cápsula de búsqueda avanzada con filtros, pills, vistas y favoritos.
 * Se usa en: listados de contactos, actividades, productos, documentos, etc.
 */
function BarraBusqueda({
  busqueda,
  onBusqueda,
  placeholder = 'Buscar...',
  contadorResultados,
  filtros = [],
  onLimpiarFiltros,
  pillsGrupos,
  plantillas,
  plantillaActivaId,
  onAplicarPlantilla,
  onGuardarNuevaPlantilla,
  onSobrescribirPlantilla,
  onEliminarPlantilla,
  vistaActual,
  opcionesVista,
  onCambiarVista,
  mostrarBotonColumnas,
  onAbrirColumnas,
  className = '',
}: PropiedadesBarraBusqueda) {
  const [enfocado, setEnfocado] = useState(false)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [valorInterno, setValorInterno] = useState(busqueda)
  const [vistaDropdownAbierto, setVistaDropdownAbierto] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)

  const numFiltrosActivos = contarFiltrosActivos(filtros)
  const hayAlgoActivo = busqueda.length > 0 || numFiltrosActivos > 0

  /* Sincronizar valor externo */
  useEffect(() => {
    setValorInterno(busqueda)
  }, [busqueda])

  /* Cerrar panel al hacer click fuera */
  useEffect(() => {
    if (!panelAbierto && !vistaDropdownAbierto) return
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setPanelAbierto(false)
        setVistaDropdownAbierto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelAbierto, vistaDropdownAbierto])

  /* Manejar cambio con debounce */
  const manejarCambio = useCallback((v: string) => {
    setValorInterno(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (v.length >= 2 || v.length === 0) {
      timerRef.current = setTimeout(() => onBusqueda(v), 400)
    }
  }, [onBusqueda])

  /* Limpiar todo */
  const limpiarTodo = () => {
    setValorInterno('')
    onBusqueda('')
    onLimpiarFiltros?.()
    inputRef.current?.focus()
  }

  /* Manejar Escape */
  const manejarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (panelAbierto) {
        setPanelAbierto(false)
      } else if (valorInterno) {
        setValorInterno('')
        onBusqueda('')
      } else {
        inputRef.current?.blur()
      }
    }
  }

  /* Obtener pills de filtros activos para mostrar en la cápsula */
  const filtrosConValor = filtros.filter((f) => {
    if (Array.isArray(f.valor)) return f.valor.length > 0
    return f.valor !== ''
  })

  const placeholderDinamico = generarPlaceholder(placeholder, contadorResultados, numFiltrosActivos)

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      {/* Cápsula principal */}
      <motion.div
        animate={{ maxWidth: enfocado ? '100%' : '100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={[
          'flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-superficie-tarjeta transition-all duration-200',
          enfocado
            ? 'border-borde-foco shadow-foco'
            : 'border-borde-sutil hover:border-borde-fuerte',
        ].join(' ')}
      >
        {/* Icono lupa */}
        <span className="text-texto-terciario shrink-0">
          <Search size={16} />
        </span>

        {/* Input de búsqueda */}
        <input
          ref={inputRef}
          type="text"
          value={valorInterno}
          onChange={(e) => manejarCambio(e.target.value)}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          onKeyDown={manejarKeyDown}
          placeholder={placeholderDinamico}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-terciario md:text-sm text-md"
        />

        {/* Pills de filtros activos */}
        <AnimatePresence mode="popLayout">
          {filtrosConValor.map((f) => {
            const valorTexto = Array.isArray(f.valor)
              ? `${f.valor.length} selec.`
              : f.opciones?.find((o) => o.valor === f.valor)?.etiqueta || f.valor
            return (
              <PillFiltroActivo
                key={f.id}
                etiqueta={f.etiqueta}
                valor={valorTexto}
                onRemover={() => f.onChange(Array.isArray(f.valor) ? [] : '')}
              />
            )
          })}
        </AnimatePresence>

        {/* Separador visual */}
        {(filtros.length > 0 || plantillas || opcionesVista) && (
          <div className="w-px h-5 bg-borde-sutil shrink-0 mx-0.5" />
        )}

        {/* Botón favorito activo */}
        {plantillaActivaId && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onAplicarPlantilla?.('')}
            className="shrink-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-insignia-advertencia-texto transition-colors"
            title="Quitar vista guardada"
          >
            <Bookmark size={16} fill="currentColor" />
          </motion.button>
        )}

        {/* Botón guardar vista (solo si hay filtros sin guardar) */}
        {!plantillaActivaId && hayAlgoActivo && onGuardarNuevaPlantilla && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => setPanelAbierto(true)}
            className="shrink-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-secundario transition-colors"
            title="Guardar vista"
          >
            <Bookmark size={16} />
          </motion.button>
        )}

        {/* Botón filtros */}
        {(filtros.length > 0 || (pillsGrupos && pillsGrupos.length > 0) || (plantillas && plantillas.length > 0)) && (
          <motion.button
            type="button"
            animate={{ rotate: panelAbierto ? 180 : 0 }}
            transition={{ duration: 0.25 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setPanelAbierto(!panelAbierto)}
            className="relative shrink-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-secundario transition-colors"
            title="Filtros"
          >
            <SlidersHorizontal size={16} />
            {numFiltrosActivos > 0 && (
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-insignia-peligro" />
            )}
          </motion.button>
        )}

        {/* Botón columnas (solo desktop) */}
        {mostrarBotonColumnas && onAbrirColumnas && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={onAbrirColumnas}
            className="hidden md:inline-flex shrink-0 size-7 items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-secundario transition-colors"
            title="Columnas"
          >
            <Columns2 size={16} />
          </motion.button>
        )}

        {/* Selector de vistas */}
        {opcionesVista && opcionesVista.length > 0 && onCambiarVista && (
          <>
            {/* Desktop: botones separados */}
            <div className="hidden md:flex items-center gap-0.5">
              {opcionesVista.map((v) => (
                <motion.button
                  key={v.id}
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onCambiarVista(v.id)}
                  disabled={v.deshabilitada}
                  className={[
                    'shrink-0 size-7 inline-flex items-center justify-center rounded-md cursor-pointer border-none transition-colors',
                    v.id === vistaActual
                      ? 'bg-insignia-primario-fondo text-texto-marca'
                      : 'bg-transparent text-texto-terciario hover:bg-superficie-hover hover:text-texto-secundario',
                    v.deshabilitada ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                  title={v.etiqueta}
                >
                  {v.icono}
                </motion.button>
              ))}
            </div>
            {/* Mobile: dropdown */}
            <div className="relative md:hidden">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setVistaDropdownAbierto(!vistaDropdownAbierto)}
                className="shrink-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario"
              >
                <MoreVertical size={16} />
              </motion.button>
              <AnimatePresence>
                {vistaDropdownAbierto && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full right-0 mt-1 bg-superficie-elevada border border-borde-sutil rounded-md shadow-lg z-50 overflow-hidden min-w-[140px]"
                  >
                    {opcionesVista.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        disabled={v.deshabilitada}
                        onClick={() => { onCambiarVista(v.id); setVistaDropdownAbierto(false) }}
                        className={[
                          'flex items-center gap-2 w-full px-3 py-2 text-sm text-left border-none cursor-pointer transition-colors',
                          v.id === vistaActual
                            ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                            : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                          v.deshabilitada ? 'opacity-40 cursor-not-allowed' : '',
                        ].join(' ')}
                      >
                        {v.icono}
                        {v.etiqueta}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Botón limpiar todo */}
        {hayAlgoActivo && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.75, rotate: -90 }}
            onClick={limpiarTodo}
            className="shrink-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent text-insignia-peligro-texto transition-colors"
            title="Limpiar todo"
          >
            <X size={14} />
          </motion.button>
        )}
      </motion.div>

      {/* Panel desplegable de filtros */}
      <AnimatePresence>
        {panelAbierto && (
          <PanelFiltros
            filtros={filtros}
            pillsGrupos={pillsGrupos}
            plantillas={plantillas}
            plantillaActivaId={plantillaActivaId}
            onAplicarPlantilla={onAplicarPlantilla}
            onGuardarNuevaPlantilla={onGuardarNuevaPlantilla}
            onEliminarPlantilla={onEliminarPlantilla}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export { BarraBusqueda, type PropiedadesBarraBusqueda, type Filtro, type PillGrupo, type Plantilla, type OpcionVista }

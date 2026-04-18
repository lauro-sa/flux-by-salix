'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, Bookmark, Columns2, X } from 'lucide-react'
import type { PropiedadesBarraBusqueda } from './tipos'
import { contarFiltrosActivos, generarPlaceholder } from './tipos'
import { PillFiltroActivo } from './PillFiltroActivo'
import { PanelFiltros } from './PanelFiltros'
import { SelectorVistas } from './SelectorVistas'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'

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
  const { locale } = useFormato()
  const { t } = useTraduccion()
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

  const placeholderDinamico = generarPlaceholder(placeholder, contadorResultados, numFiltrosActivos, locale)

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      {/* Cápsula principal */}
      <motion.div
        animate={{ maxWidth: enfocado ? '100%' : '100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={[
          'flex items-center gap-1.5 px-3 py-2 rounded-card border bg-superficie-tarjeta transition-all duration-200',
          enfocado
            ? 'border-borde-foco shadow-foco'
            : 'border-borde-sutil hover:border-borde-fuerte',
          // Al abrir el panel de filtros, las caras inferiores quedan
          // planas para que busqueda + panel se vean como grupo segmentado.
          panelAbierto ? 'rounded-b-none!' : '',
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
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-placeholder md:text-sm text-md"
        />

        {/* Separador visual */}
        {(filtros.length > 0 || plantillas || opcionesVista) && (
          <div className="w-px h-5 bg-borde-sutil shrink-0 mx-0.5" />
        )}

        {/* Botón favorito activo */}
        {plantillaActivaId && (
          <Tooltip contenido="Quitar vista guardada">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => onAplicarPlantilla?.('')}
              className="shrink-0 size-7 inline-flex items-center justify-center rounded-boton hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-insignia-advertencia-texto transition-colors"
            >
              <Bookmark size={16} fill="currentColor" />
            </motion.button>
          </Tooltip>
        )}

        {/* Botón guardar vista (solo si hay filtros sin guardar) */}
        {!plantillaActivaId && hayAlgoActivo && onGuardarNuevaPlantilla && (
          <Tooltip contenido="Guardar vista">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setPanelAbierto(true)}
              className="shrink-0 size-7 inline-flex items-center justify-center rounded-boton hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-secundario transition-colors"
            >
              <Bookmark size={16} />
            </motion.button>
          </Tooltip>
        )}

        {/* Botón filtros */}
        {(filtros.length > 0 || (pillsGrupos && pillsGrupos.length > 0) || (plantillas && plantillas.length > 0)) && (
          <Tooltip contenido="Filtros">
            <motion.button
              type="button"
              animate={{ rotate: panelAbierto ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setPanelAbierto(!panelAbierto)}
              className="relative shrink-0 size-7 inline-flex items-center justify-center rounded-boton hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-secundario transition-colors"
            >
              <SlidersHorizontal size={16} />
              {numFiltrosActivos > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-insignia-peligro" />
              )}
            </motion.button>
          </Tooltip>
        )}

        {/* Botón columnas (solo desktop) */}
        {mostrarBotonColumnas && onAbrirColumnas && (
          <Tooltip contenido="Columnas">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={onAbrirColumnas}
              className="hidden md:inline-flex shrink-0 size-7 items-center justify-center rounded-boton hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-secundario transition-colors"
            >
              <Columns2 size={16} />
            </motion.button>
          </Tooltip>
        )}

        {/* Selector de vistas */}
        {opcionesVista && opcionesVista.length > 0 && onCambiarVista && (
          <SelectorVistas
            vistaActual={vistaActual}
            opciones={opcionesVista}
            onCambiarVista={onCambiarVista}
            dropdownAbierto={vistaDropdownAbierto}
            onToggleDropdown={setVistaDropdownAbierto}
          />
        )}

        {/* Botón limpiar todo */}
        {hayAlgoActivo && (
          <Tooltip contenido={t('paginacion.limpiar_todo')}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.75, rotate: -90 }}
              onClick={limpiarTodo}
              className="shrink-0 size-7 inline-flex items-center justify-center rounded-boton hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent text-insignia-peligro-texto transition-colors"
            >
              <X size={14} />
            </motion.button>
          </Tooltip>
        )}
      </motion.div>

      {/* Pills de filtros activos — debajo de la cápsula para no comprimir los botones */}
      {filtrosConValor.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 px-1">
          <AnimatePresence mode="popLayout">
            {filtrosConValor.map((f) => {
              const valorTexto = Array.isArray(f.valor)
                ? f.valor.map(v => f.opciones?.find(o => o.valor === v)?.etiqueta || v).join(', ')
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
          {filtrosConValor.length > 1 && onLimpiarFiltros && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileTap={{ scale: 0.9 }}
              onClick={limpiarTodo}
              className="text-xxs text-texto-terciario hover:text-insignia-peligro-texto cursor-pointer border-none bg-transparent transition-colors"
            >
              {t('paginacion.limpiar_todo')}
            </motion.button>
          )}
        </div>
      )}

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

export { BarraBusqueda }

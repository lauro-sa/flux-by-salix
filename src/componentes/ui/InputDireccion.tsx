/**
 * InputDireccion — Campo de búsqueda de direcciones con autocompletado de Google Places.
 * Reutiliza el estilo visual del componente Input.
 * Se usa en: formularios de contactos, visitas, empresas, o cualquier campo de dirección.
 */

'use client'

import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { MapPin, Loader2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useBuscadorDirecciones } from '@/hooks/useBuscadorDirecciones'
import type { Direccion, SugerenciaDireccion } from '@/tipos/direccion'

interface PropiedadesInputDireccion {
  /** Etiqueta del campo */
  etiqueta?: string
  /** Placeholder del input */
  placeholder?: string
  /** Mensaje de error */
  error?: string
  /** Texto de ayuda */
  ayuda?: string
  /** Valor inicial (texto de dirección) */
  valorInicial?: string
  /** Códigos de país ISO para restringir (ej: ['AR', 'UY']) */
  paises?: string[]
  /** Modo compacto (menos padding) */
  compacto?: boolean
  /** Callback al seleccionar una dirección */
  alSeleccionar?: (direccion: Direccion) => void
  /** Callback al limpiar la dirección */
  alLimpiar?: () => void
  /** Clase CSS adicional para el contenedor */
  className?: string
  /** Deshabilitado */
  deshabilitado?: boolean
  /** Ocultar el indicador de dirección seleccionada (cuando se usa dentro de BloqueDireccion) */
  ocultarDetalle?: boolean
}

export function InputDireccion({
  etiqueta,
  placeholder = 'Buscar dirección...',
  error,
  ayuda,
  valorInicial,
  paises,
  compacto,
  alSeleccionar,
  alLimpiar,
  className = '',
  deshabilitado = false,
  ocultarDetalle = false,
}: PropiedadesInputDireccion) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const indiceActivo = useRef(-1)

  const {
    texto,
    sugerencias,
    cargando,
    error: errorBuscador,
    abierto,
    direccionSeleccionada,
    cambiarTexto,
    seleccionar,
    cerrar,
    limpiar,
    establecerTexto,
  } = useBuscadorDirecciones({
    paises,
    alSeleccionar,
  })

  // Establecer valor inicial
  useEffect(() => {
    if (valorInicial) establecerTexto(valorInicial)
  }, [valorInicial, establecerTexto])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function manejarClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        cerrar()
      }
    }
    document.addEventListener('mousedown', manejarClicFuera)
    return () => document.removeEventListener('mousedown', manejarClicFuera)
  }, [cerrar])

  // Navegación con teclado en el dropdown
  const manejarTeclado = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!abierto || sugerencias.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      indiceActivo.current = Math.min(indiceActivo.current + 1, sugerencias.length - 1)
      actualizarItemActivo()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      indiceActivo.current = Math.max(indiceActivo.current - 1, 0)
      actualizarItemActivo()
    } else if (e.key === 'Enter' && indiceActivo.current >= 0) {
      e.preventDefault()
      seleccionar(sugerencias[indiceActivo.current])
      indiceActivo.current = -1
    } else if (e.key === 'Escape') {
      cerrar()
      indiceActivo.current = -1
    }
  }, [abierto, sugerencias, seleccionar, cerrar])

  function actualizarItemActivo() {
    const items = dropdownRef.current?.querySelectorAll('[data-sugerencia]')
    items?.forEach((item, i) => {
      if (i === indiceActivo.current) {
        item.classList.add('bg-superficie-elevada')
        item.scrollIntoView({ block: 'nearest' })
      } else {
        item.classList.remove('bg-superficie-elevada')
      }
    })
  }

  // Reset índice cuando cambian sugerencias
  useEffect(() => {
    indiceActivo.current = -1
  }, [sugerencias])

  const manejarLimpiar = () => {
    limpiar()
    alLimpiar?.()
    inputRef.current?.focus()
  }

  const errorMostrar = error || errorBuscador

  return (
    <div ref={contenedorRef} className={`relative flex flex-col gap-1 w-full ${className}`}>
      {etiqueta && (
        <label className={`text-sm font-medium ${errorMostrar ? 'text-insignia-peligro' : 'text-texto-secundario'}`}>
          {etiqueta}
        </label>
      )}

      {/* Input */}
      <div
        className={[
          'flex items-center gap-2 rounded-md border bg-superficie-tarjeta transition-all duration-150',
          compacto ? 'px-2 py-1' : 'px-3 py-2',
          deshabilitado ? 'opacity-50 cursor-not-allowed' : '',
          errorMostrar
            ? 'border-insignia-peligro'
            : 'border-borde-fuerte focus-within:border-borde-foco focus-within:shadow-foco',
        ].join(' ')}
      >
        <span className="text-texto-terciario shrink-0 flex items-center">
          {cargando ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <MapPin size={18} />
          )}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={texto}
          onChange={(e) => cambiarTexto(e.target.value)}
          onKeyDown={manejarTeclado}
          placeholder={placeholder}
          disabled={deshabilitado}
          autoComplete="off"
          className="flex-1 border-none outline-none bg-transparent text-texto-primario text-sm font-[inherit] leading-normal w-full placeholder:text-texto-terciario"
        />

        {/* Botón limpiar */}
        {texto && !deshabilitado && (
          <button
            type="button"
            tabIndex={-1}
            onClick={manejarLimpiar}
            className="text-texto-terciario hover:text-texto-secundario transition-colors bg-transparent border-none cursor-pointer p-0 flex items-center"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Indicador de dirección seleccionada — se oculta cuando se usa dentro de BloqueDireccion */}
      {!ocultarDetalle && direccionSeleccionada && !abierto && (
        <div className="flex items-center gap-1.5 text-xs text-texto-terciario">
          <MapPin size={12} className="text-insignia-exito shrink-0" />
          <span className="truncate">
            {[
              direccionSeleccionada.barrio,
              direccionSeleccionada.ciudad,
              direccionSeleccionada.provincia,
            ].filter(Boolean).join(', ')}
          </span>
          {direccionSeleccionada.coordenadas && (
            <span className="text-texto-terciario/50 ml-auto shrink-0">
              {direccionSeleccionada.coordenadas.lat.toFixed(4)}, {direccionSeleccionada.coordenadas.lng.toFixed(4)}
            </span>
          )}
        </div>
      )}

      {/* Dropdown de sugerencias */}
      <AnimatePresence>
        {abierto && sugerencias.length > 0 && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-borde-fuerte bg-superficie-tarjeta shadow-lg overflow-hidden max-h-[360px] overflow-y-auto"
          >
            {sugerencias.map((sugerencia: SugerenciaDireccion) => (
              <button
                key={sugerencia.placeId}
                data-sugerencia
                type="button"
                onClick={() => seleccionar(sugerencia)}
                className="w-full text-left px-3 py-2.5 hover:bg-superficie-elevada transition-colors cursor-pointer border-none bg-transparent flex items-start gap-2.5"
              >
                <MapPin size={16} className="text-texto-terciario shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-texto-primario truncate">
                    {sugerencia.textoPrincipal}
                  </div>
                  <div className="text-xs text-texto-terciario truncate">
                    {sugerencia.textoSecundario}
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sin resultados */}
      <AnimatePresence>
        {abierto && sugerencias.length === 0 && !cargando && texto.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-borde-fuerte bg-superficie-tarjeta shadow-lg px-3 py-3 text-sm text-texto-terciario text-center"
          >
            No se encontraron direcciones
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error o ayuda */}
      {(errorMostrar || ayuda) && (
        <span className={`text-xs ${errorMostrar ? 'text-insignia-peligro' : 'text-texto-terciario'}`}>
          {errorMostrar || ayuda}
        </span>
      )}
    </div>
  )
}

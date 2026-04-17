'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Package, Wrench, Plus } from 'lucide-react'
import { COLOR_TIPO_PRODUCTO } from '@/lib/colores_entidad'
import { useFormato } from '@/hooks/useFormato'

/**
 * BuscadorProducto — Autocompletado de productos/servicios para líneas de presupuesto.
 * Al seleccionar un producto, devuelve código, nombre, precio, impuesto, unidad y descripción de venta.
 * Se puede usar también para escribir texto libre (no obliga a seleccionar del catálogo).
 */

interface ProductoBusqueda {
  id: string
  codigo: string
  nombre: string
  tipo: string
  precio_unitario: string | null
  costo: string | null
  moneda: string | null
  unidad: string
  impuesto_id: string | null
  descripcion_venta: string | null
  categoria: string | null
}

interface PropsBuscadorProducto {
  /** Valor actual del campo de texto (descripción/nombre) */
  valor: string
  /** Código de producto actual */
  codigo: string
  /** Se llama al escribir texto libre */
  onChange: (valor: string) => void
  /** Se llama al seleccionar un producto del catálogo */
  onSeleccionar: (producto: ProductoBusqueda) => void
  /** Placeholder del campo */
  placeholder?: string
  /** Modo solo lectura */
  soloLectura?: boolean
  /** Clase CSS extra */
  className?: string
  /** Foco automático al montar (para líneas recién agregadas) */
  autoFocus?: boolean
}

export function BuscadorProducto({
  valor,
  codigo,
  onChange,
  onSeleccionar,
  placeholder = 'Producto / Servicio',
  soloLectura = false,
  className = '',
  autoFocus = false,
}: PropsBuscadorProducto) {
  const { locale, moneda: fmtMoneda } = useFormato()
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(-1)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Búsqueda con debounce
  const buscar = useCallback(async (texto: string) => {
    if (!texto.trim()) {
      setResultados([])
      setAbierto(false)
      return
    }

    setCargando(true)
    try {
      const res = await fetch(`/api/productos/buscar?q=${encodeURIComponent(texto)}`)
      if (res.ok) {
        const data = await res.json()
        setResultados(data)
        setAbierto(data.length > 0)
        setIndiceActivo(-1)
      }
    } catch {
      // silenciar
    } finally {
      setCargando(false)
    }
  }, [])

  const manejarCambio = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const texto = e.target.value
    setBusqueda(texto)
    onChange(texto)

    // Debounce de búsqueda
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => buscar(texto), 250)
  }, [onChange, buscar])

  const manejarSeleccion = useCallback((producto: ProductoBusqueda) => {
    setBusqueda(producto.nombre)
    setAbierto(false)
    setResultados([])
    onSeleccionar(producto)
  }, [onSeleccionar])

  // Navegación con teclado
  const manejarTecla = useCallback((e: React.KeyboardEvent) => {
    if (!abierto || resultados.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceActivo(prev => Math.min(prev + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceActivo(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && indiceActivo >= 0) {
      e.preventDefault()
      manejarSeleccion(resultados[indiceActivo])
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }, [abierto, resultados, indiceActivo, manejarSeleccion])

  // Posición del dropdown (portal)
  const [posDropdown, setPosDropdown] = useState<{ top: number; left: number; width: number; haciaArriba: boolean } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const DROPDOWN_MAX_H = 240

  const calcularPosicion = useCallback(() => {
    if (!contenedorRef.current) return
    const rect = contenedorRef.current.getBoundingClientRect()
    const espacioAbajo = window.innerHeight - rect.bottom
    const espacioArriba = rect.top
    const haciaArriba = espacioAbajo < DROPDOWN_MAX_H + 8 && espacioArriba > espacioAbajo

    setPosDropdown({
      top: haciaArriba ? rect.top : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 320),
      haciaArriba,
    })
  }, [])

  // Recalcular posición al abrir y al hacer scroll/resize
  useEffect(() => {
    if (!abierto) return
    calcularPosicion()
    const recalc = () => calcularPosicion()
    window.addEventListener('scroll', recalc, true)
    window.addEventListener('resize', recalc)
    return () => {
      window.removeEventListener('scroll', recalc, true)
      window.removeEventListener('resize', recalc)
    }
  }, [abierto, calcularPosicion])

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        contenedorRef.current && !contenedorRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  // Sync valor externo
  useEffect(() => {
    setBusqueda(valor)
  }, [valor])

  // Auto-focus al montar (línea recién agregada)
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // requestAnimationFrame para esperar que el DOM se estabilice tras agregar la fila
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  // Solo al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup timeout
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  if (soloLectura) {
    return (
      <div className={className}>
        {codigo && <span className="font-mono text-xxs text-texto-terciario block">{codigo}</span>}
        <span className="font-semibold text-sm text-texto-primario">{valor || '—'}</span>
      </div>
    )
  }

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      {/* Código (solo si existe) */}
      {codigo && (
        <span className="font-mono text-xxs text-texto-terciario block mb-0.5">{codigo}</span>
      )}

      {/* Input de búsqueda */}
      <div className="relative">
        <input
          ref={inputRef}
          value={busqueda}
          onChange={manejarCambio}
          onKeyDown={manejarTecla}
          onFocus={() => {
            if (busqueda.trim() && resultados.length > 0) setAbierto(true)
          }}
          placeholder={placeholder}
          className="w-full bg-transparent border-none outline-none text-sm font-semibold text-texto-primario placeholder:text-texto-placeholder py-0.5"
        />
        {cargando && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <Search size={12} className="text-texto-terciario animate-pulse" />
          </div>
        )}
      </div>

      {/* Dropdown de resultados — portal para escapar overflow de la tabla */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && resultados.length > 0 && posDropdown && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: posDropdown.haciaArriba ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: posDropdown.haciaArriba ? 4 : -4 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[var(--z-popover)] bg-superficie-elevada border border-borde-sutil rounded-xl shadow-lg overflow-hidden"
              style={{
                top: posDropdown.haciaArriba ? undefined : posDropdown.top,
                bottom: posDropdown.haciaArriba ? window.innerHeight - posDropdown.top + 4 : undefined,
                left: posDropdown.left,
                width: posDropdown.width,
              }}
            >
              <div className="max-h-[240px] overflow-y-auto py-1">
                {resultados.map((producto, i) => {
                  const color = COLOR_TIPO_PRODUCTO[producto.tipo] || 'neutro'
                  const precioStr = producto.precio_unitario && parseFloat(producto.precio_unitario) > 0
                    ? fmtMoneda(parseFloat(producto.precio_unitario))
                    : null

                  return (
                    <button
                      key={producto.id}
                      type="button"
                      onClick={() => manejarSeleccion(producto)}
                      onMouseEnter={() => setIndiceActivo(i)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                        i === indiceActivo ? 'bg-superficie-app' : 'hover:bg-superficie-app/50'
                      }`}
                    >
                      {/* Icono tipo */}
                      <div
                        className="size-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}
                      >
                        {producto.tipo === 'servicio' ? <Wrench size={13} /> : <Package size={13} />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-texto-primario truncate">{producto.nombre}</div>
                        <div className="flex items-center gap-2 text-xxs text-texto-terciario">
                          <span className="font-mono">{producto.codigo}</span>
                          {producto.categoria && (
                            <>
                              <span>·</span>
                              <span>{producto.categoria}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{producto.unidad}</span>
                        </div>
                      </div>

                      {/* Precio */}
                      {precioStr && (
                        <span className="text-sm font-mono font-medium text-texto-primario shrink-0">{precioStr}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

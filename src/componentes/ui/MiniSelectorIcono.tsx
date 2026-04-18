'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { obtenerIcono, obtenerTodosLosIconos } from '@/componentes/ui/SelectorIcono'

/**
 * MiniSelectorIcono — popover compacto con búsqueda para elegir un icono de Lucide.
 * Reemplaza al SelectorIcono grande cuando solo necesitás un botón con preview + dropdown.
 * Se usa en modales de configuración (tipos de actividad, sectores, etapas, etc).
 */

interface PropiedadesMiniSelectorIcono {
  valor: string
  color: string
  onChange: (icono: string) => void
  /** Iconos mostrados cuando el buscador está vacío. Si se omite, usa una paleta genérica. */
  iconosRapidos?: string[]
  titulo?: string
}

const ICONOS_RAPIDOS_DEFAULT = [
  'Star', 'Heart', 'Zap', 'Target', 'Award', 'Flag', 'Bookmark', 'Tag',
  'User', 'Users', 'Building', 'Building2', 'Briefcase', 'Shield', 'Crown',
  'Phone', 'Mail', 'MessageSquare', 'Calendar', 'Clock', 'Bell', 'FileText',
  'Package', 'Truck', 'MapPin', 'Globe', 'Settings', 'Wrench', 'Hammer',
  'ShoppingCart', 'CreditCard', 'DollarSign', 'TrendingUp', 'BarChart3',
  'GraduationCap', 'BookOpen', 'Camera', 'Wifi',
]

function MiniSelectorIcono({
  valor,
  color,
  onChange,
  iconosRapidos = ICONOS_RAPIDOS_DEFAULT,
  titulo = 'Cambiar icono',
}: PropiedadesMiniSelectorIcono) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const botonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [posicion, setPosicion] = useState({ top: 0, left: 0 })
  const IconoActual = obtenerIcono(valor)

  useLayoutEffect(() => {
    if (!abierto || !botonRef.current) return
    const rect = botonRef.current.getBoundingClientRect()
    setPosicion({ top: rect.bottom + 6, left: rect.left })
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (botonRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const reposicionar = () => {
      if (botonRef.current) {
        const rect = botonRef.current.getBoundingClientRect()
        setPosicion({ top: rect.bottom + 6, left: rect.left })
      }
    }
    window.addEventListener('scroll', reposicionar, true)
    window.addEventListener('resize', reposicionar)
    return () => {
      window.removeEventListener('scroll', reposicionar, true)
      window.removeEventListener('resize', reposicionar)
    }
  }, [abierto])

  const iconosFiltrados = busqueda.trim()
    ? obtenerTodosLosIconos().filter(k => k.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 72)
    : iconosRapidos

  return (
    <div className="relative shrink-0">
      <button
        ref={botonRef}
        onClick={() => { setAbierto(!abierto); setBusqueda('') }}
        className="size-11 rounded-card flex items-center justify-center cursor-pointer border border-borde-sutil hover:border-texto-marca/40 transition-colors"
        style={{ backgroundColor: color + '15', color }}
        title={titulo}
      >
        {IconoActual && <IconoActual size={20} />}
      </button>

      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="fixed bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden w-[280px]"
              style={{ top: posicion.top, left: posicion.left, zIndex: 'var(--z-popover)' as unknown as number }}
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-borde-sutil">
                <Search size={13} className="text-texto-terciario shrink-0" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar icono..."
                  autoFocus
                  className="flex-1 bg-transparent border-none text-xs text-texto-primario placeholder:text-texto-terciario outline-none"
                />
              </div>
              <div className="grid grid-cols-8 gap-0.5 p-1.5 max-h-[240px] overflow-y-auto">
                {iconosFiltrados.map(nombre => {
                  const Ic = obtenerIcono(nombre)
                  if (!Ic) return null
                  const sel = valor === nombre
                  return (
                    <Tooltip key={nombre} contenido={nombre}>
                      <button
                        onClick={() => { onChange(nombre); setAbierto(false) }}
                        className={`size-8 rounded-boton flex items-center justify-center cursor-pointer transition-colors border-none ${
                          sel ? 'bg-texto-marca/15 text-texto-marca' : 'bg-transparent text-texto-terciario hover:bg-superficie-hover hover:text-texto-primario'
                        }`}
                      >
                        <Ic size={15} />
                      </button>
                    </Tooltip>
                  )
                })}
              </div>
              {!busqueda.trim() && (
                <div className="px-3 py-1.5 border-t border-borde-sutil">
                  <p className="text-[10px] text-texto-terciario text-center">Buscá para ver todos los iconos</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

export { MiniSelectorIcono, type PropiedadesMiniSelectorIcono }

'use client'

/**
 * BuscadorContactoPreview — Buscador de contacto con recientes, avatares y búsqueda.
 * Se usa en: ModalEditorPlantillaCorreo, sección de selección de contacto para preview.
 */

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { iniciales, colorAvatar } from './utilidades'
import type { ContactoResultado } from './tipos'

interface PropiedadesBuscadorContactoPreview {
  onSeleccionar: (id: string) => void
  cargando: boolean
}

export function BuscadorContactoPreview({
  onSeleccionar,
  cargando,
}: PropiedadesBuscadorContactoPreview) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ContactoResultado[]>([])
  const [recientes, setRecientes] = useState<ContactoResultado[]>([])
  const [mostrar, setMostrar] = useState(false)
  const [cargandoRecientes, setCargandoRecientes] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cargar recientes al montar
  useEffect(() => {
    setCargandoRecientes(true)
    fetch('/api/contactos?limite=8&orden=actualizado_en_desc')
      .then(r => r.json())
      .then(data => setRecientes(data.contactos || []))
      .catch(() => {})
      .finally(() => setCargandoRecientes(false))
  }, [])

  // Busqueda con debounce
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (busqueda.length < 2) { setResultados([]); return }
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contactos/buscar?q=${encodeURIComponent(busqueda)}`)
        const data = await res.json()
        setResultados(data.contactos || [])
      } catch { setResultados([]) }
    }, 250)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [busqueda])

  const lista = busqueda.length >= 2 ? resultados : recientes
  const handleFocus = () => setMostrar(true)
  const handleBlur = () => setTimeout(() => setMostrar(false), 200)

  const renderContacto = (c: ContactoResultado) => {
    const nombre = `${c.nombre} ${c.apellido || ''}`.trim()
    return (
      <button
        key={c.id}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--superficie-hover)]"
        onMouseDown={(e) => { e.preventDefault(); onSeleccionar(c.id); setBusqueda(''); setMostrar(false) }}
      >
        <span
          className="size-7 rounded-full flex items-center justify-center text-xxs font-bold flex-shrink-0"
          style={{ background: colorAvatar(nombre), color: 'white' }}
        >
          {iniciales(c.nombre, c.apellido)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--texto-primario)' }}>{nombre}</p>
          {c.correo && <p className="text-xs truncate" style={{ color: 'var(--texto-terciario)' }}>{c.correo}</p>}
        </div>
      </button>
    )
  }

  return (
    <div className="relative flex-1">
      <div className="flex items-center gap-1.5" style={{ borderBottom: '1.5px solid var(--borde-fuerte)' }}>
        <input
          ref={inputRef}
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Buscar contacto..."
          className="flex-1 text-sm bg-transparent outline-none py-1.5"
          style={{ color: 'var(--texto-primario)' }}
        />
        {busqueda && (
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={<X size={14} />}
            titulo="Limpiar búsqueda"
            onClick={() => { setBusqueda(''); inputRef.current?.focus() }}
          />
        )}
      </div>

      {mostrar && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-elevada max-h-[280px] overflow-y-auto"
          style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
        >
          {cargandoRecientes && lista.length === 0 ? (
            <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--texto-terciario)' }}>Cargando...</p>
          ) : lista.length > 0 ? (
            <div className="py-1">
              {lista.map(renderContacto)}
            </div>
          ) : busqueda.length >= 2 ? (
            <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--texto-terciario)' }}>Sin resultados</p>
          ) : null}
        </div>
      )}

      {cargando && <span className="absolute right-0 top-1 text-xxs" style={{ color: 'var(--texto-terciario)' }}>Cargando...</span>}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Search } from 'lucide-react'
import type { PlantillaRespuesta, TipoCanal } from '@/tipos/inbox'

/**
 * Selector de respuestas rápidas — popup que aparece al escribir `/` en el compositor.
 * Carga plantillas desde /api/inbox/plantillas filtrando por canal.
 * El usuario puede buscar, navegar con flechas y seleccionar con Enter.
 */

interface PropiedadesSelectorRR {
  visible: boolean
  canal: TipoCanal
  filtro: string
  onSeleccionar: (contenido: string, contenidoHtml?: string) => void
  onCerrar: () => void
}

export function SelectorRespuestasRapidas({
  visible,
  canal,
  filtro,
  onSeleccionar,
  onCerrar,
}: PropiedadesSelectorRR) {
  const [plantillas, setPlantillas] = useState<PlantillaRespuesta[]>([])
  const [cargando, setCargando] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(0)
  const listaRef = useRef<HTMLDivElement>(null)

  // Cargar plantillas cuando se abre el selector
  useEffect(() => {
    if (!visible) return
    setCargando(true)
    fetch(`/api/inbox/plantillas?canal=${canal}`)
      .then(res => res.json())
      .then(data => setPlantillas(data.plantillas || []))
      .catch(() => setPlantillas([]))
      .finally(() => setCargando(false))
  }, [visible, canal])

  // Ordenar: por campo orden, luego alfabéticamente
  const plantillasOrdenadas = [...plantillas].sort((a, b) => {
    if (a.orden !== b.orden) return a.orden - b.orden
    return a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
  })

  // Filtrar plantillas por nombre o contenido según lo que escribió el usuario después de `/`
  const plantillasFiltradas = plantillasOrdenadas.filter(p => {
    if (!filtro) return true
    const texto = filtro.toLowerCase()
    return (
      p.nombre.toLowerCase().includes(texto) ||
      p.contenido.toLowerCase().includes(texto)
    )
  })

  // Resetear índice activo cuando cambia el filtro
  useEffect(() => {
    setIndiceActivo(0)
  }, [filtro])

  // Scroll automático al item activo
  useEffect(() => {
    if (!listaRef.current) return
    const items = listaRef.current.querySelectorAll('[data-item]')
    items[indiceActivo]?.scrollIntoView({ block: 'nearest' })
  }, [indiceActivo])

  // Navegación con teclado (se maneja desde el compositor)
  const manejarTeclado = useCallback((e: KeyboardEvent) => {
    if (!visible) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceActivo(i => Math.min(i + 1, plantillasFiltradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceActivo(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && plantillasFiltradas.length > 0) {
      e.preventDefault()
      const p = plantillasFiltradas[indiceActivo]
      onSeleccionar(p.contenido, p.contenido_html || undefined)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCerrar()
    }
  }, [visible, plantillasFiltradas, indiceActivo, onSeleccionar, onCerrar])

  useEffect(() => {
    if (!visible) return
    window.addEventListener('keydown', manejarTeclado)
    return () => window.removeEventListener('keydown', manejarTeclado)
  }, [visible, manejarTeclado])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-0 right-0 mx-3 mb-1 rounded-lg overflow-hidden shadow-lg z-20"
          style={{
            background: 'var(--superficie-elevada)',
            border: '1px solid var(--borde-sutil)',
            maxHeight: 280,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: '1px solid var(--borde-sutil)' }}
          >
            <Zap size={12} style={{ color: 'var(--texto-marca)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
              Respuestas rápidas
            </span>
            {filtro && (
              <span className="text-xs ml-auto" style={{ color: 'var(--texto-terciario)' }}>
                <Search size={10} className="inline mr-1" />
                {filtro}
              </span>
            )}
          </div>

          {/* Lista */}
          <div ref={listaRef} className="overflow-y-auto" style={{ maxHeight: 230 }}>
            {cargando ? (
              <div className="px-3 py-4 text-center">
                <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                  Cargando...
                </span>
              </div>
            ) : plantillasFiltradas.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                  {plantillas.length === 0
                    ? 'No hay respuestas rápidas configuradas'
                    : 'Sin resultados para esta búsqueda'}
                </span>
              </div>
            ) : (
              plantillasFiltradas.map((plantilla, i) => (
                <div
                  key={plantilla.id}
                  data-item
                  className="px-3 py-2 cursor-pointer transition-colors"
                  style={{
                    background: i === indiceActivo ? 'var(--superficie-hover)' : 'transparent',
                  }}
                  onClick={() => onSeleccionar(plantilla.contenido, plantilla.contenido_html || undefined)}
                  onMouseEnter={() => setIndiceActivo(i)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>
                      {plantilla.nombre}
                    </span>
                  </div>
                  <p
                    className="text-xxs mt-0.5 line-clamp-1"
                    style={{ color: 'var(--texto-terciario)' }}
                  >
                    {plantilla.contenido}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Footer con hint */}
          {plantillasFiltradas.length > 0 && (
            <div
              className="px-3 py-1.5 text-xxs flex items-center gap-3"
              style={{
                borderTop: '1px solid var(--borde-sutil)',
                color: 'var(--texto-terciario)',
              }}
            >
              <span>↑↓ navegar</span>
              <span>↵ seleccionar</span>
              <span>esc cerrar</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

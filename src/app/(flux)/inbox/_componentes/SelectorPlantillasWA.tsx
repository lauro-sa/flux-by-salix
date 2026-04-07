'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, FileText, Send, Clock, AlertTriangle } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import type { PlantillaWhatsApp } from '@/tipos/inbox'

/**
 * SelectorPlantillasWA — Panel para seleccionar y enviar plantillas de WhatsApp aprobadas.
 * Se muestra cuando la ventana de 24h está cerrada o cuando el usuario abre el botón de plantillas.
 */

interface PropiedadesSelectorPlantillas {
  canalId: string
  abierto: boolean
  onCerrar: () => void
  onEnviarPlantilla: (plantilla: PlantillaWhatsApp) => void
  enviando?: boolean
}

/** Reemplaza {{N}} por los ejemplos o "___" para preview */
function previewCuerpo(texto: string, ejemplos?: string[]): string {
  return texto.replace(/\{\{(\d+)\}\}/g, (_, num) => {
    const idx = parseInt(num) - 1
    return ejemplos?.[idx] || '___'
  })
}

/** Ícono de categoría de plantilla */
function iconoCategoria(categoria: string): string {
  switch (categoria) {
    case 'MARKETING': return '📢'
    case 'UTILITY': return '🔧'
    case 'AUTHENTICATION': return '🔐'
    default: return '📄'
  }
}

export function SelectorPlantillasWA({
  canalId,
  abierto,
  onCerrar,
  onEnviarPlantilla,
  enviando,
}: PropiedadesSelectorPlantillas) {
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Cargar plantillas aprobadas al abrir
  useEffect(() => {
    if (!abierto || !canalId) return
    setCargando(true)
    fetch(`/api/inbox/whatsapp/plantillas?canal_id=${canalId}`)
      .then(res => res.json())
      .then(data => {
        // Solo mostrar plantillas aprobadas por Meta
        const aprobadas = (data.plantillas || []).filter(
          (p: PlantillaWhatsApp) => p.estado_meta === 'APPROVED' && p.activo
        )
        setPlantillas(aprobadas)
      })
      .catch(() => setPlantillas([]))
      .finally(() => setCargando(false))
  }, [abierto, canalId])

  const plantillasFiltradas = busqueda.trim()
    ? plantillas.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.componentes?.cuerpo?.texto?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : plantillas

  if (!abierto) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="absolute bottom-full left-0 right-0 z-30"
        style={{
          background: 'var(--superficie-tarjeta)',
          borderTop: '1px solid var(--borde-sutil)',
          boxShadow: 'var(--sombra-lg)',
          maxHeight: '400px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          <div className="flex items-center gap-2">
            <FileText size={16} style={{ color: 'var(--texto-marca)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Plantillas de WhatsApp
            </span>
          </div>
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={16} />} onClick={onCerrar} titulo="Cerrar" />
        </div>

        {/* Buscador */}
        <div className="px-3 py-2">
          <Input
            compacto
            placeholder="Buscar plantilla..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icono={<Search size={14} />}
          />
        </div>

        {/* Lista */}
        <div className="overflow-y-auto px-2 pb-2" style={{ maxHeight: '300px' }}>
          {cargando ? (
            <div className="flex items-center justify-center py-8">
              <Clock size={16} className="animate-spin" style={{ color: 'var(--texto-terciario)' }} />
              <span className="ml-2 text-sm" style={{ color: 'var(--texto-terciario)' }}>Cargando plantillas...</span>
            </div>
          ) : plantillasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <AlertTriangle size={20} style={{ color: 'var(--texto-terciario)' }} />
              <span className="text-sm" style={{ color: 'var(--texto-terciario)' }}>
                {plantillas.length === 0
                  ? 'No hay plantillas aprobadas. Creá una desde Configuración → Inbox.'
                  : 'Sin resultados para la búsqueda.'}
              </span>
            </div>
          ) : (
            plantillasFiltradas.map(plantilla => (
              <button
                key={plantilla.id}
                onClick={() => onEnviarPlantilla(plantilla)}
                disabled={enviando}
                className="w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-colors"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--borde-sutil)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--superficie-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Nombre + categoría */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs">{iconoCategoria(plantilla.categoria)}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                    {plantilla.nombre}
                  </span>
                  <span
                    className="text-xxs px-1.5 py-0.5 rounded-full ml-auto"
                    style={{
                      background: 'color-mix(in srgb, var(--texto-marca) 10%, transparent)',
                      color: 'var(--texto-marca)',
                    }}
                  >
                    {plantilla.categoria.toLowerCase()}
                  </span>
                </div>

                {/* Preview del cuerpo */}
                {plantilla.componentes?.cuerpo && (
                  <p className="text-xs line-clamp-2" style={{ color: 'var(--texto-secundario)' }}>
                    {previewCuerpo(
                      plantilla.componentes.cuerpo.texto,
                      plantilla.componentes.cuerpo.ejemplos
                    )}
                  </p>
                )}

                {/* Footer: idioma + botón enviar */}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                    {plantilla.idioma.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1 text-xxs font-medium" style={{ color: 'var(--texto-marca)' }}>
                    <Send size={10} />
                    Enviar
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

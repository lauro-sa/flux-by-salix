'use client'

import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Pestana {
  etiqueta: string
  contenido: ReactNode
}

interface PropiedadesTarjetaConPestanas {
  pestanas: Pestana[]
  /** Título principal de la tarjeta (aparece arriba de las pestañas) */
  titulo?: string
  /** Subtítulo descriptivo (aparece debajo del título) */
  subtitulo?: string
  /** Slot de acciones en el header (botón "Ver todo", etc.) */
  acciones?: ReactNode
  /** Índice inicial seleccionado */
  indiceInicial?: number
  className?: string
}

/**
 * TarjetaConPestanas — Tarjeta con navegación por pestañas.
 * Se usa en: dashboard widgets que necesitan mostrar vistas alternativas
 * (ej: "Resumen" / "Por persona", "Embudo" / "Tendencia").
 */
function TarjetaConPestanas({
  pestanas,
  titulo,
  subtitulo,
  acciones,
  indiceInicial = 0,
  className = '',
}: PropiedadesTarjetaConPestanas) {
  const [activa, setActiva] = useState(indiceInicial)

  if (pestanas.length === 0) return null

  return (
    <div
      className={[
        'bg-superficie-tarjeta border border-borde-sutil rounded-card p-5',
        className,
      ].join(' ')}
    >
      {/* Título (si existe) */}
      {(titulo || subtitulo) && (
        <div className="mb-3">
          {titulo && <h3 className="text-sm font-semibold text-texto-primario">{titulo}</h3>}
          {subtitulo && <p className="text-xs text-texto-terciario mt-0.5">{subtitulo}</p>}
        </div>
      )}

      {/* Header: pestañas + acciones */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1 bg-superficie-hover/50 rounded-card p-0.5">
          {pestanas.map((p, i) => (
            <button
              key={i}
              onClick={() => setActiva(i)}
              className={[
                'relative px-3 py-1.5 text-xs font-medium rounded-boton transition-colors duration-150',
                activa === i
                  ? 'text-texto-primario'
                  : 'text-texto-terciario hover:text-texto-secundario',
              ].join(' ')}
            >
              {activa === i && (
                <motion.div
                  layoutId={`pestana-fondo-${pestanas.map(p => p.etiqueta).join('-')}`}
                  className="absolute inset-0 bg-superficie-tarjeta rounded-boton shadow-sm border border-borde-sutil"
                  transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
                />
              )}
              <span className="relative z-10">{p.etiqueta}</span>
            </button>
          ))}
        </div>
        {acciones && <div className="flex items-center gap-1 shrink-0">{acciones}</div>}
      </div>

      {/* Contenido de la pestaña activa */}
      <motion.div
        key={activa}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {pestanas[activa].contenido}
      </motion.div>
    </div>
  )
}

export { TarjetaConPestanas, type PropiedadesTarjetaConPestanas, type Pestana }

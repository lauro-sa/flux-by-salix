'use client'

import { type ReactNode } from 'react'

/* ─── Tipos ─── */

interface PropiedadesTarjetaPanel {
  /** Título uppercase que va arriba a la izquierda (ej: "ASISTENCIA") */
  titulo: string
  /** Texto suave a la derecha del título (ej: "del período") */
  subtitulo?: string
  /** Ícono pequeño antes del título */
  icono?: ReactNode
  /** Acción compacta a la derecha de la cabecera (ej: "Editar", "+ Nuevo") */
  accion?: ReactNode
  /** Padding interno del body. Default: 'md'. 'none' si el hijo maneja su propio padding */
  padding?: 'none' | 'sm' | 'md'
  /** Permite override del container (ej: highlight, borde distinto) */
  className?: string
  children: ReactNode
}

/**
 * TarjetaPanel — Tarjeta con cabecera (título + icono + acción) y cuerpo.
 * Se usa en: detalles de entidad (nómina, contactos, órdenes), dashboards,
 * pantallas de configuración. Mantiene tipografía y espaciado consistentes.
 *
 * Estructura:
 * - Cabecera delgada con título pequeño uppercase + opcional ícono y acción
 * - Separador sutil
 * - Cuerpo con padding configurable
 */
function TarjetaPanel({
  titulo,
  subtitulo,
  icono,
  accion,
  padding = 'md',
  className = '',
  children,
}: PropiedadesTarjetaPanel) {
  const paddingClase = padding === 'none' ? '' : padding === 'sm' ? 'p-4' : 'p-5'

  return (
    <div className={`bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          {icono && <span className="text-texto-terciario shrink-0">{icono}</span>}
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider truncate">
            {titulo}
            {subtitulo && <span className="ml-1.5 normal-case tracking-normal text-texto-terciario/80 font-normal">{subtitulo}</span>}
          </p>
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
      <div className={paddingClase}>
        {children}
      </div>
    </div>
  )
}

export { TarjetaPanel, type PropiedadesTarjetaPanel }

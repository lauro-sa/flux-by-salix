'use client'

import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

/* ─── Tipos ─── */

/** Sección del menú de configuración */
interface SeccionConfig {
  id: string
  etiqueta: string
  icono?: ReactNode
  /** Insignia opcional (ej: "Beta", "Nuevo") */
  insignia?: string
  /** Deshabilitada (gris, no clickeable) */
  deshabilitada?: boolean
}

interface PropiedadesPlantillaConfiguracion {
  /** Título de la configuración (ej: "Configuración de Contactos") */
  titulo: string

  /** Texto del botón de volver (ej: "Contactos") */
  volverTexto?: string

  /** Callback al presionar volver */
  onVolver?: () => void

  /** Secciones del menú lateral / tabs */
  secciones: SeccionConfig[]

  /** ID de la sección activa */
  seccionActiva: string

  /** Callback al cambiar de sección */
  onCambiarSeccion: (id: string) => void

  /** Contenido de la sección activa */
  children: ReactNode

  className?: string
}

/**
 * PlantillaConfiguracion — Plantilla para páginas de configuración con menú lateral.
 * Se usa en: configuración de cada sección (contactos > config), configuración global.
 *
 * Estructura:
 * - Cabecero: Volver + título
 * - Desktop: Menú lateral izquierdo + contenido derecho
 * - Mobile: Tabs horizontales scrolleables + contenido debajo
 */
function PlantillaConfiguracion({
  titulo,
  volverTexto = 'Volver',
  onVolver,
  secciones,
  seccionActiva,
  onCambiarSeccion,
  children,
  className = '',
}: PropiedadesPlantillaConfiguracion) {
  return (
    <div className={`flex flex-col h-full gap-6 p-4 md:p-6 ${className}`}>

      {/* ═══ CABECERO ═══ */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Botón volver */}
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            className="shrink-0 flex items-center gap-1 px-2 h-9 rounded-lg text-sm font-medium text-texto-secundario hover:text-texto-primario hover:bg-superficie-hover cursor-pointer border-none bg-transparent transition-colors"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">{volverTexto}</span>
          </button>
        )}

        {/* Separador */}
        {onVolver && (
          <div className="w-px h-6 bg-borde-sutil shrink-0" />
        )}

        <h1 className="text-xl font-bold text-texto-primario">{titulo}</h1>
      </div>

      {/* ═══ CONTENIDO ═══ */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 overflow-hidden">

        {/* ─── Menú lateral (desktop) / Tabs horizontales (mobile) ─── */}

        {/* Desktop: menú lateral */}
        <nav className="hidden md:flex flex-col gap-1 w-[220px] shrink-0 overflow-y-auto">
          {secciones.map((seccion) => {
            const activa = seccion.id === seccionActiva
            return (
              <button
                key={seccion.id}
                type="button"
                onClick={() => !seccion.deshabilitada && onCambiarSeccion(seccion.id)}
                disabled={seccion.deshabilitada}
                className={[
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left cursor-pointer border-none transition-colors relative',
                  activa
                    ? 'bg-superficie-seleccionada text-texto-marca'
                    : 'bg-transparent text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario',
                  seccion.deshabilitada ? 'opacity-40 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {seccion.icono && (
                  <span className={activa ? 'text-texto-marca' : 'text-texto-terciario'}>
                    {seccion.icono}
                  </span>
                )}
                <span className="flex-1 truncate">{seccion.etiqueta}</span>
                {seccion.insignia && (
                  <span className="text-xxs px-1.5 py-0.5 rounded-full bg-insignia-primario-fondo text-insignia-primario-texto font-medium">
                    {seccion.insignia}
                  </span>
                )}
                {/* Indicador activo */}
                {activa && (
                  <motion.div
                    layoutId="indicador-config"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ backgroundColor: 'var(--texto-marca)' }}
                    transition={{ type: 'spring', duration: 0.3 }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Mobile: tabs horizontales scrolleables */}
        <div className="md:hidden flex gap-1 overflow-x-auto pb-1 shrink-0 -mx-1 px-1">
          {secciones.map((seccion) => {
            const activa = seccion.id === seccionActiva
            return (
              <button
                key={seccion.id}
                type="button"
                onClick={() => !seccion.deshabilitada && onCambiarSeccion(seccion.id)}
                disabled={seccion.deshabilitada}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer border transition-colors shrink-0',
                  activa
                    ? 'border-texto-marca bg-insignia-primario-fondo text-texto-marca'
                    : 'border-borde-sutil bg-superficie-tarjeta text-texto-secundario',
                  seccion.deshabilitada ? 'opacity-40 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {seccion.icono}
                {seccion.etiqueta}
              </button>
            )
          })}
        </div>

        {/* ─── Contenido de la sección activa ─── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-6 md:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export { PlantillaConfiguracion, type PropiedadesPlantillaConfiguracion, type SeccionConfig }

'use client'

import { useRef, useEffect, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  /** Grupo al que pertenece (se renderiza como separador en el sidebar) */
  grupo?: string
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
 * - Mobile: Tabs horizontales scrolleables con grupos + contenido debajo
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
  /* ─── Auto-scroll del tab activo en mobile ─── */
  const refTabsMobile = useRef<HTMLDivElement>(null)

  const scrollAlTabActivo = useCallback(() => {
    if (!refTabsMobile.current) return
    const tabActivo = refTabsMobile.current.querySelector('[data-activo="true"]') as HTMLElement | null
    if (!tabActivo) return
    tabActivo.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [])

  useEffect(() => { scrollAlTabActivo() }, [seccionActiva, scrollAlTabActivo])

  /* ─── Agrupar secciones para mobile ─── */
  const gruposMobile = secciones.reduce<{ grupo: string | null; items: SeccionConfig[] }[]>((acc, seccion) => {
    const grupoActual = seccion.grupo || null
    const ultimo = acc[acc.length - 1]
    if (ultimo && ultimo.grupo === grupoActual) {
      ultimo.items.push(seccion)
    } else {
      acc.push({ grupo: grupoActual, items: [seccion] })
    }
    return acc
  }, [])

  return (
    <div className={`flex flex-col h-full max-h-full gap-4 md:gap-6 pl-4 pt-4 pb-4 md:pl-6 md:pt-6 md:pb-6 overflow-hidden ${className}`}>

      {/* ═══ CABECERO ═══ */}
      <div className="flex items-center gap-3 shrink-0 pr-4 md:pr-6">
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            className="flex items-center gap-1 text-sm font-medium text-texto-secundario hover:text-texto-primario transition-colors cursor-pointer bg-transparent border-none -ml-1 px-1.5 py-1 rounded-lg hover:bg-superficie-hover"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">{volverTexto}</span>
          </button>
        )}
        <h1 className="text-xl font-bold text-texto-primario">{titulo}</h1>
      </div>

      {/* ═══ CONTENIDO ═══ */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 md:gap-6 overflow-hidden">

        {/* ─── Desktop: menú lateral con soporte para grupos ─── */}
        <nav className="hidden md:flex flex-col gap-0.5 w-[220px] shrink-0 overflow-y-auto sidebar-scroll">
          {secciones.map((seccion, i) => {
            const activa = seccion.id === seccionActiva
            const grupoAnterior = i > 0 ? secciones[i - 1].grupo : null
            const mostrarGrupo = seccion.grupo && seccion.grupo !== grupoAnterior

            return (
              <div key={seccion.id}>
                {mostrarGrupo && (
                  <div className={`px-3 pt-3 pb-1.5 text-xxs font-bold uppercase tracking-wider text-texto-terciario ${i > 0 ? 'mt-2' : ''}`}>
                    {seccion.grupo}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => !seccion.deshabilitada && onCambiarSeccion(seccion.id)}
                  disabled={seccion.deshabilitada}
                  className={[
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left cursor-pointer border-none transition-colors relative',
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
              </div>
            )
          })}
        </nav>

        {/* ─── Mobile: tabs horizontales con grupos y auto-scroll ─── */}
        <div
          ref={refTabsMobile}
          className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 -mx-1 px-1 sidebar-scroll"
        >
          {gruposMobile.map((grupo, gi) => (
            <div key={grupo.grupo || `sin-grupo-${gi}`} className="flex items-center gap-1 shrink-0">
              {/* Separador visual entre grupos */}
              {gi > 0 && (
                <div className="w-px h-4 bg-borde-sutil mx-1 shrink-0" />
              )}
              {grupo.items.map((seccion) => {
                const activa = seccion.id === seccionActiva
                return (
                  <button
                    key={seccion.id}
                    type="button"
                    data-activo={activa}
                    onClick={() => !seccion.deshabilitada && onCambiarSeccion(seccion.id)}
                    disabled={seccion.deshabilitada}
                    className={[
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer border transition-colors shrink-0',
                      activa
                        ? 'border-texto-marca bg-insignia-primario-fondo text-texto-marca'
                        : 'border-transparent text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover',
                      seccion.deshabilitada ? 'opacity-40 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    {seccion.icono}
                    {seccion.etiqueta}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* ─── Contenido de la sección activa con animación ─── */}
        <div className="flex-1 min-w-0 overflow-y-auto overscroll-contain scroll-smooth scrollbar-auto-oculto">
          <div className="pb-6 pr-4 md:pr-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={seccionActiva}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-6 md:p-8"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

export { PlantillaConfiguracion, type PropiedadesPlantillaConfiguracion, type SeccionConfig }

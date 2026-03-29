'use client'

import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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

  /** Descripción corta para el header mobile (ej: "Canales, plantillas y automatización") */
  descripcion?: string

  /** Icono grande para el header mobile */
  iconoHeader?: ReactNode

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
 * - Mobile: Drill-down estilo iOS (header info → lista agrupada en tarjetas → contenido)
 */
function PlantillaConfiguracion({
  titulo,
  descripcion,
  iconoHeader,
  volverTexto = 'Volver',
  onVolver,
  secciones,
  seccionActiva,
  onCambiarSeccion,
  children,
  className = '',
}: PropiedadesPlantillaConfiguracion) {
  /* ─── Mobile: drill-down state ─── */
  const [mobileVistaContenido, setMobileVistaContenido] = useState(false)

  /* ─── Agrupar secciones ─── */
  const grupos = secciones.reduce<{ grupo: string | null; items: SeccionConfig[] }[]>((acc, seccion) => {
    const grupoActual = seccion.grupo || null
    const ultimo = acc[acc.length - 1]
    if (ultimo && ultimo.grupo === grupoActual) {
      ultimo.items.push(seccion)
    } else {
      acc.push({ grupo: grupoActual, items: [seccion] })
    }
    return acc
  }, [])

  const seleccionarSeccionMobile = (id: string) => {
    onCambiarSeccion(id)
    setMobileVistaContenido(true)
  }

  const volverAListaMobile = () => {
    setMobileVistaContenido(false)
  }

  const seccionActivaData = secciones.find(s => s.id === seccionActiva)

  return (
    <div className={`flex flex-col h-full max-h-full gap-4 md:gap-6 pl-4 pt-4 pb-4 md:pl-6 md:pt-6 md:pb-6 overflow-hidden ${className}`}>

      {/* ═══ CABECERO ═══ */}
      <div className="flex items-center gap-2 shrink-0 pr-4 md:pr-6">
        {/* Mobile: botón volver contextual */}
        {(onVolver || mobileVistaContenido) && (
          <button
            type="button"
            onClick={mobileVistaContenido ? volverAListaMobile : onVolver}
            className="md:hidden flex items-center gap-1 text-sm font-medium text-texto-secundario hover:text-texto-primario transition-colors cursor-pointer bg-transparent border-none -ml-1 px-1.5 py-1 rounded-lg hover:bg-superficie-hover"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Título desktop */}
        <h1 className="hidden md:block text-xl font-bold text-texto-primario">{titulo}</h1>

        {/* Título mobile: contextual */}
        <h1 className="md:hidden text-lg font-bold text-texto-primario">
          {mobileVistaContenido ? seccionActivaData?.etiqueta : titulo}
        </h1>
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

        {/* ─── Mobile: drill-down estilo iOS ─── */}
        <div className="md:hidden flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {!mobileVistaContenido ? (
              /* ── Lista de secciones con header informativo y grupos en tarjetas ── */
              <motion.div
                key="lista-secciones"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="h-full overflow-y-auto pr-4 sidebar-scroll"
              >
                <div className="pb-6 space-y-5">

                  {/* Header informativo */}
                  {(iconoHeader || descripcion) && (
                    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
                      {iconoHeader && (
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: 'color-mix(in srgb, var(--texto-marca) 10%, transparent)' }}>
                          {iconoHeader}
                        </div>
                      )}
                      <h2 className="text-base font-bold text-texto-primario mb-1">{titulo}</h2>
                      {descripcion && (
                        <p className="text-xs text-texto-terciario leading-relaxed">{descripcion}</p>
                      )}
                    </div>
                  )}

                  {/* Grupos de secciones en tarjetas */}
                  {grupos.map((grupo, gi) => (
                    <div key={grupo.grupo || `sin-grupo-${gi}`}>
                      {grupo.grupo && (
                        <p className="px-1 pb-1.5 text-xxs font-bold uppercase tracking-wider text-texto-terciario">
                          {grupo.grupo}
                        </p>
                      )}
                      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
                        {grupo.items.map((seccion, si) => {
                          const activa = seccion.id === seccionActiva
                          return (
                            <div key={seccion.id}>
                            {/* Divisor indentado estilo iOS entre items */}
                            {si > 0 && (
                              <div className="ml-11 border-t border-borde-sutil" />
                            )}
                            <button
                              type="button"
                              onClick={() => !seccion.deshabilitada && seleccionarSeccionMobile(seccion.id)}
                              disabled={seccion.deshabilitada}
                              className={[
                                'w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left cursor-pointer border-none transition-colors',
                                activa
                                  ? 'text-texto-marca'
                                  : 'text-texto-primario active:bg-superficie-hover',
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
                              <ChevronRight size={14} className="text-texto-terciario shrink-0" />
                            </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* ── Contenido de la sección ── */
              <motion.div
                key="contenido-seccion"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="h-full overflow-y-auto pr-4 scrollbar-auto-oculto"
              >
                <div className="pb-6">
                  <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
                    {children}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Desktop: contenido de la sección activa con animación ─── */}
        <div className="hidden md:block flex-1 min-w-0 overflow-y-auto overscroll-contain scroll-smooth scrollbar-auto-oculto">
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

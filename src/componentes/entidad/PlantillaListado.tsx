'use client'

import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal, Settings, X } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

/* ─── Tipos ─── */

/** Acción principal del cabecero (ej: "Nuevo contacto") */
interface AccionCabecero {
  etiqueta: string
  icono?: ReactNode
  onClick: () => void
}

/** Acción del menú desplegable (ej: "Importar", "Exportar") */
interface AccionMenu {
  id: string
  etiqueta: string
  icono?: ReactNode
  onClick: () => void
  peligro?: boolean
}

interface PropiedadesPlantillaListado {
  /** Título de la sección (ej: "Contactos", "Productos") */
  titulo: string

  /** Icono del módulo (opcional, se muestra al lado del título) */
  icono?: ReactNode

  /** Botón de acción principal (ej: "Nuevo contacto") */
  accionPrincipal?: AccionCabecero

  /** Acciones del menú desplegable */
  acciones?: AccionMenu[]

  /** Mostrar botón de configuración (engranaje) */
  mostrarConfiguracion?: boolean

  /** Callback del botón de configuración */
  onConfiguracion?: () => void

  /** Contenido principal — normalmente una TablaDinamica */
  children: ReactNode

  className?: string
}

/**
 * PlantillaListado — Plantilla para páginas de listado con TablaDinamica.
 * Se usa en: Contactos, Actividades, Productos, Documentos, Órdenes, Visitas, Asistencias, Auditoría.
 *
 * Estructura:
 * - Cabecero: Título + acción principal + menú acciones + engranaje config
 * - Contenido: TablaDinamica (con su propia barra de búsqueda/paginador/vistas)
 */
function PlantillaListado({
  titulo,
  icono,
  accionPrincipal,
  acciones = [],
  mostrarConfiguracion = false,
  onConfiguracion,
  children,
  className = '',
}: PropiedadesPlantillaListado) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { t } = useTraduccion()

  return (
    <div className={`flex flex-col h-full ${className}`}>

      {/* ═══ CABECERO ═══ */}
      <div className="flex flex-col gap-2 shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3">

        {/* Fila 1: título + config */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-texto-primario flex items-center gap-2">
            {icono && <span className="text-texto-terciario">{icono}</span>}
            {titulo}
          </h1>

          {mostrarConfiguracion && onConfiguracion && (
            <button
              type="button"
              onClick={onConfiguracion}
              className="size-9 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer transition-colors text-texto-terciario hover:text-texto-secundario border-none bg-transparent"
              title="Configuración"
            >
              <Settings size={16} />
            </button>
          )}
        </div>

        {/* Fila 2: acción principal + acciones */}
        {(accionPrincipal || acciones.length > 0) && (
          <div className="flex items-center gap-2">
            {accionPrincipal && (
              <button
                type="button"
                onClick={accionPrincipal.onClick}
                className="flex items-center justify-center gap-2 px-4 h-10 sm:h-9 rounded-lg text-sm font-semibold text-texto-inverso cursor-pointer border-none transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--texto-marca)' }}
              >
                {accionPrincipal.icono}
                {accionPrincipal.etiqueta}
              </button>
            )}

            {acciones.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuAbierto(!menuAbierto)}
                  className="flex items-center gap-1.5 px-3 h-10 sm:h-9 rounded-lg border border-borde-sutil bg-transparent text-sm font-medium text-texto-secundario hover:bg-superficie-hover cursor-pointer transition-colors"
                >
                  {t('comun.acciones')}
                  <MoreHorizontal size={14} className="text-texto-terciario" />
                </button>

                <AnimatePresence>
                  {menuAbierto && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuAbierto(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full left-0 mt-1 min-w-[180px] bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 overflow-hidden"
                      >
                        {acciones.map((accion) => (
                          <button
                            key={accion.id}
                            type="button"
                            onClick={() => { accion.onClick(); setMenuAbierto(false) }}
                            className={[
                              'flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left border-none cursor-pointer transition-colors',
                              accion.peligro
                                ? 'text-insignia-peligro-texto bg-transparent hover:bg-insignia-peligro-fondo'
                                : 'text-texto-primario bg-transparent hover:bg-superficie-hover',
                            ].join(' ')}
                          >
                            {accion.icono}
                            {accion.etiqueta}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ CONTENIDO — TablaDinamica ocupa todo el alto restante ═══ */}
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  )
}

export { PlantillaListado, type PropiedadesPlantillaListado, type AccionCabecero, type AccionMenu }

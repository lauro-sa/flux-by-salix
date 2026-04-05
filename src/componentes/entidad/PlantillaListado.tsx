'use client'

import { useState, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal, Settings, X } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { useTraduccion } from '@/lib/i18n'
import { ProveedorSlotPaginador } from '@/componentes/tablas/ContextoPaginacion'

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
 * - Cabecero: engranaje config + acción principal + menú acciones (título en migajas del navbar)
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
  const slotPaginadorRef = useRef<HTMLDivElement | null>(null)

  return (
    <div className={`flex flex-col h-full ${className}`}>

      {/* ═══ CABECERO — Título está en las migajas del navbar ═══ */}
      <div className="shrink-0 px-2 sm:px-6 pt-5 sm:pt-5 pb-5 sm:pb-5">
        <div className="flex items-center gap-2">
          {accionPrincipal && (
            <>
              <div className="sm:hidden">
                <Boton variante="primario" tamano="md" icono={accionPrincipal.icono} onClick={accionPrincipal.onClick}>
                  Nuevo
                </Boton>
              </div>
              <div className="hidden sm:block">
                <Boton variante="primario" tamano="md" icono={accionPrincipal.icono} onClick={accionPrincipal.onClick}>
                  {accionPrincipal.etiqueta}
                </Boton>
              </div>
            </>
          )}

          {acciones.length > 0 && (
            <div className="relative">
              <div className="sm:hidden">
                <Boton variante="secundario" tamano="md" soloIcono icono={<MoreHorizontal size={16} />} onClick={() => setMenuAbierto(!menuAbierto)} titulo={t('comun.acciones')} />
              </div>
              <div className="hidden sm:block">
                <Boton variante="secundario" tamano="md" iconoDerecho={<MoreHorizontal size={14} />} onClick={() => setMenuAbierto(!menuAbierto)}>
                  {t('comun.acciones')}
                </Boton>
              </div>

                <AnimatePresence>
                  {menuAbierto && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuAbierto(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full left-0 mt-1 min-w-[180px] max-w-[calc(100vw-2rem)] bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 overflow-hidden"
                      >
                        {acciones.map((accion) => (
                          <OpcionMenu
                            key={accion.id}
                            icono={accion.icono}
                            peligro={accion.peligro}
                            onClick={() => { accion.onClick(); setMenuAbierto(false) }}
                          >
                            {accion.etiqueta}
                          </OpcionMenu>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

          <div className="flex-1" />

          {/* Slot para paginador mobile (TablaDinamica renderiza aquí via portal) */}
          <div ref={slotPaginadorRef} className="sm:hidden flex items-center" />

          {mostrarConfiguracion && onConfiguracion && (
            <Boton variante="fantasma" tamano="sm" soloIcono icono={<Settings size={16} />} onClick={onConfiguracion} titulo="Configuración" className="mr-2.5 sm:mr-0" />
          )}
        </div>
      </div>

      {/* ═══ CONTENIDO — TablaDinamica ocupa todo el alto restante ═══ */}
      <div className="flex-1 min-h-0">
        <ProveedorSlotPaginador slotRef={slotPaginadorRef}>
          {children}
        </ProveedorSlotPaginador>
      </div>
    </div>
  )
}

export { PlantillaListado, type PropiedadesPlantillaListado, type AccionCabecero, type AccionMenu }

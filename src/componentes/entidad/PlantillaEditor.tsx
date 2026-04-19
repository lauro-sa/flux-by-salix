'use client'

import { type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'

/* ─── Tipos ─── */

/** Acción del cabecero del editor (ej: "Vista previa", "Guardar") */
interface AccionEditor {
  id: string
  etiqueta: string
  icono?: ReactNode
  onClick: () => void
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma'
  cargando?: boolean
  deshabilitado?: boolean
  /** Si true, se empuja al margen izquierdo (ej: "Restaurar original") */
  alineadoIzquierda?: boolean
}

interface PropiedadesPlantillaEditor {
  /** Título del editor (ej: "Editar plantilla", "Nueva plantilla") */
  titulo: string

  /** Subtítulo opcional (ej: nombre de la plantilla que se edita) */
  subtitulo?: string

  /** Insignias/badges junto al título (ej: "Sistema", "Modificada") */
  insignias?: ReactNode

  /** Texto del botón de volver (ej: "Plantillas de correo") */
  volverTexto?: string

  /** Callback al presionar volver */
  onVolver?: () => void

  /** Acciones del cabecero (ej: Vista previa, Guardar) */
  acciones?: AccionEditor[]

  /**
   * Banner opcional entre el cabecero sticky y el split panel/main.
   * Ideal para: CabezaloHero editorial, paginador de período, alertas de estado.
   */
  banner?: ReactNode

  /**
   * Panel lateral de configuración (columna izquierda en desktop).
   * Ideal para: nombre, asunto, config avanzada, variables.
   */
  panelConfig?: ReactNode

  /**
   * Contenido principal del editor (columna derecha en desktop).
   * Ideal para: editor de contenido, canvas, WYSIWYG.
   */
  children: ReactNode

  className?: string
}

/**
 * PlantillaEditor — Plantilla para páginas de edición a pantalla completa.
 * Se usa en: editor de plantillas de correo, workflows, roles, campos personalizados, etc.
 *
 * Estructura:
 * - Cabecero sticky: Volver + Título/subtítulo + insignias + acciones (guardar, vista previa)
 * - Layout opcional 2 columnas: panel de configuración (izq) + editor principal (der)
 * - Mobile: todo apilado en 1 columna
 */
function PlantillaEditor({
  titulo,
  subtitulo,
  insignias,
  volverTexto = 'Volver',
  onVolver,
  acciones = [],
  banner,
  panelConfig,
  children,
  className = '',
}: PropiedadesPlantillaEditor) {
  const accionesIzq = acciones.filter(a => a.alineadoIzquierda)
  const accionesDer = acciones.filter(a => !a.alineadoIzquierda)

  return (
    <div className={`flex flex-col h-full ${className}`}>

      {/* ═══ CABECERO STICKY ═══ */}
      <div className="shrink-0 flex items-center gap-3 px-2 sm:px-6 pt-4 pb-4 border-b border-borde-sutil">

        {/* Volver + título */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {onVolver && (
            <Boton
              variante="fantasma"
              tamano="sm"
              icono={<ChevronLeft size={16} />}
              onClick={onVolver}
              className="shrink-0"
            >
              <span className="hidden sm:inline">{volverTexto}</span>
            </Boton>
          )}

          {onVolver && <div className="w-px h-6 bg-borde-sutil shrink-0 hidden sm:block" />}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-semibold text-texto-primario truncate">
                {titulo}
              </h1>
              {insignias}
            </div>
            {subtitulo && (
              <p className="text-xs text-texto-terciario truncate mt-0.5">{subtitulo}</p>
            )}
          </div>
        </div>

        {/* Acciones alineadas a la izquierda (raras, ej: "Restaurar original") */}
        {accionesIzq.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {accionesIzq.map((a) => (
              <Boton
                key={a.id}
                variante={a.variante || 'secundario'}
                tamano="sm"
                icono={a.icono}
                onClick={a.onClick}
                cargando={a.cargando}
                disabled={a.deshabilitado}
              >
                <span className="hidden sm:inline">{a.etiqueta}</span>
              </Boton>
            ))}
          </div>
        )}

        {/* Acciones principales (vista previa, guardar) */}
        {accionesDer.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {accionesDer.map((a) => (
              <Boton
                key={a.id}
                variante={a.variante || 'secundario'}
                tamano="sm"
                icono={a.icono}
                onClick={a.onClick}
                cargando={a.cargando}
                disabled={a.deshabilitado}
              >
                <span className={a.icono ? 'hidden sm:inline' : ''}>{a.etiqueta}</span>
              </Boton>
            ))}
          </div>
        )}
      </div>

      {/* ═══ BANNER OPCIONAL (hero editorial, alertas) ═══ */}
      {banner && (
        <div className="shrink-0 border-b border-borde-sutil">
          {banner}
        </div>
      )}

      {/* ═══ CONTENIDO — 2 columnas en desktop, 1 en mobile ═══ */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {panelConfig && (
          <aside className="w-full lg:w-[320px] shrink-0 lg:border-r border-borde-sutil overflow-y-auto">
            <div className="p-4 sm:p-5">{panelConfig}</div>
          </aside>
        )}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

export { PlantillaEditor, type PropiedadesPlantillaEditor, type AccionEditor }

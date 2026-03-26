'use client'

import { type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/* ─── Tipos ─── */

/** Acción del cabecero de detalle (ej: "Editar", "Eliminar") */
interface AccionDetalle {
  id: string
  etiqueta: string
  icono?: ReactNode
  onClick: () => void
  variante?: 'primario' | 'secundario' | 'peligro'
}

interface PropiedadesPlantillaDetalle {
  /** Título del registro (ej: "Juan Pérez", "PRE-2026-00042") */
  titulo: string

  /** Subtítulo opcional (ej: "Cliente · TechCorp") */
  subtitulo?: string

  /** Icono o avatar del registro */
  icono?: ReactNode

  /** Insignias/badges junto al título (ej: estado, tipo) */
  insignias?: ReactNode

  /** Texto del botón de volver (ej: "Contactos") */
  volverTexto?: string

  /** Callback al presionar volver */
  onVolver?: () => void

  /** Acciones del cabecero (ej: Editar, Eliminar) */
  acciones?: AccionDetalle[]

  /** Contenido principal (lado izquierdo en desktop) */
  children: ReactNode

  /** Panel lateral (lado derecho en desktop — timeline, chatter, etc.) */
  panelLateral?: ReactNode

  className?: string
}

/**
 * PlantillaDetalle — Plantilla para páginas de detalle de un registro.
 * Se usa en: ficha de contacto, detalle de presupuesto, factura, orden de trabajo, etc.
 *
 * Estructura:
 * - Cabecero: Volver + Título/subtítulo + insignias + acciones
 * - Contenido: Layout 2 columnas (info principal + panel lateral)
 * - Mobile: columna única, panel lateral debajo
 */
function PlantillaDetalle({
  titulo,
  subtitulo,
  icono,
  insignias,
  volverTexto = 'Volver',
  onVolver,
  acciones = [],
  children,
  panelLateral,
  className = '',
}: PropiedadesPlantillaDetalle) {
  return (
    <div className={`flex flex-col h-full gap-4 ${className}`}>

      {/* ═══ CABECERO ═══ */}
      <div className="flex items-start gap-3 shrink-0">

        {/* Lado izquierdo: volver + info del registro */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
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

          {/* Icono/avatar */}
          {icono && <div className="shrink-0">{icono}</div>}

          {/* Título y subtítulo */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-texto-primario truncate">{titulo}</h1>
              {insignias}
            </div>
            {subtitulo && (
              <p className="text-sm text-texto-terciario truncate mt-0.5">{subtitulo}</p>
            )}
          </div>
        </div>

        {/* Lado derecho: acciones */}
        {acciones.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {acciones.map((accion) => {
              const estilos = {
                primario: 'text-texto-inverso hover:opacity-90',
                secundario: 'border border-borde-sutil bg-superficie-tarjeta text-texto-primario hover:bg-superficie-hover',
                peligro: 'bg-insignia-peligro-fondo text-insignia-peligro-texto hover:bg-insignia-peligro/20',
              }
              const variante = accion.variante || 'secundario'

              return (
                <button
                  key={accion.id}
                  type="button"
                  onClick={accion.onClick}
                  className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors ${estilos[variante]}`}
                  style={variante === 'primario' ? { backgroundColor: 'var(--texto-marca)' } : undefined}
                >
                  {accion.icono}
                  <span className="hidden sm:inline">{accion.etiqueta}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ CONTENIDO — 2 columnas en desktop, 1 en mobile ═══ */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 overflow-auto">
        {/* Columna principal */}
        <div className="flex-1 min-w-0">
          {children}
        </div>

        {/* Panel lateral */}
        {panelLateral && (
          <div className="w-full lg:w-[360px] shrink-0">
            {panelLateral}
          </div>
        )}
      </div>
    </div>
  )
}

export { PlantillaDetalle, type PropiedadesPlantillaDetalle, type AccionDetalle }

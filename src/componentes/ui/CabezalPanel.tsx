'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * CabezalPanel — Header unificado para los 4 paneles flotantes laterales
 * (Salix IA Chat, Notas Rápidas, Recordatorios, Armador de presupuesto).
 *
 * Garantiza coherencia visual:
 *  - Misma altura (~56px con padding consistente)
 *  - Mismo border-b de separación
 *  - Mismo padding interno (px-4 py-3)
 *  - Mismo tamaño y estilo del título (text-sm font-semibold)
 *  - Mismo tamaño y estilo del subtítulo (text-[11px] text-texto-terciario)
 *  - Mismo tamaño del avatar del ícono (size-9 por default)
 *  - Mismo botón X de cierre (size-9 rounded-card)
 *
 * Permite customización SOLO de:
 *  - el ícono y su fondo (avatar)
 *  - el subtítulo (puede incluir StatusDot, contador dinámico, etc.)
 *  - acciones extra a la izquierda del cierre (history, plus, share, etc.)
 *  - contenido extra debajo del header (pills, tabs, etc.)
 *
 * Esto evita que cada panel diseñe su propio header con paddings y tamaños
 * inconsistentes — que era el problema antes de unificar.
 */

interface PropsCabezalPanel {
  /** Avatar/ícono cuadrado a la izquierda. Recibe el ReactNode entero (con
   *  su gradiente o color de fondo) — el componente solo aplica tamaño y
   *  border-radius. */
  icono: ReactNode
  /** Tamaño del avatar. Default 'md' (size-9). */
  tamanoIcono?: 'sm' | 'md' | 'lg'
  titulo: string
  /** Subtítulo: string simple o nodo (ej. <PuntoEstado/> + texto). */
  subtitulo?: ReactNode
  /** Botones extra entre el título y el cierre (ej. History, Plus de PanelChat). */
  acciones?: ReactNode
  /** Callback para el botón X de cierre. */
  onCerrar: () => void
  /** Contenido extra debajo del cabezal principal (pills de Recordatorios,
   *  tabs, etc.). Hereda el border-b automáticamente. */
  extras?: ReactNode
}

const TAMANO_ICONO: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-11',
}

export function CabezalPanel({
  icono,
  tamanoIcono = 'md',
  titulo,
  subtitulo,
  acciones,
  onCerrar,
  extras,
}: PropsCabezalPanel) {
  return (
    <div className="shrink-0 border-b border-white/[0.07]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar cuadrado — el componente solo controla tamaño y forma.
              El gradiente/color se define en el ReactNode que pasa el panel. */}
          <div className={`${TAMANO_ICONO[tamanoIcono]} rounded-card flex items-center justify-center shrink-0 overflow-hidden`}>
            {icono}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-texto-primario leading-tight truncate">{titulo}</h3>
            {subtitulo && (
              <div className="text-[11px] text-texto-terciario mt-0.5 flex items-center gap-1.5 truncate">
                {subtitulo}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {acciones}
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
            title="Cerrar"
            aria-label="Cerrar panel"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {extras}
    </div>
  )
}

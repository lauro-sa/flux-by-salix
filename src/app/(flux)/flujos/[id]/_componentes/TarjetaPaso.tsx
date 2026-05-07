'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { iconoDefaultAccion } from '@/lib/workflows/iconos-flujo'
import { claveI18nTituloPaso } from '@/lib/workflows/categorias-pasos'
import type { AccionWorkflow, TipoAccion } from '@/tipos/workflow'

/**
 * Tarjeta visual de un paso del canvas (sub-PR 19.2).
 *
 * Anatomía (§1.6.2 del plan):
 *   • Ícono representativo del tipo (lado izquierdo en círculo).
 *   • Nombre del paso (clave i18n por tipo, ej: "Enviar WhatsApp").
 *   • 1 línea de resumen truncada agresivamente (§5.1 — no detalles).
 *   • Drag handle a la derecha (siempre visible, patrón Linear; mobile 44x44).
 *
 * Click en la tarjeta (excepto en el drag-handle) → callback
 * `onSeleccionar`. El `EditorFlujo` abre el panel placeholder (19.3
 * lo reemplaza por el panel real).
 *
 * Estado seleccionado: borde texto-marca + sombra suave.
 *
 * dnd-kit: la tarjeta se registra como sortable mediante `paso.id`
 * — el ID estable lo agrega `EditorFlujo` al insertar la acción.
 */

interface Props {
  paso: AccionWorkflow & { id: string }
  seleccionada: boolean
  soloLectura: boolean
  onSeleccionar: () => void
  /**
   * Sub-PR 19.4: si true, pinta marker visual de error (borde lateral
   * rojo + punto en esquina sup-derecha). El padre decide cuándo
   * activarlo (solo después de un intento fallido de Publicar/Activar).
   */
  tieneError?: boolean
  /** Mensaje del primer error del paso, usado como tooltip nativo. */
  mensajeError?: string
}

export default function TarjetaPaso({
  paso,
  seleccionada,
  soloLectura,
  onSeleccionar,
  tieneError = false,
  mensajeError,
}: Props) {
  const { t } = useTraduccion()
  const Icono = iconoDefaultAccion(paso.tipo as TipoAccion)
  const titulo = (() => {
    const clave = claveI18nTituloPaso(paso.tipo as TipoAccion)
    const traducido = t(clave)
    return traducido === clave ? paso.tipo : traducido
  })()

  // dnd-kit sortable. El ID viene del paso.
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: paso.id,
    disabled: soloLectura,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const resumen = resumirPaso(paso)

  return (
    <div
      ref={setNodeRef}
      style={style}
      // `id` HTML (no choca con el ref de dnd-kit, que usa el HTMLElement)
      // — lo necesita el scroll-to-paso de "Ver errores" del banner rojo.
      id={`flujo-paso-${paso.id}`}
      title={tieneError ? mensajeError : undefined}
      className={`relative group flex items-stretch gap-2 rounded-card border bg-superficie-tarjeta transition-colors ${
        seleccionada
          ? 'border-texto-marca shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]'
          : 'border-borde-sutil hover:border-borde-fuerte'
      } ${tieneError ? 'border-l-2 border-l-insignia-peligro-texto' : ''}`}
    >
      {/* Marker rojo en esquina sup-derecha (D9 del scope). Visible solo
          tras intento fallido de Publicar/Activar. Se posiciona absoluto
          para no afectar el layout interno de la tarjeta. */}
      {tieneError && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 size-2 rounded-full bg-insignia-peligro-texto ring-2 ring-superficie-app"
        />
      )}
      {/* Cuerpo clickeable */}
      <button
        type="button"
        onClick={onSeleccionar}
        className="flex-1 flex items-center gap-3 px-3 py-3 text-left min-w-0 cursor-pointer rounded-l-card"
      >
        <span
          className="shrink-0 inline-flex items-center justify-center size-9 rounded-md bg-texto-marca/10 text-texto-marca"
          aria-hidden="true"
        >
          <Icono size={16} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-texto-primario truncate">{titulo}</p>
          {resumen && (
            <p className="text-xs text-texto-terciario truncate mt-0.5">{resumen}</p>
          )}
        </div>
      </button>

      {/* Drag handle siempre visible. Mobile: área tocable 44x44 (memoria
          patrón Linear). En modo solo lectura no se renderiza. */}
      {!soloLectura && (
        <div
          {...attributes}
          {...listeners}
          aria-label={t('flujos.editor.drag_handle')}
          className="shrink-0 flex items-center justify-center w-9 sm:w-7 cursor-grab active:cursor-grabbing text-texto-terciario hover:text-texto-secundario rounded-r-card touch-target select-none"
        >
          <GripVertical size={14} aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

/**
 * Resumen mínimo de 1 línea por tipo de paso. Se trunca agresivamente
 * (§5.1 del plan UX): solo lo esencial, los detalles van al panel.
 *
 * Cuando 19.3 aterrice el panel lateral con campos editados, este
 * resumen va a tomar valores reales. En 19.2 muchos pasos están
 * "incompletos" (campos vacíos) y el resumen cae al fallback genérico.
 */
function resumirPaso(paso: AccionWorkflow): string | null {
  switch (paso.tipo) {
    case 'enviar_whatsapp_plantilla':
      return paso.plantilla_nombre || null
    case 'crear_actividad':
      return paso.titulo || null
    case 'cambiar_estado_entidad':
      return paso.hasta_clave || null
    case 'notificar_usuario':
      return paso.titulo || null
    case 'esperar':
      if (typeof paso.duracion_ms === 'number') {
        return formatearDuracion(paso.duracion_ms)
      }
      return paso.hasta_fecha ?? null
    case 'condicion_branch':
      return null
    case 'terminar_flujo':
      return null
    default:
      return null
  }
}

function formatearDuracion(ms: number): string {
  const seg = Math.round(ms / 1000)
  if (seg < 60) return `${seg}s`
  const min = Math.round(seg / 60)
  if (min < 60) return `${min} min`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} h`
  const d = Math.round(hr / 24)
  return `${d} d`
}

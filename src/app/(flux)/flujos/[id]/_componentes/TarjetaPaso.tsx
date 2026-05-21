'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { iconoDefaultAccion } from '@/lib/workflows/iconos-flujo'
import { nombreMostrablePaso } from '@/lib/workflows/etiquetas-accion'
import { useAutocompleteRemoto } from './_panel/selectores/useAutocompleteRemoto'
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

interface ItemNombrado {
  id: string
  nombre: string
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
  // Si el paso tiene `etiqueta` propia (nombre custom del usuario), esa
  // gana sobre el título genérico del tipo. Si no, fallback a la
  // traducción i18n del tipo (ej: "Enviar respuesta rápida").
  const titulo = nombreMostrablePaso(t, paso as { etiqueta?: string | null; tipo?: string | null })

  // Resolución de IDs a nombres para el resumen (plantillas y respuestas
  // rápidas). Reusamos la cache module-level del `useAutocompleteRemoto`
  // — si el panel ya cargó la lista, acá vamos directo al cache sin
  // fetch adicional. Si el paso no requiere fetch, pasamos url=null.
  const urlPlantillasCorreo =
    paso.tipo === 'enviar_correo_plantilla' ? '/api/correo/plantillas' : null
  const { opciones: plantillasCorreo } = useAutocompleteRemoto<ItemNombrado>({
    url: urlPlantillasCorreo,
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { plantillas?: unknown }).plantillas)
        ? ((raw as { plantillas: ItemNombrado[] }).plantillas)
        : [],
  })
  const urlRespuestasRapidas =
    paso.tipo === 'enviar_respuesta_rapida_correo' ? '/api/correo/respuestas-rapidas' : null
  const { opciones: respuestasRapidas } = useAutocompleteRemoto<ItemNombrado>({
    url: urlRespuestasRapidas,
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { plantillas?: unknown }).plantillas)
        ? ((raw as { plantillas: ItemNombrado[] }).plantillas)
        : [],
  })

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

  const resumen = resumirPaso(paso, { plantillasCorreo, respuestasRapidas })

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
            <p className="text-xs text-texto-secundario truncate mt-0.5 font-medium">{resumen}</p>
          )}
        </div>
      </button>

      {/* Drag handle siempre visible. Mobile: área tocable 44x44 (memoria
          patrón Linear). En modo solo lectura no se renderiza.
          `suppressHydrationWarning`: dnd-kit asigna IDs incrementales
          (`aria-describedby="DndDescribedBy-N"`) que pueden diferir
          entre SSR y client cuando hay múltiples instancias montadas
          en distinto orden. Es esperado y la library lo cura sola
          después de la hidratación — silenciamos el warning ahí. */}
      {!soloLectura && (
        <div
          {...attributes}
          {...listeners}
          suppressHydrationWarning
          aria-label={t('flujos.editor.drag_handle')}
          className="shrink-0 flex items-center justify-center w-9 sm:w-7 cursor-grab active:cursor-grabbing text-texto-terciario hover:text-texto-secundario rounded-r-card touch-target select-none"
        >
          <GripVertical size={14} aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

interface OpcionesResumenPaso {
  plantillasCorreo: ItemNombrado[]
  respuestasRapidas: ItemNombrado[]
}

/**
 * Resumen mínimo de 1 línea por tipo de paso. Se trunca agresivamente
 * (§5.1 del plan UX): solo lo esencial, los detalles van al panel.
 *
 * Para tipos que tienen `*_id` (plantillas, respuestas rápidas), el
 * caller pasa las listas cargadas para que el resumen muestre el
 * nombre legible en lugar del UUID.
 */
function resumirPaso(
  paso: AccionWorkflow,
  opciones: OpcionesResumenPaso,
): string | null {
  switch (paso.tipo) {
    case 'enviar_whatsapp_plantilla':
      return paso.plantilla_nombre || null
    case 'enviar_correo_plantilla': {
      const id = (paso as { plantilla_id?: string }).plantilla_id
      if (!id) return null
      const nombre = opciones.plantillasCorreo.find((p) => p.id === id)?.nombre
      return nombre || null
    }
    case 'enviar_respuesta_rapida_correo': {
      const id = (paso as { respuesta_rapida_id?: string }).respuesta_rapida_id
      if (!id) return null
      const nombre = opciones.respuestasRapidas.find((p) => p.id === id)?.nombre
      return nombre || null
    }
    case 'enviar_correo_texto': {
      const params = (paso as { parametros?: Record<string, unknown> }).parametros
      const asunto = typeof params?.asunto === 'string' ? params.asunto.trim() : ''
      return asunto.length > 0 ? asunto : null
    }
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
    case 'terminar_flujo':
      return null
    case 'condicion_branch':
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

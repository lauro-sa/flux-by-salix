'use client'

import { X } from 'lucide-react'
import {
  serializarExpresionVariable,
  type ExpresionVariable,
} from './parsear-expresion'

/**
 * Pill atómico que renderiza una variable insertada dentro del
 * `InputConVariables` (sub-PR 19.3b).
 *
 * Comportamiento:
 *   • `contentEditable={false}` → el browser lo trata como nodo
 *     atómico. Backspace en el borde lo elimina entero.
 *   • `data-raw` contiene la expresión serializada en forma canónica
 *     (`{{ ruta | helper(arg) }}`) para que `InputConVariables` pueda
 *     reconstruir el `value` leyendo el DOM.
 *   • Click → reabre el picker en modo edición.
 *   • Hover → muestra X para eliminar (UX validada en
 *     `InputAsuntoVariables`).
 *
 * Visual:
 *   • Fondo `bg-texto-marca/15` con texto `text-texto-marca` cuando
 *     hay valorPreview real.
 *   • Si no hay preview, fondo `bg-superficie-hover` con texto
 *     terciario (la variable existe pero todavía no resuelve a
 *     nada — quizás porque la tabla está vacía, según caveat del
 *     coordinador).
 */

interface Props {
  expresion: ExpresionVariable
  /** Valor resuelto (preview) o null si no se pudo resolver. */
  valorPreview: string | null
  /** Etiqueta legible de la variable (ej: "Total"). Usada como fallback
   * cuando no hay preview. */
  etiquetaLegible?: string
  soloLectura: boolean
  onClick: () => void
  onEliminar: () => void
}

export default function ChipVariable({
  expresion,
  valorPreview,
  etiquetaLegible,
  soloLectura,
  onClick,
  onEliminar,
}: Props) {
  const raw = serializarExpresionVariable(expresion)
  const tienePreview = valorPreview !== null && valorPreview.length > 0
  const textoMostrado = tienePreview
    ? valorPreview
    : (etiquetaLegible ?? expresion.ruta.split('.').slice(-1)[0])

  return (
    <span
      data-raw={raw}
      data-variable
      contentEditable={false}
      title={raw + (tienePreview ? ` → ${valorPreview}` : '')}
      onClick={(e) => {
        if (soloLectura) return
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={[
        'inline-flex items-center gap-0.5 mx-0.5 rounded px-1.5 py-0.5 text-sm align-baseline group/chip select-none',
        soloLectura ? 'cursor-default' : 'cursor-pointer',
        tienePreview
          ? 'bg-texto-marca/15 text-texto-marca'
          : 'bg-superficie-hover text-texto-secundario',
      ].join(' ')}
    >
      <span className="truncate max-w-[200px]">{textoMostrado}</span>
      {!soloLectura && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onEliminar()
          }}
          contentEditable={false}
          className="hidden group-hover/chip:inline-flex items-center justify-center size-3.5 rounded-full bg-insignia-peligro text-white"
          aria-label="Eliminar variable"
        >
          <X size={9} />
        </button>
      )}
    </span>
  )
}

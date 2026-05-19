'use client'

import { Mic, X } from 'lucide-react'
import { TextArea } from '@/componentes/ui/TextArea'

/**
 * InputSalix — Caja de texto donde el usuario describe el trabajo.
 *
 * Particularidades vs un TextArea común:
 *  - Contador de caracteres abajo a la izquierda (xxx / max).
 *  - Acciones a la derecha del contador: micrófono (placeholder a futuro)
 *    y limpiar.
 *  - Cuando `pensando=true`, el contenedor adopta un border violeta que
 *    "respira" (animación flux-input-respiro). El textarea queda visible
 *    pero no editable.
 */

interface PropsInputSalix {
  valor: string
  onChange: (valor: string) => void
  pensando?: boolean
  /** Cantidad máxima de caracteres a mostrar en el contador. Default 2000. */
  max?: number
  /** Placeholder cuando el campo está vacío. */
  placeholder?: string
  /** Disparado cuando el usuario presiona Cmd/Ctrl + Enter. */
  onAtajoAnalizar?: () => void
}

const PLACEHOLDER_DEFECTO =
  'Describí el trabajo a presupuestar…\n\nEj: Fui a un edificio en Palermo, portón curvo corredizo grande. Hay que cambiar los rolletes inferiores, reparar el carro superior, ajustar y nivelar. Traslado con andamios.'

export function InputSalix({
  valor,
  onChange,
  pensando = false,
  max = 2000,
  placeholder = PLACEHOLDER_DEFECTO,
  onAtajoAnalizar,
}: PropsInputSalix) {
  return (
    <div
      className="relative rounded-card border transition-all"
      style={{
        borderColor: pensando ? 'var(--insignia-primario)' : 'var(--borde-sutil)',
        animation: pensando ? 'flux-input-respiro 1.5s ease-in-out infinite' : undefined,
      }}
    >
      <TextArea
        value={valor}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        maxLength={max}
        disabled={pensando}
        autoFocus
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onAtajoAnalizar) {
            e.preventDefault()
            onAtajoAnalizar()
          }
        }}
        className="!border-0 !bg-transparent !rounded-card resize-none"
      />

      {/* Fila inferior: contador + acciones */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-borde-sutil/60">
        <span className="text-xxs text-texto-terciario tabular-nums">
          {valor.length} / {max}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Dictar (próximamente)"
            disabled
            className="size-6 inline-flex items-center justify-center rounded-boton text-texto-terciario opacity-40 cursor-not-allowed"
          >
            <Mic size={13} />
          </button>
          {valor.length > 0 && !pensando && (
            <button
              type="button"
              title="Limpiar"
              onClick={() => onChange('')}
              className="size-6 inline-flex items-center justify-center rounded-boton text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

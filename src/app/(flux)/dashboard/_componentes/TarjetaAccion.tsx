'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

/**
 * TarjetaAccion — Base visual común para widgets del bloque "Accionar ahora".
 * Header con icono de color + título + contador prominente + CTA "Ver todo".
 * Body: children (lista de items o empty state).
 *
 * Pensada mobile-first: padding generoso, tap target mínimo 44px en el CTA del header.
 */
interface Props {
  titulo: string
  icono: ReactNode
  colorFondo: string
  colorIcono: string
  contador?: number
  subtitulo?: string
  verTodoHref?: string
  verTodoOnClick?: () => void
  children: ReactNode
}

export function TarjetaAccion({
  titulo, icono, colorFondo, colorIcono,
  contador, subtitulo, verTodoHref, verTodoOnClick, children,
}: Props) {
  const router = useRouter()
  const onVerTodo = () => {
    if (verTodoOnClick) return verTodoOnClick()
    if (verTodoHref) router.push(verTodoHref)
  }

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 sm:p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`size-9 rounded-card flex items-center justify-center ${colorFondo} ${colorIcono} shrink-0`}>
            {icono}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-texto-primario truncate leading-tight">{titulo}</h3>
            {subtitulo && <p className="text-xxs text-texto-terciario truncate mt-0.5">{subtitulo}</p>}
          </div>
        </div>

        {contador != null && (
          <span className="text-2xl font-bold text-texto-primario tabular-nums leading-none shrink-0">
            {contador}
          </span>
        )}
      </div>

      <div className="space-y-0.5 flex-1">{children}</div>

      {(verTodoHref || verTodoOnClick) && (
        <button
          onClick={onVerTodo}
          className="mt-3 pt-2.5 border-t border-borde-sutil/60 inline-flex items-center justify-center gap-1 text-xxs font-medium text-texto-terciario hover:text-texto-marca transition-colors cursor-pointer w-full"
          aria-label={`Ver todo ${titulo}`}
        >
          Ver todo <ArrowRight size={10} />
        </button>
      )}
    </div>
  )
}

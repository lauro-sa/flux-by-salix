'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Sección colapsable del panel lateral del editor de flujos
 * (sub-PR 19.3a).
 *
 * Cada sección tiene un label uppercase tracking-wider, un cuerpo con el
 * contenido editable, y un chevron que expande/colapsa. La sección
 * "Avanzado" arranca colapsada (regla del plan §1.7.5); las demás
 * arrancan abiertas para que el usuario vea los campos sin tener que
 * descubrirlos.
 *
 * El estado de expandido vive local: si la sección se colapsa, no
 * persistimos esa preferencia entre aperturas distintas del panel
 * (consistente con cómo Notion y Linear manejan secciones de propiedades).
 */

interface Props {
  /** Texto del label superior. Se renderiza uppercase. */
  titulo: string
  /** Si arranca abierta. Default: true. La sección Avanzado pasa false. */
  defaultAbierto?: boolean
  /** Contenido editable (campos, toggles, pills). */
  children: ReactNode
}

export default function SeccionPanel({ titulo, defaultAbierto = true, children }: Props) {
  const [abierto, setAbierto] = useState(defaultAbierto)

  return (
    <section className="px-4 py-3 border-b border-borde-sutil last:border-b-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex items-center gap-1.5 w-full text-left cursor-pointer group"
      >
        <ChevronDown
          size={12}
          strokeWidth={2}
          className={[
            'shrink-0 text-texto-terciario transition-transform duration-150',
            abierto ? '' : '-rotate-90',
          ].join(' ')}
        />
        <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider group-hover:text-texto-secundario transition-colors">
          {titulo}
        </span>
      </button>

      {abierto && <div className="mt-3 flex flex-col gap-3">{children}</div>}
    </section>
  )
}

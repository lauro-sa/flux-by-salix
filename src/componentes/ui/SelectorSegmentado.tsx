'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * SelectorSegmentado — Tabs estilo segmented control (iOS) con un pill
 * animado que se desliza entre opciones cuando cambia la selección.
 *
 * Se usa en cualquier lugar donde haya un set chico (2-5) de opciones
 * mutuamente excluyentes y queramos un selector más expresivo que
 * GrupoBotones plano. Ideal para modos de un asistente, filtros de
 * vista (lista / cuadrícula / kanban), o tabs de configuración.
 *
 * Las opciones pueden tener un acento de color (`primario` | `exito`
 * | `advertencia` | `peligro`) que tiñe el fondo del pill cuando esa
 * opción está activa. Si no se pasa acento, usa el color primario.
 *
 * La animación del pill usa Framer Motion con layoutId para que el
 * pill viaje desde la opción anterior a la nueva con una curva premium.
 */

type AcentoOpcion = 'primario' | 'exito' | 'advertencia' | 'peligro'

interface OpcionSegmento<T extends string> {
  /** ID único de la opción (lo que devuelve onChange) */
  id: T
  /** Texto que se muestra en el botón */
  etiqueta: ReactNode
  /** Ícono opcional a la izquierda de la etiqueta */
  icono?: ReactNode
  /** Color del pill cuando esta opción está activa (default: primario) */
  acento?: AcentoOpcion
}

interface PropsSelectorSegmentado<T extends string> {
  opciones: OpcionSegmento<T>[]
  valor: T
  onChange: (id: T) => void
  /** ID único de este selector — necesario para que el layoutId del pill
   *  no se mezcle con otros selectores presentes en la misma página. */
  idLayout: string
  className?: string
  tamano?: 'sm' | 'md'
  disabled?: boolean
  /** Si true, el selector ocupa todo el ancho disponible y cada botón
   *  se reparte el espacio en partes iguales. */
  anchoCompleto?: boolean
}

// Cada acento mapea a un fondo translúcido + texto del color saturado.
// Los valores vienen de tokens (--insignia-*), nunca hex sueltos.
const acentos: Record<AcentoOpcion, { fondo: string; texto: string }> = {
  primario:     { fondo: 'bg-insignia-primario-fondo',     texto: 'text-insignia-primario-texto' },
  exito:        { fondo: 'bg-insignia-exito-fondo',        texto: 'text-insignia-exito-texto' },
  advertencia:  { fondo: 'bg-insignia-advertencia-fondo',  texto: 'text-insignia-advertencia-texto' },
  peligro:      { fondo: 'bg-insignia-peligro-fondo',      texto: 'text-insignia-peligro-texto' },
}

const tamanos: Record<'sm' | 'md', { boton: string; texto: string }> = {
  sm: { boton: 'px-3 py-1.5', texto: 'text-xs' },
  md: { boton: 'px-4 py-2',   texto: 'text-sm' },
}

export function SelectorSegmentado<T extends string>({
  opciones,
  valor,
  onChange,
  idLayout,
  className = '',
  tamano = 'sm',
  disabled = false,
  anchoCompleto = false,
}: PropsSelectorSegmentado<T>) {
  const t = tamanos[tamano]

  return (
    <div
      className={`${anchoCompleto ? 'flex w-full' : 'inline-flex'} items-center gap-0.5 p-0.5 rounded-card bg-superficie-app border border-borde-sutil ${className}`}
      role="tablist"
      aria-disabled={disabled}
    >
      {opciones.map(opcion => {
        const activa = opcion.id === valor
        const acento = acentos[opcion.acento ?? 'primario']
        return (
          <button
            key={opcion.id}
            type="button"
            role="tab"
            aria-selected={activa}
            disabled={disabled}
            onClick={() => !disabled && !activa && onChange(opcion.id)}
            className={`
              relative flex items-center justify-center gap-1.5 rounded-boton
              ${t.boton} ${t.texto} font-medium
              transition-colors duration-150
              ${anchoCompleto ? 'flex-1' : ''}
              ${activa ? acento.texto : 'text-texto-terciario hover:text-texto-secundario'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {/* Pill animado de fondo — viaja entre opciones gracias al layoutId */}
            {activa && (
              <motion.span
                layoutId={`segmento-${idLayout}`}
                className={`absolute inset-0 rounded-boton ${acento.fondo}`}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            {/* Contenido siempre por encima del pill */}
            <span className="relative z-10 flex items-center gap-1.5">
              {opcion.icono}
              {opcion.etiqueta}
            </span>
          </button>
        )
      })}
    </div>
  )
}

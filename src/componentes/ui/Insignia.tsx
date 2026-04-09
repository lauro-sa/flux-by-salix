'use client'

import type { ReactNode } from 'react'

type ColorInsignia =
  | 'exito' | 'peligro' | 'advertencia' | 'info' | 'primario'
  | 'neutro' | 'rosa' | 'cyan' | 'violeta' | 'naranja'

interface PropiedadesInsignia {
  color?: ColorInsignia
  children: ReactNode
  removible?: boolean
  onRemover?: () => void
  tamano?: 'sm' | 'md'
}

const clasesColor: Record<ColorInsignia, string> = {
  exito: 'bg-insignia-exito-fondo text-insignia-exito-texto',
  peligro: 'bg-insignia-peligro-fondo text-insignia-peligro-texto',
  advertencia: 'bg-insignia-advertencia-fondo text-insignia-advertencia-texto',
  info: 'bg-insignia-info-fondo text-insignia-info-texto',
  primario: 'bg-insignia-primario-fondo text-insignia-primario-texto',
  neutro: 'bg-insignia-neutro-fondo text-insignia-neutro-texto',
  rosa: 'bg-insignia-rosa-fondo text-insignia-rosa-texto',
  cyan: 'bg-insignia-cyan-fondo text-insignia-cyan-texto',
  violeta: 'bg-insignia-violeta-fondo text-insignia-violeta-texto',
  naranja: 'bg-insignia-naranja-fondo text-insignia-naranja-texto',
}

/**
 * Insignia — Badge/chip con color semántico.
 * Se usa en: etiquetas, estados, tipos, filtros activos, píldoras.
 */
function Insignia({ color = 'neutro', children, removible, onRemover, tamano = 'sm' }: PropiedadesInsignia) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${clasesColor[color]} ${tamano === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}>
      {children}
      {removible && (
        <button onClick={onRemover} className="inline-flex items-center justify-center size-5 rounded-full bg-transparent text-current cursor-pointer opacity-60 hover:opacity-100 border-none p-0.5 text-xxs" aria-label="Remover">
          ×
        </button>
      )}
    </span>
  )
}

export { Insignia, type PropiedadesInsignia, type ColorInsignia }

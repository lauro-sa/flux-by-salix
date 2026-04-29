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
  /**
   * 'filled' (default): fondo sólido del color, para tipos/estados.
   * 'outline': solo borde + texto, sin fondo. Útil para diferenciar
   * etiquetas de marcadores de estado en una misma fila.
   */
  variante?: 'filled' | 'outline'
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

const clasesColorOutline: Record<ColorInsignia, string> = {
  exito: 'border border-insignia-exito-texto/40 text-insignia-exito-texto',
  peligro: 'border border-insignia-peligro-texto/40 text-insignia-peligro-texto',
  advertencia: 'border border-insignia-advertencia-texto/40 text-insignia-advertencia-texto',
  info: 'border border-insignia-info-texto/40 text-insignia-info-texto',
  primario: 'border border-insignia-primario-texto/40 text-insignia-primario-texto',
  neutro: 'border border-borde-fuerte/50 text-texto-secundario',
  rosa: 'border border-insignia-rosa-texto/40 text-insignia-rosa-texto',
  cyan: 'border border-insignia-cyan-texto/40 text-insignia-cyan-texto',
  violeta: 'border border-insignia-violeta-texto/40 text-insignia-violeta-texto',
  naranja: 'border border-insignia-naranja-texto/40 text-insignia-naranja-texto',
}

/**
 * Insignia — Badge/chip con color semántico.
 * Se usa en: etiquetas, estados, tipos, filtros activos, píldoras.
 * Variante 'outline' útil para distinguir etiquetas de marcadores de estado
 * cuando comparten fila.
 */
function Insignia({ color = 'neutro', children, removible, onRemover, tamano = 'sm', variante = 'filled' }: PropiedadesInsignia) {
  const clasesVariante = variante === 'outline' ? clasesColorOutline[color] : clasesColor[color]
  // Outline se ve más voluminosa por el borde + el ancho de la tipografía;
  // compensamos con padding y font-size un punto más chicos para que pese
  // visualmente menos que la variante filled (estados/tipos prevalecen).
  const tamanoClases = variante === 'outline'
    ? (tamano === 'sm' ? 'px-1.5 py-px text-[11px]' : 'px-2.5 py-0.5 text-xs')
    : (tamano === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm')
  return (
    <span className={`inline-flex items-center gap-1 rounded-insignia font-medium whitespace-nowrap ${clasesVariante} ${tamanoClases}`}>
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

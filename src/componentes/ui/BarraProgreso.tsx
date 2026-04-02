'use client'

import { motion } from 'framer-motion'

/**
 * BarraProgreso — Indicador visual de progreso para uploads, operaciones largas, etc.
 * Soporta modo determinado (con porcentaje) e indeterminado (animación loop).
 * Se usa en: uploads de archivos, importaciones, operaciones batch.
 */

type VarianteProgreso = 'primario' | 'exito' | 'advertencia' | 'peligro'
type TamanoProgreso = 'sm' | 'md' | 'lg'

interface PropiedadesBarraProgreso {
  /** Porcentaje de progreso (0-100). Si es null/undefined → modo indeterminado */
  valor?: number | null
  /** Variante de color */
  variante?: VarianteProgreso
  /** Tamaño de la barra */
  tamano?: TamanoProgreso
  /** Texto descriptivo debajo de la barra */
  etiqueta?: string
  /** Mostrar porcentaje numérico */
  mostrarPorcentaje?: boolean
  /** Clase CSS adicional */
  className?: string
}

const coloresVariante: Record<VarianteProgreso, string> = {
  primario: 'var(--texto-marca)',
  exito: 'var(--insignia-exito)',
  advertencia: 'var(--insignia-advertencia)',
  peligro: 'var(--insignia-peligro)',
}

const alturasClase: Record<TamanoProgreso, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}

function BarraProgreso({
  valor,
  variante = 'primario',
  tamano = 'md',
  etiqueta,
  mostrarPorcentaje = false,
  className = '',
}: PropiedadesBarraProgreso) {
  const esIndeterminado = valor === null || valor === undefined
  const porcentaje = esIndeterminado ? 0 : Math.max(0, Math.min(100, valor))
  const color = coloresVariante[variante]

  return (
    <div className={`w-full ${className}`}>
      {(etiqueta || mostrarPorcentaje) && (
        <div className="flex items-center justify-between mb-1.5">
          {etiqueta && (
            <span className="text-xs text-texto-secundario truncate">{etiqueta}</span>
          )}
          {mostrarPorcentaje && !esIndeterminado && (
            <span className="text-xs font-medium text-texto-primario ml-2 tabular-nums">
              {Math.round(porcentaje)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full ${alturasClase[tamano]} rounded-full overflow-hidden`}
        style={{ backgroundColor: 'var(--superficie-hover)' }}
      >
        {esIndeterminado ? (
          <motion.div
            className={`${alturasClase[tamano]} rounded-full w-1/3`}
            style={{ backgroundColor: color }}
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className={`${alturasClase[tamano]} rounded-full`}
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${porcentaje}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
  )
}

export { BarraProgreso }
export type { PropiedadesBarraProgreso }

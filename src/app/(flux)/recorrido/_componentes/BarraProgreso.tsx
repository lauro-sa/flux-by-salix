'use client'

/**
 * BarraProgreso — Barra visual con segmentos por cada parada.
 * Colores: completada=verde, actual=azul, pendiente=gris.
 * Se usa en: PaginaRecorrido debajo del header.
 */

import { useTraduccion } from '@/lib/i18n'

interface PropiedadesBarraProgreso {
  total: number
  completadas: number
  paradaActual: number // índice de la parada actual (0-based)
}

function BarraProgreso({ total, completadas, paradaActual }: PropiedadesBarraProgreso) {
  const { t } = useTraduccion()

  if (total === 0) return null

  return (
    <div className="px-4 py-3 bg-superficie-tarjeta border-b border-borde-sutil">
      {/* Segmentos */}
      <div className="flex gap-1 mb-1.5">
        {Array.from({ length: total }, (_, i) => {
          let colorClase = 'bg-borde-sutil' // pendiente
          if (i < completadas) colorClase = 'bg-[var(--insignia-exito)]' // completada
          else if (i === paradaActual) colorClase = 'bg-[var(--insignia-info)]' // actual

          return (
            <div
              key={i}
              className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${colorClase}`}
            />
          )
        })}
      </div>

      {/* Texto */}
      <p className="text-xs text-texto-terciario">
        {completadas} {t('recorrido.completadas').toLowerCase()} · {total - completadas} {t('recorrido.pendientes').toLowerCase()}
      </p>
    </div>
  )
}

export { BarraProgreso }

'use client'

import { useState, useCallback } from 'react'
import { ArrowRight } from 'lucide-react'
import { SelectorFecha } from './SelectorFecha'

/**
 * SelectorRangoFecha — Selector de rango de fechas (desde-hasta).
 * Compuesto por dos SelectorFecha coordinados con validación cruzada.
 * Se usa en: filtros de fecha en tablas, informes, exportaciones.
 */

interface PropiedadesSelectorRangoFecha {
  /** Fecha inicio en formato ISO (YYYY-MM-DD) */
  desde?: string
  /** Fecha fin en formato ISO (YYYY-MM-DD) */
  hasta?: string
  /** Callback al cambiar el rango. Valor puede ser string o null (cuando se borra) */
  onChange: (rango: { desde: string; hasta: string }) => void
  /** Etiqueta del campo desde */
  etiquetaDesde?: string
  /** Etiqueta del campo hasta */
  etiquetaHasta?: string
  /** Placeholder personalizado */
  placeholderDesde?: string
  placeholderHasta?: string
  /** Deshabilitado */
  deshabilitado?: boolean
  /** Compacto (una sola línea) */
  compacto?: boolean
  /** Clase CSS adicional */
  className?: string
}

function SelectorRangoFecha({
  desde = '',
  hasta = '',
  onChange,
  etiquetaDesde = 'Desde',
  etiquetaHasta = 'Hasta',
  placeholderDesde,
  placeholderHasta,
  deshabilitado = false,
  compacto = false,
  className = '',
}: PropiedadesSelectorRangoFecha) {
  const [errorDesde, setErrorDesde] = useState('')
  const [errorHasta, setErrorHasta] = useState('')

  const manejarDesde = useCallback((valor: string | null) => {
    const v = valor || ''
    setErrorDesde('')
    setErrorHasta('')

    if (v && hasta && v > hasta) {
      setErrorDesde('No puede ser posterior a la fecha fin')
      return
    }

    onChange({ desde: v, hasta })
  }, [hasta, onChange])

  const manejarHasta = useCallback((valor: string | null) => {
    const v = valor || ''
    setErrorDesde('')
    setErrorHasta('')

    if (v && desde && v < desde) {
      setErrorHasta('No puede ser anterior a la fecha inicio')
      return
    }

    onChange({ desde, hasta: v })
  }, [desde, onChange])

  return (
    <div className={`flex ${compacto ? 'items-center gap-2' : 'flex-col gap-3'} ${className}`}>
      <div className={compacto ? 'flex-1' : ''}>
        {!compacto && (
          <label className="block text-xs font-medium text-texto-secundario mb-1">
            {etiquetaDesde}
          </label>
        )}
        <SelectorFecha
          valor={desde || null}
          onChange={manejarDesde}
          placeholder={placeholderDesde}
          disabled={deshabilitado}
          limpiable
          error={errorDesde || undefined}
        />
      </div>

      {compacto && (
        <span className="text-texto-terciario flex-shrink-0 mt-0.5">
          <ArrowRight size={14} />
        </span>
      )}

      <div className={compacto ? 'flex-1' : ''}>
        {!compacto && (
          <label className="block text-xs font-medium text-texto-secundario mb-1">
            {etiquetaHasta}
          </label>
        )}
        <SelectorFecha
          valor={hasta || null}
          onChange={manejarHasta}
          placeholder={placeholderHasta}
          disabled={deshabilitado}
          limpiable
          error={errorHasta || undefined}
        />
      </div>
    </div>
  )
}

export { SelectorRangoFecha }
export type { PropiedadesSelectorRangoFecha }

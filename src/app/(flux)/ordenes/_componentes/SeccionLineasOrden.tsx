'use client'

import { Package, AlignLeft, Minus } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import type { LineaOrdenTrabajo } from '@/tipos/orden-trabajo'

/**
 * SeccionLineasOrden — Lista de trabajos/servicios de la orden (sin precios).
 * Muestra descripción, cantidad y unidad. Soporta secciones y notas.
 * Se usa en: VistaOrdenTrabajo.
 */

interface Props {
  lineas: LineaOrdenTrabajo[]
}

export default function SeccionLineasOrden({ lineas }: Props) {
  const { t } = useTraduccion()

  if (lineas.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-texto-terciario">
        {t('ordenes.sin_lineas')}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-3">
        {t('ordenes.detalle_trabajo')}
      </p>

      <div className="space-y-0.5">
        {lineas.map((linea) => {
          // Sección (separador visual)
          if (linea.tipo_linea === 'seccion') {
            return (
              <div key={linea.id} className="pt-3 pb-1.5 border-b border-borde-sutil">
                <p className="text-xs font-semibold text-texto-secundario uppercase tracking-wider flex items-center gap-1.5">
                  <Minus size={12} className="text-texto-terciario" />
                  {linea.descripcion}
                </p>
              </div>
            )
          }

          // Nota (texto libre)
          if (linea.tipo_linea === 'nota') {
            return (
              <div key={linea.id} className="py-2 px-3 bg-white/[0.02] rounded-card">
                <p className="text-xs text-texto-terciario italic flex items-start gap-1.5">
                  <AlignLeft size={12} className="shrink-0 mt-0.5" />
                  {linea.descripcion}
                </p>
              </div>
            )
          }

          // Producto/servicio (línea principal)
          const cantidadTexto = linea.cantidad && linea.cantidad !== '1'
            ? `${linea.cantidad}${linea.unidad ? ` ${linea.unidad}` : ''}`
            : linea.unidad || null

          return (
            <div
              key={linea.id}
              className="flex items-start gap-3 py-2.5 px-3 rounded-card hover:bg-superficie-hover/50 transition-colors"
            >
              <div className="w-7 h-7 rounded-card bg-texto-marca/10 flex items-center justify-center shrink-0 mt-0.5">
                <Package size={13} className="text-texto-marca" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-texto-primario">
                  {linea.descripcion || linea.codigo_producto || 'Sin descripción'}
                </p>
                {linea.descripcion_detalle && (
                  <p className="text-xs text-texto-terciario mt-0.5">{linea.descripcion_detalle}</p>
                )}
              </div>
              {cantidadTexto && (
                <span className="text-xs text-texto-terciario shrink-0 bg-white/[0.04] px-2 py-0.5 rounded">
                  {cantidadTexto}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

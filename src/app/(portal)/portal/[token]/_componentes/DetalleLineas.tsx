'use client'

/**
 * DetalleLineas — Accordion de líneas del presupuesto con totales.
 * Primera línea producto expandida por defecto, las demás colapsadas.
 * Estilo: tarjeta con título e ícono, código de producto visible, detalle con borde izquierdo.
 * Se usa en: VistaPortal
 */

import { useState } from 'react'
import { ChevronDown, FileText } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { formatearNumero } from '@/lib/pdf/renderizar-html'
import { useTraduccion } from '@/lib/i18n'
import type { LineaPresupuesto } from '@/tipos/presupuesto'

interface Props {
  lineas: LineaPresupuesto[]
  simbolo: string
  subtotalNeto: string
  totalImpuestos: string
  descuentoGlobal: string
  descuentoGlobalMonto: string
  totalFinal: string
}

export default function DetalleLineas({
  lineas,
  simbolo,
  subtotalNeto,
  totalImpuestos,
  descuentoGlobal,
  descuentoGlobalMonto,
  totalFinal,
}: Props) {
  const { t } = useTraduccion()
  const lineasProducto = lineas.filter(l => l.tipo_linea === 'producto')
  // Primera línea producto expandida por defecto
  const [expandida, setExpandida] = useState<string | null>(lineasProducto[0]?.id || null)

  const toggleExpandir = (id: string) => {
    setExpandida(prev => prev === id ? null : id)
  }

  return (
    <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">
      {/* Título con ícono */}
      <div className="px-5 py-4 border-b border-borde-sutil flex items-center gap-2">
        <FileText size={16} className="text-texto-terciario" />
        <h3 className="text-sm font-semibold text-texto-primario">{t('portal.detalle')}</h3>
      </div>

      {/* Líneas */}
      <div className="divide-y divide-borde-sutil">
        {[...lineas].sort((a, b) => a.orden - b.orden).map(linea => {
          if (linea.tipo_linea === 'seccion') {
            return (
              <div key={linea.id} className="px-5 py-2.5 bg-superficie-elevada">
                <span className="text-xs font-semibold text-texto-secundario uppercase tracking-wider">
                  {linea.descripcion}
                </span>
              </div>
            )
          }

          if (linea.tipo_linea === 'nota') {
            return (
              <div key={linea.id} className="px-5 py-2 bg-superficie-app/50">
                <p className="text-xs text-texto-terciario italic">{linea.descripcion}</p>
              </div>
            )
          }

          if (linea.tipo_linea === 'descuento') {
            return (
              <div key={linea.id} className="px-5 py-2.5 flex justify-between items-center">
                <span className="text-sm text-estado-error">{linea.descripcion || t('portal.descuento')}</span>
                <span className="text-sm font-mono text-estado-error">
                  -{simbolo} {formatearNumero(linea.monto || '0')}
                </span>
              </div>
            )
          }

          // Producto
          const esExpandida = expandida === linea.id
          return (
            <div key={linea.id}>
              <Boton
                variante="fantasma"
                onClick={() => toggleExpandir(linea.id)}
                className="!w-full !px-5 !py-3.5 !justify-between !text-left !rounded-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      size={14}
                      className={`text-texto-terciario transition-transform shrink-0 ${esExpandida ? 'rotate-180' : ''}`}
                    />
                    <p className="text-sm font-medium text-texto-primario">{linea.descripcion}</p>
                  </div>
                  {linea.codigo_producto && (
                    <p className="text-xs text-texto-terciario mt-0.5 ml-[22px]">
                      Cód. {linea.codigo_producto}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-mono font-medium text-texto-primario">
                    {simbolo} {formatearNumero(linea.subtotal)}
                  </span>
                  {!esExpandida && (
                    <p className="text-xs text-texto-terciario mt-0.5">
                      {formatearNumero(linea.cantidad)} {linea.unidad || 'un'} &times; {simbolo} {formatearNumero(linea.precio_unitario)}
                    </p>
                  )}
                </div>
              </Boton>

              {esExpandida && (
                <div className="px-5 pb-4">
                  {linea.descripcion_detalle && (
                    <div className="ml-[22px] pl-4 border-l-2 border-borde-fuerte py-3 mb-3">
                      <p className="text-sm text-texto-secundario leading-relaxed whitespace-pre-line">
                        {linea.descripcion_detalle}
                      </p>
                    </div>
                  )}
                  <div className="ml-[22px] flex flex-wrap gap-x-5 gap-y-1 text-xs text-texto-terciario">
                    <span>{formatearNumero(linea.cantidad)} {linea.unidad || 'un'} &times; {simbolo} {formatearNumero(linea.precio_unitario)}</span>
                    {parseFloat(linea.descuento) > 0 && (
                      <span>{t('portal.descuento_linea')}: {linea.descuento}%</span>
                    )}
                    {linea.impuesto_label && (
                      <span>{linea.impuesto_label}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Totales */}
      <div className="px-5 py-4 border-t border-borde-sutil space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-texto-secundario">{t('portal.subtotal_neto')}</span>
          <span className="font-mono text-texto-primario">{simbolo} {formatearNumero(subtotalNeto)}</span>
        </div>
        {parseFloat(totalImpuestos) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-texto-secundario">{t('portal.impuestos')}</span>
            <span className="font-mono text-texto-primario">{simbolo} {formatearNumero(totalImpuestos)}</span>
          </div>
        )}
        {parseFloat(descuentoGlobal) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-texto-secundario">{t('portal.descuento')} ({descuentoGlobal}%)</span>
            <span className="font-mono text-estado-error">-{simbolo} {formatearNumero(descuentoGlobalMonto)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold border-t border-borde-sutil pt-3 mt-2">
          <span className="text-texto-primario">{t('portal.total')}</span>
          <span className="font-mono text-texto-primario">{simbolo} {formatearNumero(totalFinal)}</span>
        </div>
      </div>
    </div>
  )
}

'use client'

/**
 * DetalleLineas — Accordion de líneas del presupuesto con totales.
 * 1 línea → expandida. Varias → accordion (expandir una colapsa las demás).
 * Se usa en: VistaPortal
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatearNumero } from '@/lib/pdf/renderizar-html'
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
  const lineasProducto = lineas.filter(l => l.tipo_linea === 'producto')
  const soloUna = lineasProducto.length === 1
  const [expandida, setExpandida] = useState<string | null>(soloUna ? lineasProducto[0]?.id : null)

  const toggleExpandir = (id: string) => {
    setExpandida(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[11px] text-texto-terciario uppercase tracking-wider font-medium">
        Detalle
      </h3>

      <div className="border border-borde-sutil rounded-xl overflow-hidden divide-y divide-borde-sutil">
        {lineas.sort((a, b) => a.orden - b.orden).map(linea => {
          if (linea.tipo_linea === 'seccion') {
            return (
              <div key={linea.id} className="px-4 py-2.5 bg-superficie-elevada">
                <span className="text-xs font-semibold text-texto-secundario uppercase tracking-wider">
                  {linea.descripcion}
                </span>
              </div>
            )
          }

          if (linea.tipo_linea === 'nota') {
            return (
              <div key={linea.id} className="px-4 py-2 bg-superficie-app/50">
                <p className="text-xs text-texto-terciario italic">{linea.descripcion}</p>
              </div>
            )
          }

          if (linea.tipo_linea === 'descuento') {
            return (
              <div key={linea.id} className="px-4 py-2.5 flex justify-between items-center">
                <span className="text-sm text-estado-error">{linea.descripcion || 'Descuento'}</span>
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
              <button
                onClick={() => toggleExpandir(linea.id)}
                className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-superficie-app/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-texto-primario">{linea.descripcion}</p>
                  {!esExpandida && (
                    <p className="text-xs text-texto-terciario mt-0.5">
                      {formatearNumero(linea.cantidad)} {linea.unidad || 'un'} &times; {simbolo} {formatearNumero(linea.precio_unitario)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-mono font-medium text-texto-primario">
                    {simbolo} {formatearNumero(linea.subtotal)}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-texto-terciario transition-transform ${esExpandida ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {esExpandida && (
                <div className="px-4 pb-3 space-y-2 bg-superficie-app/30">
                  {linea.descripcion_detalle && (
                    <p className="text-xs text-texto-secundario leading-relaxed">
                      {linea.descripcion_detalle}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-terciario">
                    <span>Cantidad: {formatearNumero(linea.cantidad)} {linea.unidad || 'un'}</span>
                    <span>Precio unit.: {simbolo} {formatearNumero(linea.precio_unitario)}</span>
                    {parseFloat(linea.descuento) > 0 && (
                      <span>Descuento: {linea.descuento}%</span>
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
      <div className="space-y-1.5 pt-2">
        <div className="flex justify-between text-sm">
          <span className="text-texto-secundario">Subtotal neto</span>
          <span className="font-mono text-texto-primario">{simbolo} {formatearNumero(subtotalNeto)}</span>
        </div>
        {parseFloat(totalImpuestos) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-texto-secundario">Impuestos</span>
            <span className="font-mono text-texto-primario">{simbolo} {formatearNumero(totalImpuestos)}</span>
          </div>
        )}
        {parseFloat(descuentoGlobal) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-texto-secundario">Descuento ({descuentoGlobal}%)</span>
            <span className="font-mono text-estado-error">-{simbolo} {formatearNumero(descuentoGlobalMonto)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t border-borde-sutil pt-2 mt-2">
          <span className="text-texto-primario">Total</span>
          <span className="font-mono text-marca-500">{simbolo} {formatearNumero(totalFinal)}</span>
        </div>
      </div>
    </div>
  )
}

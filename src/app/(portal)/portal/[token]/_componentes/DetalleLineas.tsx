'use client'

/**
 * DetalleLineas — Accordion de líneas del presupuesto con totales.
 *
 * Estructura: las líneas se agrupan por sección. Cada grupo tiene su header
 * (sección) y sus ítems (productos, notas, descuentos). Esto permite que las
 * notas y productos dentro de una sección se vean como pertenecientes a ese
 * grupo, en vez de ser hermanos sueltos con un divider entre cada uno.
 *
 * - Entre grupos: separación fuerte (header de sección con border-t y padding amplio).
 * - Dentro del grupo: separadores sutiles (divide-y con opacidad reducida).
 * - Notas: estilo inline (italic) sin bg propio para no romper la continuidad.
 *
 * Se usa en: VistaPortal
 */

import { useMemo, useState } from 'react'
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

  // Estado inicial de expansión:
  //   • ≤ 3 productos → todos expandidos (set vacío de colapsadas)
  //   • > 3 productos → solo el primero expandido, el resto colapsado
  // Se computa una sola vez al montar; después el usuario puede toggle libre.
  const [colapsadas, setColapsadas] = useState<Set<string>>(() => {
    const productos = lineas.filter(l => l.tipo_linea === 'producto')
    if (productos.length <= 3) return new Set()
    return new Set(productos.slice(1).map(p => p.id))
  })

  const toggleExpandir = (id: string) => {
    setColapsadas(prev => {
      const sig = new Set(prev)
      if (sig.has(id)) sig.delete(id)
      else sig.add(id)
      return sig
    })
  }

  // Agrupar líneas por sección. Cada grupo: { header, items[] }.
  // Items que vienen antes de cualquier sección caen en un grupo con header=null.
  type Grupo = { header: LineaPresupuesto | null; items: LineaPresupuesto[] }
  const grupos = useMemo<Grupo[]>(() => {
    const ordenadas = [...lineas].sort((a, b) => a.orden - b.orden)
    const result: Grupo[] = []
    let actual: Grupo | null = null
    for (const linea of ordenadas) {
      if (linea.tipo_linea === 'seccion') {
        if (actual) result.push(actual)
        actual = { header: linea, items: [] }
      } else {
        if (!actual) actual = { header: null, items: [] }
        actual.items.push(linea)
      }
    }
    if (actual) result.push(actual)
    return result
  }, [lineas])

  return (
    <div className="bg-superficie-tarjeta rounded-card border border-borde-sutil overflow-hidden">
      {/* Cabecera de la tarjeta */}
      <div className="px-5 py-5 border-b border-borde-sutil flex items-center gap-2">
        <FileText size={16} className="text-texto-terciario" />
        <h3 className="text-sm font-semibold text-texto-primario">{t('portal.detalle')}</h3>
      </div>

      {/* Grupos: cada sección + sus ítems forman un bloque visual */}
      {grupos.map((grupo, gi) => (
        <div key={grupo.header?.id ?? `grupo-${gi}`}>
          {/* Header de sección: bloque compacto con fondo y borde inferior */}
          {grupo.header && (
            <div className="px-5 py-3 bg-superficie-elevada border-b border-borde-sutil">
              <h4 className="text-xs font-bold text-texto-primario uppercase tracking-wider">
                {grupo.header.descripcion}
              </h4>
            </div>
          )}

          {/* Ítems del grupo: la divisoria entre productos debe ser visible
              (antes con /40 quedaba imperceptible en dark mode) */}
          <div className="divide-y divide-borde-sutil">
            {grupo.items.map(linea => {
              if (linea.tipo_linea === 'nota') {
                return (
                  <div key={linea.id} className="px-5 py-4">
                    <p className="text-sm text-texto-secundario italic leading-relaxed">
                      {linea.descripcion}
                    </p>
                  </div>
                )
              }

              if (linea.tipo_linea === 'descuento') {
                return (
                  <div key={linea.id} className="px-5 py-3 flex justify-between items-center">
                    <span className="text-sm text-estado-error">
                      {linea.descripcion || t('portal.descuento')}
                    </span>
                    <span className="text-sm font-mono text-estado-error">
                      -{simbolo} {formatearNumero(linea.monto || '0')}
                    </span>
                  </div>
                )
              }

              // Producto
              const esExpandida = !colapsadas.has(linea.id)
              return (
                <div key={linea.id}>
                  <Boton
                    variante="fantasma"
                    onClick={() => toggleExpandir(linea.id)}
                    className="group !w-full !px-5 !py-8 !justify-between !text-left !rounded-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        {/* Chevron en cápsula para que se lea como "botón clickeable" */}
                        <span
                          className={`shrink-0 mt-0.5 inline-flex items-center justify-center size-7 rounded-full border transition-colors ${
                            esExpandida
                              ? 'border-borde-fuerte bg-superficie-elevada text-texto-primario'
                              : 'border-borde-sutil bg-superficie-elevada/60 text-texto-secundario group-hover:border-borde-fuerte group-hover:text-texto-primario'
                          }`}
                          aria-hidden="true"
                        >
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${esExpandida ? 'rotate-180' : ''}`}
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-texto-primario leading-snug">
                            {linea.descripcion}
                          </p>
                          {linea.codigo_producto && (
                            <p className="text-xs text-texto-terciario mt-1.5">
                              Cód. {linea.codigo_producto}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-4">
                      <span className="text-sm font-mono font-medium text-texto-primario">
                        {simbolo} {formatearNumero(linea.subtotal)}
                      </span>
                      <p className="text-xs text-texto-terciario mt-1.5">
                        {formatearNumero(linea.cantidad)} {linea.unidad || 'un'} &times;{' '}
                        {simbolo} {formatearNumero(linea.precio_unitario)}
                      </p>
                    </div>
                  </Boton>

                  {esExpandida && linea.descripcion_detalle && (
                    <div className="px-5 pb-5">
                      <div className="ml-[26px] pl-4 border-l-2 border-borde-fuerte py-3.5">
                        <p className="text-sm text-texto-secundario leading-relaxed whitespace-pre-line">
                          {linea.descripcion_detalle}
                        </p>
                        {(parseFloat(linea.descuento) > 0 || linea.impuesto_label) && (
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-terciario">
                            {parseFloat(linea.descuento) > 0 && (
                              <span>{t('portal.descuento_linea')}: {linea.descuento}%</span>
                            )}
                            {linea.impuesto_label && <span>{linea.impuesto_label}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Totales: separación marcada respecto a los ítems */}
      <div className="px-5 py-6 border-t border-borde-sutil space-y-2.5 bg-superficie-elevada/40">
        <div className="flex justify-between text-sm">
          <span className="text-texto-secundario">{t('portal.subtotal_neto')}</span>
          <span className="font-mono text-texto-primario">
            {simbolo} {formatearNumero(subtotalNeto)}
          </span>
        </div>
        {parseFloat(totalImpuestos) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-texto-secundario">{t('portal.impuestos')}</span>
            <span className="font-mono text-texto-primario">
              {simbolo} {formatearNumero(totalImpuestos)}
            </span>
          </div>
        )}
        {parseFloat(descuentoGlobal) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-texto-secundario">
              {t('portal.descuento')} ({descuentoGlobal}%)
            </span>
            <span className="font-mono text-estado-error">
              -{simbolo} {formatearNumero(descuentoGlobalMonto)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold border-t border-borde-sutil pt-4 mt-3">
          <span className="text-texto-primario">{t('portal.total')}</span>
          <span className="font-mono text-texto-primario">
            {simbolo} {formatearNumero(totalFinal)}
          </span>
        </div>
      </div>
    </div>
  )
}

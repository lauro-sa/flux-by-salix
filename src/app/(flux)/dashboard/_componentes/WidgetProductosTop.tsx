'use client'

/**
 * WidgetProductosTop — Productos/servicios más cotizados y vendidos.
 * Vistas: Cotizados (presupuestados) / Vendidos (en órdenes de venta).
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, Package, Briefcase } from 'lucide-react'
import { Insignia } from '@/componentes/ui/Insignia'
import { InfoBoton } from '@/componentes/ui/InfoBoton'

interface Producto {
  id: string
  nombre: string
  tipo: string
  precio_unitario: number | null
  veces_presupuestado: number
  veces_vendido: number
}

interface Props {
  productos: Producto[]
  formatoMoneda: (n: number) => string
}

export function WidgetProductosTop({ productos, formatoMoneda }: Props) {
  const router = useRouter()
  const [vista, setVista] = useState<'cotizados' | 'vendidos'>('cotizados')
  const campo = vista === 'cotizados' ? 'veces_presupuestado' : 'veces_vendido'

  const ordenados = [...productos].sort((a, b) => b[campo] - a[campo]).filter((p) => p[campo] > 0)
  const max = ordenados[0]?.[campo] || 1

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-borde-sutil">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-sm font-semibold text-texto-primario truncate">Productos y servicios</h3>
          <InfoBoton
            titulo="Productos y servicios"
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Te muestra <strong className="text-texto-primario">qué productos o servicios son los
                    que más usás en tus presupuestos</strong>. Es útil para saber qué ofrecés realmente,
                    cuáles son tus &quot;caballitos de batalla&quot; y cuáles cotizás pero no se venden.
                  </p>
                ),
              },
              {
                titulo: 'Cotizados vs Vendidos',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-texto-primario">Cotizados:</strong> cuántas veces aparecieron
                      en presupuestos (de cualquier estado).
                    </li>
                    <li>
                      <strong className="text-texto-primario">Vendidos:</strong> cuántas veces aparecieron
                      en presupuestos que el cliente terminó aceptando.
                    </li>
                    <li className="text-texto-terciario pt-1">
                      Si un producto está alto en Cotizados pero bajo en Vendidos, el cliente lo pide pero
                      después no compra. Revisá precio, calidad o argumentación de venta.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Cómo leerlo',
                contenido: (
                  <ul className="space-y-1.5 list-disc pl-4">
                    <li>El <strong className="text-texto-primario">#1</strong> es tu producto estrella.</li>
                    <li>La barra te muestra qué tan dominante es respecto al resto.</li>
                    <li>El precio unitario es de referencia (puede variar por presupuesto).</li>
                    <li>Si tu top 3 representa más del 80% de la actividad, dependés mucho de pocos items.</li>
                  </ul>
                ),
              },
              {
                titulo: 'Cruzá con otros widgets',
                contenido: (
                  <ul className="space-y-2 list-none">
                    <li>
                      <strong className="text-texto-primario">Con &quot;Pipeline&quot; y &quot;Cobros&quot;:</strong>{' '}
                      <span className="text-texto-terciario">si un producto está mucho en Cotizados pero
                      poco en Vendidos, esos presupuestos están en estados perdidos. Revisá por qué no se
                      cierran.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Clientes&quot;:</strong>{' '}
                      <span className="text-texto-terciario">¿qué tipo de cliente compra qué producto?
                      Útil para personalizar ofertas por segmento.</span>
                    </li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setVista('cotizados')}
            className={`px-2.5 py-1 rounded-full text-xxs font-medium transition-colors ${
              vista === 'cotizados'
                ? 'bg-texto-marca/[0.1] text-texto-marca'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            Cotizados
          </button>
          <button
            type="button"
            onClick={() => setVista('vendidos')}
            className={`px-2.5 py-1 rounded-full text-xxs font-medium transition-colors ${
              vista === 'vendidos'
                ? 'bg-texto-marca/[0.1] text-texto-marca'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            Vendidos
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 sm:px-5 py-4">
        {ordenados.length > 0 ? (
          <div className="space-y-2.5">
            {ordenados.slice(0, 6).map((p, i) => {
              const porcentaje = (p[campo] / max) * 100
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-texto-terciario font-medium w-4 shrink-0 tabular-nums">#{i + 1}</span>
                      {p.tipo === 'servicio' ? (
                        <Briefcase size={12} className="text-texto-terciario shrink-0" />
                      ) : (
                        <Package size={12} className="text-texto-terciario shrink-0" />
                      )}
                      <span className="text-texto-primario truncate">{p.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Insignia color="info">{p[campo]}x</Insignia>
                      {p.precio_unitario != null && (
                        <span className="text-texto-terciario tabular-nums">{formatoMoneda(p.precio_unitario)}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-superficie-hover overflow-hidden ml-6">
                    <motion.div
                      className="h-full rounded-full bg-texto-marca/40"
                      initial={{ width: 0 }}
                      animate={{ width: `${porcentaje}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.05 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-texto-terciario text-center py-6">Sin datos aún</p>
        )}
      </div>

      {/* Footer */}
      <button
        type="button"
        onClick={() => router.push('/productos')}
        className="w-full px-4 sm:px-5 py-2.5 border-t border-borde-sutil/60 text-xxs text-texto-terciario hover:text-texto-marca transition-colors inline-flex items-center justify-center gap-1"
      >
        Ver todos los productos <ArrowRight className="size-3" />
      </button>
    </div>
  )
}

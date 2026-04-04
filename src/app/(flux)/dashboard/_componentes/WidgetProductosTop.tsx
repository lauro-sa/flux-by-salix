'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, Package, Briefcase } from 'lucide-react'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'

/**
 * WidgetProductosTop — Productos/servicios más cotizados y vendidos.
 * Pestaña 1 "Cotizados": top por veces_presupuestado
 * Pestaña 2 "Vendidos": top por veces_vendido
 */

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

  const renderLista = (items: Producto[], campo: 'veces_presupuestado' | 'veces_vendido') => {
    const ordenados = [...items].sort((a, b) => b[campo] - a[campo]).filter(p => p[campo] > 0)
    const max = ordenados[0]?.[campo] || 1

    if (ordenados.length === 0) {
      return <p className="text-sm text-texto-terciario text-center py-4">Sin datos aún</p>
    }

    return (
      <div className="space-y-2.5">
        {ordenados.slice(0, 6).map((p, i) => {
          const porcentaje = (p[campo] / max) * 100
          return (
            <div key={p.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-texto-terciario font-medium w-4 shrink-0">{i + 1}</span>
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
    )
  }

  return (
    <TarjetaConPestanas
      titulo="Productos y servicios"
      subtitulo="Los más usados en presupuestos"
      pestanas={[
        { etiqueta: 'Cotizados', contenido: renderLista(productos, 'veces_presupuestado') },
        { etiqueta: 'Vendidos', contenido: renderLista(productos, 'veces_vendido') },
      ]}
      acciones={
        <Boton variante="fantasma" tamano="xs" iconoDerecho={<ArrowRight size={12} />} onClick={() => router.push('/productos')}>
          Ver todo
        </Boton>
      }
    />
  )
}

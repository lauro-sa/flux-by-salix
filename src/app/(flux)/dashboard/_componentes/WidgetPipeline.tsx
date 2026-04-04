'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'

/**
 * WidgetPipeline — Pipeline de ventas con dos vistas:
 * Pestaña 1 "Embudo": barras horizontales con monto $ por estado
 * Pestaña 2 "Detalle": conteo + monto lado a lado por estado
 *
 * Estados reales del flujo:
 * borrador → enviado → confirmado_cliente → orden_venta
 *                     → rechazado / vencido / cancelado
 */

// Orden lógico del embudo de ventas (estados reales del sistema)
const ORDEN_EMBUDO: Array<{ clave: string; etiqueta: string }> = [
  { clave: 'borrador', etiqueta: 'Borrador' },
  { clave: 'enviado', etiqueta: 'Enviado' },
  { clave: 'confirmado_cliente', etiqueta: 'Confirmado' },
  { clave: 'orden_venta', etiqueta: 'Orden de venta' },
  { clave: 'rechazado', etiqueta: 'Rechazado' },
  { clave: 'vencido', etiqueta: 'Vencido' },
  { clave: 'cancelado', etiqueta: 'Cancelado' },
]

const COLOR_ESTADO: Record<string, 'neutro' | 'violeta' | 'exito' | 'peligro' | 'naranja' | 'info'> = {
  borrador: 'neutro',
  enviado: 'violeta',
  confirmado_cliente: 'info',
  orden_venta: 'exito',
  rechazado: 'peligro',
  vencido: 'naranja',
  cancelado: 'neutro',
}

const COLOR_BARRA: Record<string, string> = {
  borrador: 'bg-texto-terciario/40',
  enviado: 'bg-insignia-violeta-texto',
  confirmado_cliente: 'bg-insignia-info-texto',
  orden_venta: 'bg-insignia-exito-texto',
  rechazado: 'bg-insignia-peligro-texto',
  vencido: 'bg-insignia-naranja-texto',
  cancelado: 'bg-texto-terciario/30',
}

interface Props {
  porEstado: Record<string, number>
  pipelineMontos: Record<string, number>
  formatoMoneda: (n: number) => string
}

export function WidgetPipeline({ porEstado, pipelineMontos, formatoMoneda }: Props) {
  const router = useRouter()
  const montoMax = Math.max(...Object.values(pipelineMontos), 1)

  // Pipeline activo = borrador + enviado (lo que aún no se cerró)
  const totalPipelineActivo = ['borrador', 'enviado'].reduce((sum, e) => sum + (pipelineMontos[e] || 0), 0)

  // Total ganado = confirmado_cliente + orden_venta
  const totalGanado = ['confirmado_cliente', 'orden_venta'].reduce((sum, e) => sum + (pipelineMontos[e] || 0), 0)

  const contenidoEmbudo = (
    <div className="space-y-3">
      {/* KPIs: Pipeline activo + Ganado */}
      <div className="grid grid-cols-2 gap-3 pb-3 border-b border-borde-sutil">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-0.5">
            <TrendingUp size={13} className="text-texto-marca" />
            <span className="text-xxs text-texto-terciario">Pipeline activo</span>
          </div>
          <span className="text-base font-bold text-texto-primario">{formatoMoneda(totalPipelineActivo)}</span>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-0.5">
            <TrendingUp size={13} className="text-insignia-exito-texto" />
            <span className="text-xxs text-texto-terciario">Ganado</span>
          </div>
          <span className="text-base font-bold text-insignia-exito-texto">{formatoMoneda(totalGanado)}</span>
        </div>
      </div>

      {/* Barras del embudo — muestra todos los estados que tienen datos */}
      {ORDEN_EMBUDO.filter(e => pipelineMontos[e.clave] || porEstado[e.clave]).map(({ clave, etiqueta }) => {
        const monto = pipelineMontos[clave] || 0
        const porcentaje = montoMax > 0 ? (monto / montoMax) * 100 : 0
        return (
          <div key={clave}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2">
                <Insignia color={COLOR_ESTADO[clave] || 'neutro'}>{etiqueta}</Insignia>
                <span className="text-texto-terciario">{porEstado[clave] || 0}</span>
              </div>
              <span className="text-texto-primario font-semibold">{formatoMoneda(monto)}</span>
            </div>
            <div className="h-2 rounded-full bg-superficie-hover overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${COLOR_BARRA[clave] || 'bg-texto-marca/50'}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(porcentaje, 2)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )

  const contenidoDetalle = (
    <div className="space-y-1">
      {/* Tabla */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 text-xs">
        <span className="text-texto-terciario font-medium">Estado</span>
        <span className="text-texto-terciario font-medium text-right">Cant.</span>
        <span className="text-texto-terciario font-medium text-right">Monto</span>

        {ORDEN_EMBUDO.filter(e => porEstado[e.clave]).map(({ clave, etiqueta }) => (
          <div key={clave} className="contents">
            <div>
              <Insignia color={COLOR_ESTADO[clave] || 'neutro'}>{etiqueta}</Insignia>
            </div>
            <span className="text-texto-primario font-medium text-right tabular-nums">
              {porEstado[clave] || 0}
            </span>
            <span className="text-texto-primario font-semibold text-right tabular-nums">
              {formatoMoneda(pipelineMontos[clave] || 0)}
            </span>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div className="pt-3 mt-2 border-t border-borde-sutil space-y-1.5 text-xs">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4">
          <span className="text-texto-primario font-semibold">Total</span>
          <span className="text-texto-primario font-semibold text-right tabular-nums">
            {Object.values(porEstado).reduce((a, b) => a + b, 0)}
          </span>
          <span className="text-texto-primario font-bold text-right tabular-nums">
            {formatoMoneda(Object.values(pipelineMontos).reduce((a, b) => a + b, 0))}
          </span>
        </div>
        {/* Desglose: activo vs ganado vs perdido */}
        <div className="grid grid-cols-[1fr_auto] gap-x-4 text-xxs">
          <span className="text-texto-terciario">Activo (borrador + enviado)</span>
          <span className="text-texto-primario font-medium text-right tabular-nums">{formatoMoneda(totalPipelineActivo)}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 text-xxs">
          <span className="text-texto-terciario">Ganado (confirmado + orden venta)</span>
          <span className="text-insignia-exito-texto font-medium text-right tabular-nums">{formatoMoneda(totalGanado)}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 text-xxs">
          <span className="text-texto-terciario">Perdido (rechazado + vencido + cancelado)</span>
          <span className="text-insignia-peligro-texto font-medium text-right tabular-nums">
            {formatoMoneda(['rechazado', 'vencido', 'cancelado'].reduce((s, e) => s + (pipelineMontos[e] || 0), 0))}
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <TarjetaConPestanas
      titulo="Pipeline de presupuestos"
      subtitulo="Todos los presupuestos por estado"
      pestanas={[
        { etiqueta: 'Embudo', contenido: contenidoEmbudo },
        { etiqueta: 'Detalle', contenido: contenidoDetalle },
      ]}
      acciones={
        <Boton variante="fantasma" tamano="xs" iconoDerecho={<ArrowRight size={12} />} onClick={() => router.push('/presupuestos')}>
          Ver todo
        </Boton>
      }
    />
  )
}

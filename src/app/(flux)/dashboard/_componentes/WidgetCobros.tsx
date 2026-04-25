'use client'

import { useMemo } from 'react'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { CreditCard, Clock, TrendingUp } from 'lucide-react'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'

/**
 * WidgetCobros — Plata real cobrada vs proyección de cobro futuro.
 * Diferencia clave con WidgetIngresos: este mide pagos efectivamente recibidos
 * (presupuesto_pagos.fecha_pago), no presupuestos aceptados (devengado).
 */

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface Props {
  /** Pagos reales cobrados, agrupados por mes de fecha_pago */
  cobradoPorMes: Record<string, { cantidad: number; monto: number }>
  /** Cuotas pendientes/parciales con su fecha estimada de cobro (proyección) */
  proyeccionPorMes: Record<string, { cantidad: number; monto: number }>
  /** Devengado por mes (de WidgetIngresos) — para comparación de conversión */
  devengadoPorMes?: Record<string, { cantidad: number; monto: number }>
  formatoMoneda: (n: number) => string
}

function fmtClave(clave: string): string {
  const [anio, mes] = clave.split('-').map(Number)
  return `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`
}

function TooltipPersonalizado({
  active, payload, label, formatoMoneda,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string; payload: Record<string, number> }>
  label?: string
  formatoMoneda: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  const datos = payload[0]?.payload
  if (!datos) return null
  const cobrado = datos.cobrado_monto || 0
  const proyectado = datos.proyectado_monto || 0
  const devengado = datos.devengado_monto || 0

  return (
    <div className="bg-[var(--superficie-tarjeta)] border border-borde-fuerte rounded-card px-3 py-2.5 shadow-md min-w-[220px]">
      <p className="text-xs text-texto-terciario mb-2 font-medium">{label}</p>
      <div className="space-y-1.5">
        {cobrado > 0 && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ backgroundColor: 'var(--insignia-exito-texto)' }} />
              <span className="text-xs text-texto-secundario">Cobrado</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-insignia-exito-texto">{formatoMoneda(cobrado)}</span>
              <span className="text-xxs text-texto-terciario ml-1">({datos.cobrado_cantidad || 0})</span>
            </div>
          </div>
        )}
        {proyectado > 0 && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ backgroundColor: 'var(--insignia-cyan-texto)' }} />
              <span className="text-xs text-texto-secundario">Por cobrar</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-insignia-cyan-texto">{formatoMoneda(proyectado)}</span>
              <span className="text-xxs text-texto-terciario ml-1">({datos.proyectado_cantidad || 0})</span>
            </div>
          </div>
        )}
        {devengado > 0 && (
          <div className="flex items-center justify-between gap-4 pt-1.5 mt-1 border-t border-borde-sutil">
            <span className="text-xxs text-texto-terciario">Devengado</span>
            <span className="text-xxs text-texto-secundario">{formatoMoneda(devengado)}</span>
          </div>
        )}
        {cobrado > 0 && devengado > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xxs text-texto-terciario">Tasa de cobro</span>
            <span className="text-xxs font-bold text-texto-primario">
              {Math.round((cobrado / devengado) * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function WidgetCobros({ cobradoPorMes, proyeccionPorMes, devengadoPorMes = {}, formatoMoneda }: Props) {
  // Años disponibles
  const aniosDisponibles = useMemo(() => {
    const anios = new Set<number>()
    for (const clave of [
      ...Object.keys(cobradoPorMes),
      ...Object.keys(proyeccionPorMes),
      ...Object.keys(devengadoPorMes),
    ]) {
      anios.add(parseInt(clave.split('-')[0]))
    }
    if (anios.size === 0) anios.add(new Date().getFullYear())
    return Array.from(anios).sort((a, b) => b - a)
  }, [cobradoPorMes, proyeccionPorMes, devengadoPorMes])

  const anioActual = aniosDisponibles[0] || new Date().getFullYear()

  const datosGrafico = useMemo(() => {
    return MESES_CORTOS.map((nombre, i) => {
      const clave = `${anioActual}-${String(i + 1).padStart(2, '0')}`
      const c = cobradoPorMes[clave] || { cantidad: 0, monto: 0 }
      const p = proyeccionPorMes[clave] || { cantidad: 0, monto: 0 }
      const d = devengadoPorMes[clave] || { cantidad: 0, monto: 0 }
      return {
        nombre,
        cobrado_monto: c.monto,
        cobrado_cantidad: c.cantidad,
        proyectado_monto: p.monto,
        proyectado_cantidad: p.cantidad,
        devengado_monto: d.monto,
      }
    })
  }, [anioActual, cobradoPorMes, proyeccionPorMes, devengadoPorMes])

  // KPIs del mes actual
  const claveMesActual = useMemo(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
  }, [])
  const cobradoEsteMes = cobradoPorMes[claveMesActual]?.monto || 0
  const proyectadoEsteMes = proyeccionPorMes[claveMesActual]?.monto || 0
  const devengadoEsteMes = devengadoPorMes[claveMesActual]?.monto || 0
  const tasaCobro = devengadoEsteMes > 0 ? Math.round((cobradoEsteMes / devengadoEsteMes) * 100) : 0

  // Total proyectado próximos 3 meses (incluido el actual)
  const proyectadoProximos = useMemo(() => {
    const h = new Date()
    let total = 0
    for (let i = 0; i < 3; i++) {
      const f = new Date(h.getFullYear(), h.getMonth() + i, 1)
      const c = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
      total += proyeccionPorMes[c]?.monto || 0
    }
    return total
  }, [proyeccionPorMes])

  const TabResumen = (
    <div className="space-y-4">
      {/* KPIs grandes */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-texto-terciario mb-1">
            <CreditCard className="size-3" />
            <span className="text-xxs uppercase tracking-wider">Cobrado este mes</span>
          </div>
          <p className="text-lg font-semibold text-insignia-exito-texto tabular-nums leading-tight">
            {formatoMoneda(cobradoEsteMes)}
          </p>
          {tasaCobro > 0 && (
            <p className="text-xxs text-texto-terciario mt-0.5">
              {tasaCobro}% del devengado
            </p>
          )}
        </div>
        <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-texto-terciario mb-1">
            <Clock className="size-3" />
            <span className="text-xxs uppercase tracking-wider">Por cobrar (mes)</span>
          </div>
          <p className="text-lg font-semibold text-insignia-cyan-texto tabular-nums leading-tight">
            {formatoMoneda(proyectadoEsteMes)}
          </p>
          <p className="text-xxs text-texto-terciario mt-0.5">cuotas pendientes</p>
        </div>
        <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-texto-terciario mb-1">
            <TrendingUp className="size-3" />
            <span className="text-xxs uppercase tracking-wider">Próximos 3 meses</span>
          </div>
          <p className="text-lg font-semibold text-texto-primario tabular-nums leading-tight">
            {formatoMoneda(proyectadoProximos)}
          </p>
          <p className="text-xxs text-texto-terciario mt-0.5">proyección de cobro</p>
        </div>
      </div>

      {/* Gráfico mensual */}
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <ComposedChart data={datosGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--borde-sutil)" />
            <XAxis dataKey="nombre" stroke="var(--texto-terciario)" fontSize={11} />
            <YAxis
              stroke="var(--texto-terciario)"
              fontSize={11}
              tickFormatter={(v) => v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
            />
            <Tooltip content={<TooltipPersonalizado formatoMoneda={formatoMoneda} />} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar
              dataKey="cobrado_monto"
              name="Cobrado"
              fill="var(--insignia-exito-texto)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="proyectado_monto"
              name="Por cobrar"
              fill="var(--insignia-cyan-texto)"
              radius={[4, 4, 0, 0]}
              opacity={0.6}
            />
            <Line
              dataKey="devengado_monto"
              name="Devengado"
              stroke="var(--texto-marca)"
              strokeWidth={2}
              dot={false}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  return (
    <TarjetaConPestanas
      titulo="Cobros"
      pestanas={[{ etiqueta: anioActual.toString(), contenido: TabResumen }]}
    />
  )
}

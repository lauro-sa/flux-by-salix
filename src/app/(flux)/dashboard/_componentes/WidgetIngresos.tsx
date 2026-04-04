'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, Area, Line, Bar, BarChart,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'

/**
 * WidgetIngresos — Presupuestos emitidos vs ventas cerradas.
 * Muestra dos líneas: lo que presupuestaste y lo que se cerró.
 * Pestaña "Mensual": gráfico con doble serie, filtrable por año, con tasa de conversión
 * Pestaña "Anual": resumen por año con conversión
 */

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface Props {
  /** Presupuestos ganados (confirmado_cliente + orden_venta) por mes — incluye desglose de órdenes */
  cerradosPorMes: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }>
  /** Presupuestos ganados por año — incluye desglose de órdenes */
  cerradosPorAnio: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }>
  /** TODOS los presupuestos creados por mes (cualquier estado) */
  emitidosPorMes: Record<string, { creados: number; monto_total: number }>
  formatoMoneda: (n: number) => string
}

function TooltipDoble({
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

  const emitidos = datos.emitidos_cantidad || 0
  const ordenes = datos.ordenes_cantidad || 0
  const conversion = emitidos > 0 ? Math.round((ordenes / emitidos) * 100) : 0

  return (
    <div className="bg-[var(--superficie-tarjeta)] border border-borde-fuerte rounded-lg px-3 py-2.5 shadow-md min-w-[200px]">
      <p className="text-xs text-texto-terciario mb-2 font-medium">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full" style={{ backgroundColor: 'var(--texto-marca)' }} />
            <span className="text-xs text-texto-secundario">Presupuestado</span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-texto-primario">{formatoMoneda(datos.emitidos_monto || 0)}</span>
            <span className="text-xxs text-texto-terciario ml-1">({emitidos})</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full" style={{ backgroundColor: 'var(--insignia-exito-texto)' }} />
            <span className="text-xs text-texto-secundario">Órdenes de venta</span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-insignia-exito-texto">{formatoMoneda(datos.ordenes_monto || 0)}</span>
            <span className="text-xxs text-texto-terciario ml-1">({ordenes})</span>
          </div>
        </div>
        {(datos.cerrados_cantidad || 0) > ordenes && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ backgroundColor: 'var(--insignia-info-texto)' }} />
              <span className="text-xs text-texto-terciario">Confirmado (pendiente cobro)</span>
            </div>
            <div className="text-right">
              <span className="text-xxs text-texto-secundario">{formatoMoneda((datos.cerrados_monto || 0) - (datos.ordenes_monto || 0))}</span>
              <span className="text-xxs text-texto-terciario ml-1">({(datos.cerrados_cantidad || 0) - ordenes})</span>
            </div>
          </div>
        )}
        <div className="pt-1.5 mt-1 border-t border-borde-sutil flex items-center justify-between">
          <span className="text-xxs text-texto-terciario">Conversión a orden</span>
          <span className={`text-xs font-bold ${conversion >= 50 ? 'text-insignia-exito-texto' : conversion >= 25 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'}`}>
            {conversion}%
          </span>
        </div>
      </div>
    </div>
  )
}

export function WidgetIngresos({ cerradosPorMes, cerradosPorAnio, emitidosPorMes, formatoMoneda }: Props) {
  // Años disponibles (unificando ambas fuentes)
  const aniosDisponibles = useMemo(() => {
    const anios = new Set<number>()
    for (const clave of [...Object.keys(cerradosPorMes), ...Object.keys(emitidosPorMes)]) {
      anios.add(parseInt(clave.split('-')[0]))
    }
    if (anios.size === 0) anios.add(new Date().getFullYear())
    return Array.from(anios).sort((a, b) => b - a)
  }, [cerradosPorMes, emitidosPorMes])

  const [anioSeleccionado, setAnioSeleccionado] = useState(aniosDisponibles[0])
  const [mostrarEmitidos, setMostrarEmitidos] = useState(true)

  // Datos mensuales combinados
  const datosMensuales = useMemo(() => {
    return MESES_CORTOS.map((mes, i) => {
      const clave = `${anioSeleccionado}-${String(i + 1).padStart(2, '0')}`
      const cerrados = cerradosPorMes[clave]
      const emitidos = emitidosPorMes[clave]
      return {
        mes,
        emitidos_monto: emitidos?.monto_total || 0,
        emitidos_cantidad: emitidos?.creados || 0,
        cerrados_monto: cerrados?.monto || 0,
        cerrados_cantidad: cerrados?.cantidad || 0,
        ordenes_monto: cerrados?.ordenes_monto || 0,
        ordenes_cantidad: cerrados?.ordenes_cantidad || 0,
      }
    })
  }, [cerradosPorMes, emitidosPorMes, anioSeleccionado])

  // Totales del año
  const totalEmitidosAnio = datosMensuales.reduce((s, m) => s + m.emitidos_cantidad, 0)
  const totalCerradosAnio = datosMensuales.reduce((s, m) => s + m.cerrados_cantidad, 0)
  const totalMontoEmitidoAnio = datosMensuales.reduce((s, m) => s + m.emitidos_monto, 0)
  const totalMontoCerradoAnio = datosMensuales.reduce((s, m) => s + m.cerrados_monto, 0)
  const totalOrdenesAnio = datosMensuales.reduce((s, m) => s + m.ordenes_cantidad, 0)
  const totalMontoOrdenesAnio = datosMensuales.reduce((s, m) => s + m.ordenes_monto, 0)
  const conversionAnio = totalEmitidosAnio > 0 ? Math.round((totalCerradosAnio / totalEmitidosAnio) * 100) : 0

  // Mes actual
  const mesActualIdx = new Date().getMonth()
  const mesActualData = datosMensuales[mesActualIdx]
  const mesAnteriorData = mesActualIdx > 0 ? datosMensuales[mesActualIdx - 1] : null
  const difMesCerrado = (mesActualData?.ordenes_monto || 0) - (mesAnteriorData?.ordenes_monto || 0)

  // Datos anuales
  const datosAnuales = useMemo(() => {
    const anios = new Set<string>()
    for (const k of [...Object.keys(cerradosPorAnio), ...Object.keys(emitidosPorMes)]) {
      anios.add(k.split('-')[0])
    }
    return Array.from(anios).sort().map(anio => {
      let emitidosCant = 0, emitidosMonto = 0
      for (let m = 1; m <= 12; m++) {
        const clave = `${anio}-${String(m).padStart(2, '0')}`
        emitidosCant += emitidosPorMes[clave]?.creados || 0
        emitidosMonto += emitidosPorMes[clave]?.monto_total || 0
      }
      const cerrados = cerradosPorAnio[anio]
      return {
        anio,
        emitidos_cantidad: emitidosCant,
        emitidos_monto: emitidosMonto,
        ordenes_cantidad: cerrados?.ordenes_cantidad || 0,
        ordenes_monto: cerrados?.ordenes_monto || 0,
        cerrados_cantidad: cerrados?.cantidad || 0,
        cerrados_monto: cerrados?.monto || 0,
        conversion: emitidosCant > 0 ? Math.round(((cerrados?.ordenes_cantidad || 0) / emitidosCant) * 100) : 0,
      }
    })
  }, [cerradosPorAnio, emitidosPorMes])

  const contenidoMensual = (
    <div className="space-y-4">
      {/* Header: KPIs + selector año */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Órdenes de venta = dato principal */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-insignia-exito-texto">{formatoMoneda(totalMontoOrdenesAnio)}</span>
            <span className="text-xs text-texto-terciario">en órdenes de venta</span>
          </div>
          {/* Desglose */}
          <div className="flex items-baseline gap-3 mt-1 text-xs">
            <span>
              <span className="font-semibold text-texto-secundario">{formatoMoneda(totalMontoCerradoAnio)}</span>
              <span className="text-texto-terciario ml-1">ganado total</span>
            </span>
            <span className="text-borde-fuerte">|</span>
            <span>
              <span className="font-medium text-texto-secundario">{formatoMoneda(totalMontoEmitidoAnio)}</span>
              <span className="text-texto-terciario ml-1">presupuestado</span>
            </span>
          </div>
          {/* Conversión */}
          <p className="text-xs mt-1">
            <span className={`font-bold ${conversionAnio >= 50 ? 'text-insignia-exito-texto' : conversionAnio >= 25 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'}`}>
              {conversionAnio}% de cierre
            </span>
            <span className="text-texto-terciario"> — {totalOrdenesAnio} órdenes de {totalEmitidosAnio} presupuestos</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Selector de año */}
          <div className="flex items-center gap-1">
            {aniosDisponibles.map(a => (
              <button
                key={a}
                onClick={() => setAnioSeleccionado(a)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  a === anioSeleccionado
                    ? 'bg-texto-marca text-white font-medium'
                    : 'text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          {/* Toggle presupuestados */}
          <button
            onClick={() => setMostrarEmitidos(!mostrarEmitidos)}
            className={`text-xxs px-2 py-1 rounded-md border transition-colors ${
              mostrarEmitidos
                ? 'border-texto-marca/30 bg-texto-marca/10 text-texto-marca'
                : 'border-borde-sutil text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            {mostrarEmitidos ? 'Ocultar' : 'Mostrar'} presupuestados
          </button>
        </div>
      </div>

      {/* Mes actual */}
      <div className="flex items-center justify-between bg-superficie-hover/50 rounded-lg py-2.5 px-3">
        <div className="text-xs space-x-3">
          <span>
            <span className="text-texto-terciario">{MESES_CORTOS[mesActualIdx]}: </span>
            <span className="text-insignia-exito-texto font-bold">{formatoMoneda(mesActualData?.ordenes_monto || 0)}</span>
            <span className="text-texto-terciario"> órdenes ({mesActualData?.ordenes_cantidad || 0})</span>
          </span>
          {mostrarEmitidos && (
            <span>
              <span className="text-texto-secundario font-medium">{formatoMoneda(mesActualData?.emitidos_monto || 0)}</span>
              <span className="text-texto-terciario"> presup. ({mesActualData?.emitidos_cantidad || 0})</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {difMesCerrado > 0 ? (
            <TrendingUp size={13} className="text-insignia-exito-texto" />
          ) : difMesCerrado < 0 ? (
            <TrendingDown size={13} className="text-insignia-peligro-texto" />
          ) : (
            <Minus size={13} className="text-texto-terciario" />
          )}
          <span className={difMesCerrado > 0 ? 'text-insignia-exito-texto font-medium' : difMesCerrado < 0 ? 'text-insignia-peligro-texto font-medium' : 'text-texto-terciario'}>
            {difMesCerrado > 0 ? '+' : ''}{formatoMoneda(difMesCerrado)}
          </span>
          <span className="text-texto-terciario">vs {MESES_CORTOS[mesActualIdx > 0 ? mesActualIdx - 1 : 11]}</span>
        </div>
      </div>

      {/* Gráfico: doble serie */}
      <div className="h-52 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={datosMensuales} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gradienteCerrados" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--insignia-exito-texto)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--insignia-exito-texto)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--borde-sutil)" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: 'var(--texto-terciario)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--texto-terciario)' }}
              axisLine={false}
              tickLine={false}
              width={45}
              tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
            />
            <Tooltip content={<TooltipDoble formatoMoneda={formatoMoneda} />} cursor={{ fill: 'var(--superficie-hover)', opacity: 0.3 }} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={8}
              iconType="circle"
              formatter={(value: string) => {
                if (value === 'emitidos_monto') return 'Presupuestado'
                if (value === 'ordenes_monto') return 'Órdenes de venta'
                return value
              }}
            />
            {/* Línea de presupuestados (si está activada) */}
            {mostrarEmitidos && (
              <Line
                type="monotone"
                dataKey="emitidos_monto"
                stroke="var(--texto-marca)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 3, fill: 'var(--texto-marca)', strokeWidth: 0 }}
                name="emitidos_monto"
              />
            )}
            {/* Área de órdenes de venta (confirmadas 100%) */}
            <Area
              type="monotone"
              dataKey="ordenes_monto"
              stroke="var(--insignia-exito-texto)"
              strokeWidth={2}
              fill="url(#gradienteCerrados)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--insignia-exito-texto)', strokeWidth: 0 }}
              name="ordenes_monto"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  const contenidoAnual = (
    <div className="space-y-3">
      {datosAnuales.length > 0 ? (
        <>
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 items-center text-xxs text-texto-terciario font-medium pb-1 border-b border-borde-sutil">
            <span>Año</span>
            <span />
            <span className="text-right">Presup.</span>
            <span className="text-right">Órdenes</span>
            <span className="text-right">Conv.</span>
          </div>

          {datosAnuales.map((d) => {
            const maxMonto = Math.max(...datosAnuales.map(a => Math.max(a.emitidos_monto, a.ordenes_monto)), 1)
            const pctEmitido = (d.emitidos_monto / maxMonto) * 100
            const pctOrdenes = (d.ordenes_monto / maxMonto) * 100
            const esActual = parseInt(d.anio) === new Date().getFullYear()
            return (
              <div key={d.anio} className="space-y-1.5">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 items-center text-xs">
                  <span className={`font-medium ${esActual ? 'text-texto-primario' : 'text-texto-secundario'}`}>
                    {d.anio}
                  </span>
                  <span />
                  <div className="text-right">
                    <span className="text-texto-secundario tabular-nums">{formatoMoneda(d.emitidos_monto)}</span>
                    <span className="text-xxs text-texto-terciario ml-1">({d.emitidos_cantidad})</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-bold tabular-nums ${esActual ? 'text-insignia-exito-texto' : 'text-texto-primario'}`}>
                      {formatoMoneda(d.ordenes_monto)}
                    </span>
                    <span className="text-xxs text-texto-terciario ml-1">({d.ordenes_cantidad})</span>
                  </div>
                  <span className={`text-right font-bold ${d.conversion >= 50 ? 'text-insignia-exito-texto' : d.conversion >= 25 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'}`}>
                    {d.conversion}%
                  </span>
                </div>
                {/* Barras superpuestas */}
                <div className="h-2 rounded-full bg-superficie-hover overflow-hidden relative">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-texto-marca/20 transition-all duration-700"
                    style={{ width: `${Math.max(pctEmitido, 2)}%` }}
                  />
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${esActual ? 'bg-insignia-exito-texto' : 'bg-insignia-exito-texto/50'}`}
                    style={{ width: `${Math.max(pctOrdenes, 1)}%` }}
                  />
                </div>
              </div>
            )
          })}

          {/* Crecimiento YoY */}
          {datosAnuales.length >= 2 && (() => {
            const ultimo = datosAnuales[datosAnuales.length - 1]
            const penultimo = datosAnuales[datosAnuales.length - 2]
            const crecimiento = penultimo.ordenes_monto > 0
              ? Math.round(((ultimo.ordenes_monto - penultimo.ordenes_monto) / penultimo.ordenes_monto) * 100)
              : 0
            return (
              <div className="pt-3 border-t border-borde-sutil flex items-center justify-between text-xs">
                <span className="text-texto-terciario">Crecimiento órdenes {penultimo.anio} → {ultimo.anio}</span>
                <span className={`font-bold ${crecimiento >= 0 ? 'text-insignia-exito-texto' : 'text-insignia-peligro-texto'}`}>
                  {crecimiento >= 0 ? '+' : ''}{crecimiento}%
                </span>
              </div>
            )
          })()}
        </>
      ) : (
        <p className="text-sm text-texto-terciario text-center py-4">Sin datos registrados</p>
      )}
    </div>
  )

  // ─── Pestaña Interanual: comparar mismo mes entre años ───
  const anioActual_ = new Date().getFullYear()
  const [vistaInteranual, setVistaInteranual] = useState<'cantidad' | 'monto'>('monto')

  // Años disponibles para interanual
  const aniosInteranual = useMemo(() => {
    const set = new Set<number>()
    for (const k of [...Object.keys(cerradosPorMes), ...Object.keys(emitidosPorMes)]) {
      set.add(parseInt(k.split('-')[0]))
    }
    if (set.size === 0) set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => a - b).slice(-4)
  }, [cerradosPorMes, emitidosPorMes])

  const COLORES_ANIOS = [
    'var(--texto-marca)',
    'var(--insignia-info-texto)',
    'var(--insignia-exito-texto)',
    'var(--insignia-advertencia-texto)',
  ]

  // Datos interanuales: barras agrupadas de órdenes de venta por mes × año
  // Siempre incluye todos los datos (monto + cantidad) para que el tooltip muestre todo
  const datosInteranual = useMemo(() => {
    return MESES_CORTOS.map((mes, i) => {
      const fila: Record<string, string | number> = { mes }
      for (const anio of aniosInteranual) {
        const clave = `${anio}-${String(i + 1).padStart(2, '0')}`
        // Valor principal (lo que grafican las barras)
        fila[`${anio}`] = vistaInteranual === 'monto'
          ? (cerradosPorMes[clave]?.ordenes_monto || 0)
          : (cerradosPorMes[clave]?.ordenes_cantidad || 0)
        // Datos extra para el tooltip
        fila[`${anio}_ordenes_monto`] = cerradosPorMes[clave]?.ordenes_monto || 0
        fila[`${anio}_ordenes_cant`] = cerradosPorMes[clave]?.ordenes_cantidad || 0
        fila[`${anio}_presup_monto`] = emitidosPorMes[clave]?.monto_total || 0
        fila[`${anio}_presup_cant`] = emitidosPorMes[clave]?.creados || 0
      }
      return fila
    })
  }, [cerradosPorMes, emitidosPorMes, aniosInteranual, vistaInteranual])

  // KPI interanual: este mes vs mismo mes año anterior
  const claveEsteMes = `${anioActual_}-${String(mesActualIdx + 1).padStart(2, '0')}`
  const claveEsteMesAnterior = `${anioActual_ - 1}-${String(mesActualIdx + 1).padStart(2, '0')}`
  const ordenesEsteMes = cerradosPorMes[claveEsteMes]?.ordenes_monto || 0
  const ordenesEsteMesCant = cerradosPorMes[claveEsteMes]?.ordenes_cantidad || 0
  const ordenesMismoMesAnterior = cerradosPorMes[claveEsteMesAnterior]?.ordenes_monto || 0
  const ordenesMismoMesAnteriorCant = cerradosPorMes[claveEsteMesAnterior]?.ordenes_cantidad || 0
  const difInteranual = vistaInteranual === 'monto' ? ordenesEsteMes - ordenesMismoMesAnterior : ordenesEsteMesCant - ordenesMismoMesAnteriorCant

  const contenidoInteranual = (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xxs text-texto-terciario mb-0.5">Órdenes de venta por mes — comparando años</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-insignia-exito-texto">
              {vistaInteranual === 'monto' ? formatoMoneda(ordenesEsteMes) : ordenesEsteMesCant}
            </span>
            <span className="text-xs text-texto-terciario">
              {vistaInteranual === 'monto' ? 'facturado' : (ordenesEsteMesCant === 1 ? 'orden' : 'órdenes')} en {MESES_CORTOS[mesActualIdx]} {anioActual_}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Toggle monto/cantidad */}
          <div className="flex items-center gap-1 bg-superficie-hover/50 rounded-lg p-0.5">
            <button
              onClick={() => setVistaInteranual('monto')}
              className={`px-2 py-1 text-xxs rounded-md transition-colors ${
                vistaInteranual === 'monto'
                  ? 'bg-superficie-tarjeta shadow-sm border border-borde-sutil text-texto-primario font-medium'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              Monto $
            </button>
            <button
              onClick={() => setVistaInteranual('cantidad')}
              className={`px-2 py-1 text-xxs rounded-md transition-colors ${
                vistaInteranual === 'cantidad'
                  ? 'bg-superficie-tarjeta shadow-sm border border-borde-sutil text-texto-primario font-medium'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              Cantidad
            </button>
          </div>

          {/* Diferencia vs año anterior */}
          {aniosInteranual.length >= 2 && (
            <div className="flex items-center gap-1.5 text-xs">
              {difInteranual > 0 ? (
                <TrendingUp size={13} className="text-insignia-exito-texto" />
              ) : difInteranual < 0 ? (
                <TrendingDown size={13} className="text-insignia-peligro-texto" />
              ) : (
                <Minus size={13} className="text-texto-terciario" />
              )}
              <span className={difInteranual > 0 ? 'text-insignia-exito-texto font-medium' : difInteranual < 0 ? 'text-insignia-peligro-texto font-medium' : 'text-texto-terciario'}>
                {difInteranual > 0 ? '+' : ''}
                {vistaInteranual === 'monto' ? formatoMoneda(difInteranual) : difInteranual}
              </span>
              <span className="text-texto-terciario">
                vs {MESES_CORTOS[mesActualIdx]} {anioActual_ - 1}
                {vistaInteranual === 'monto'
                  ? ` (${formatoMoneda(ordenesMismoMesAnterior)})`
                  : ` (${ordenesMismoMesAnteriorCant})`
                }
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico de barras agrupadas por año */}
      <div className="h-52 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datosInteranual} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--borde-sutil)" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: 'var(--texto-terciario)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--texto-terciario)' }}
              axisLine={false}
              tickLine={false}
              width={45}
              allowDecimals={false}
              tickFormatter={vistaInteranual === 'monto'
                ? (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                : undefined
              }
            />
            <Tooltip
              cursor={{ fill: 'var(--superficie-hover)', opacity: 0.3 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const datos = payload[0]?.payload as Record<string, number> | undefined
                if (!datos) return null

                return (
                  <div className="bg-[var(--superficie-tarjeta)] border border-borde-fuerte rounded-lg px-4 py-3 shadow-lg min-w-[240px]">
                    <p className="text-sm text-texto-primario mb-2 font-semibold">{label}</p>
                    <div className="space-y-3">
                      {aniosInteranual.map((anio, idx) => {
                        const presupCant = datos[`${anio}_presup_cant`] || 0
                        const presupMonto = datos[`${anio}_presup_monto`] || 0
                        const ordenesCant = datos[`${anio}_ordenes_cant`] || 0
                        const ordenesMonto = datos[`${anio}_ordenes_monto`] || 0
                        const conversion = presupCant > 0 ? Math.round((ordenesCant / presupCant) * 100) : 0

                        return (
                          <div key={anio} className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <div className="size-2.5 rounded-full" style={{ backgroundColor: COLORES_ANIOS[idx % COLORES_ANIOS.length] }} />
                              <span className="text-xs text-texto-primario font-semibold">{anio}</span>
                            </div>
                            <div className="ml-4 space-y-0.5 text-xs">
                              <div className="flex justify-between gap-4">
                                <span className="text-texto-terciario">Presupuestados</span>
                                <span className="text-texto-secundario tabular-nums">{presupCant} — {formatoMoneda(presupMonto)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-texto-terciario">Órdenes de venta</span>
                                <span className="text-insignia-exito-texto font-bold tabular-nums">{ordenesCant} — {formatoMoneda(ordenesMonto)}</span>
                              </div>
                              {presupCant > 0 && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-texto-terciario">Tasa de cierre</span>
                                  <span className={`font-medium ${conversion >= 50 ? 'text-insignia-exito-texto' : conversion >= 25 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'}`}>
                                    {conversion}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={8}
              iconType="circle"
            />
            {aniosInteranual.map((anio, i) => (
              <Bar
                key={anio}
                dataKey={String(anio)}
                fill={COLORES_ANIOS[i % COLORES_ANIOS.length]}
                radius={[2, 2, 0, 0]}
                opacity={i === aniosInteranual.length - 1 ? 1 : 0.4}
                name={String(anio)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen por año */}
      {aniosInteranual.length > 1 && (
        <div className="pt-2 border-t border-borde-sutil">
          <p className="text-xxs text-texto-terciario mb-2">Total órdenes de venta por año</p>
          <div className="grid grid-cols-2 gap-2">
            {[...aniosInteranual].reverse().map((anio) => {
              let totalOrdenes = 0
              let totalCantidad = 0
              for (let m = 1; m <= 12; m++) {
                const clave = `${anio}-${String(m).padStart(2, '0')}`
                totalOrdenes += cerradosPorMes[clave]?.ordenes_monto || 0
                totalCantidad += cerradosPorMes[clave]?.ordenes_cantidad || 0
              }
              return (
                <div key={anio} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md bg-superficie-hover/50">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full" style={{ backgroundColor: COLORES_ANIOS[aniosInteranual.indexOf(anio) % COLORES_ANIOS.length] }} />
                    <span className="text-texto-secundario">{anio}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-texto-primario font-bold tabular-nums">
                      {vistaInteranual === 'monto' ? formatoMoneda(totalOrdenes) : totalCantidad}
                    </span>
                    {vistaInteranual === 'monto' && (
                      <span className="text-xxs text-texto-terciario ml-1">({totalCantidad})</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <TarjetaConPestanas
      titulo="Presupuestos vs Órdenes de venta"
      subtitulo="Lo que cotizaste vs lo que se confirmó 100%"
      pestanas={[
        { etiqueta: 'Mensual', contenido: contenidoMensual },
        { etiqueta: 'Anual', contenido: contenidoAnual },
        { etiqueta: 'Interanual', contenido: contenidoInteranual },
      ]}
    />
  )
}

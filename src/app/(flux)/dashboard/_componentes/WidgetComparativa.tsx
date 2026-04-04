'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'
import { TrendingUp, TrendingDown, Equal } from 'lucide-react'

/**
 * WidgetComparativa — Comparativa interanual mes a mes.
 * Pestaña 1 "Presupuestos emitidos": cuántos presupuestos se crearon cada mes, comparando años
 * Pestaña 2 "Contactos nuevos": cuántos contactos se agregaron cada mes, comparando años
 */

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const COLORES_ANIOS = [
  'var(--texto-marca)',
  'var(--insignia-info-texto)',
  'var(--insignia-exito-texto)',
  'var(--insignia-advertencia-texto)',
]

interface Props {
  presupuestosPorMes: Record<string, { creados: number; monto_total: number }>
  contactosPorMes: Record<string, number>
  formatoMoneda: (n: number) => string
}

// Descripción clara de qué mide cada pestaña
const META_TIPO = {
  presupuestos: {
    etiqueta: 'Presupuestos emitidos',
    descripcion: 'Cantidad de presupuestos creados por mes',
    unidad: 'presupuestos emitidos',
    unidadSingular: 'presupuesto emitido',
  },
  contactos: {
    etiqueta: 'Contactos nuevos',
    descripcion: 'Cantidad de contactos agregados por mes',
    unidad: 'contactos agregados',
    unidadSingular: 'contacto agregado',
  },
}

function TooltipComparativa({ active, payload, label, unidad }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  unidad: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + p.value, 0)
  return (
    <div className="bg-[var(--superficie-tarjeta)] border border-borde-fuerte rounded-lg px-3 py-2.5 shadow-md min-w-[160px]">
      <p className="text-xs text-texto-terciario mb-1.5 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-3 text-xs py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-texto-secundario">{p.name}</span>
          </div>
          <span className="text-texto-primario font-bold tabular-nums">{p.value}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="pt-1 mt-1 border-t border-borde-sutil text-xxs text-texto-terciario">
          {unidad}
        </div>
      )}
    </div>
  )
}

export function WidgetComparativa({ presupuestosPorMes, contactosPorMes, formatoMoneda }: Props) {
  const anios = useMemo(() => {
    const set = new Set<number>()
    for (const clave of [...Object.keys(presupuestosPorMes), ...Object.keys(contactosPorMes)]) {
      set.add(parseInt(clave.split('-')[0]))
    }
    if (set.size === 0) set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => a - b).slice(-4)
  }, [presupuestosPorMes, contactosPorMes])

  const datosPresupuestos = useMemo(() => {
    return MESES_CORTOS.map((mes, i) => {
      const fila: Record<string, string | number> = { mes }
      for (const anio of anios) {
        const clave = `${anio}-${String(i + 1).padStart(2, '0')}`
        fila[String(anio)] = presupuestosPorMes[clave]?.creados || 0
      }
      return fila
    })
  }, [presupuestosPorMes, anios])

  const datosContactos = useMemo(() => {
    return MESES_CORTOS.map((mes, i) => {
      const fila: Record<string, string | number> = { mes }
      for (const anio of anios) {
        const clave = `${anio}-${String(i + 1).padStart(2, '0')}`
        fila[String(anio)] = contactosPorMes[clave] || 0
      }
      return fila
    })
  }, [contactosPorMes, anios])

  const mesActualIdx = new Date().getMonth()
  const anioActual = new Date().getFullYear()
  const mesActualStr = String(mesActualIdx + 1).padStart(2, '0')

  const renderComparativa = (
    datos: Array<Record<string, string | number>>,
    tipo: 'presupuestos' | 'contactos',
  ) => {
    const meta = META_TIPO[tipo]

    const valorActual = tipo === 'presupuestos'
      ? (presupuestosPorMes[`${anioActual}-${mesActualStr}`]?.creados || 0)
      : (contactosPorMes[`${anioActual}-${mesActualStr}`] || 0)
    const valorAnterior = anios.length >= 2
      ? tipo === 'presupuestos'
        ? (presupuestosPorMes[`${anioActual - 1}-${mesActualStr}`]?.creados || 0)
        : (contactosPorMes[`${anioActual - 1}-${mesActualStr}`] || 0)
      : 0
    const diferencia = valorActual - valorAnterior
    const pctCambio = valorAnterior > 0 ? Math.round((diferencia / valorAnterior) * 100) : 0

    return (
      <div className="space-y-4">
        {/* Descripción + KPI */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xxs text-texto-terciario mb-0.5">{meta.descripcion}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-texto-primario">{valorActual}</span>
              <span className="text-xs text-texto-terciario">
                {valorActual === 1 ? meta.unidadSingular : meta.unidad} en {MESES_CORTOS[mesActualIdx]} {anioActual}
              </span>
            </div>
          </div>
          {anios.length >= 2 && (
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1.5 justify-end">
                {diferencia > 0 ? (
                  <TrendingUp size={14} className="text-insignia-exito-texto" />
                ) : diferencia < 0 ? (
                  <TrendingDown size={14} className="text-insignia-peligro-texto" />
                ) : (
                  <Equal size={14} className="text-texto-terciario" />
                )}
                <span className={`text-sm font-bold ${diferencia > 0 ? 'text-insignia-exito-texto' : diferencia < 0 ? 'text-insignia-peligro-texto' : 'text-texto-terciario'}`}>
                  {diferencia > 0 ? '+' : ''}{diferencia} ({pctCambio > 0 ? '+' : ''}{pctCambio}%)
                </span>
              </div>
              <span className="text-xxs text-texto-terciario">
                vs {MESES_CORTOS[mesActualIdx]} {anioActual - 1} ({valorAnterior})
              </span>
            </div>
          )}
        </div>

        {/* Gráfico */}
        <div className="h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
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
                width={30}
                allowDecimals={false}
              />
              <Tooltip content={<TooltipComparativa unidad={meta.unidad} />} cursor={{ fill: 'var(--superficie-hover)', opacity: 0.3 }} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconSize={8}
                iconType="circle"
              />
              {anios.map((anio, i) => (
                <Bar
                  key={anio}
                  dataKey={String(anio)}
                  fill={COLORES_ANIOS[i % COLORES_ANIOS.length]}
                  radius={[2, 2, 0, 0]}
                  opacity={i === anios.length - 1 ? 1 : 0.4}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Resumen por año */}
        {anios.length > 1 && (
          <div className="pt-2 border-t border-borde-sutil">
            <p className="text-xxs text-texto-terciario mb-2">Total {meta.unidad} por año</p>
            <div className="grid grid-cols-2 gap-2">
              {anios.slice(-4).reverse().map((anio) => {
                const totalAnio = tipo === 'presupuestos'
                  ? Object.entries(presupuestosPorMes)
                      .filter(([k]) => k.startsWith(`${anio}-`))
                      .reduce((s, [, v]) => s + v.creados, 0)
                  : Object.entries(contactosPorMes)
                      .filter(([k]) => k.startsWith(`${anio}-`))
                      .reduce((s, [, v]) => s + v, 0)
                return (
                  <div key={anio} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md bg-superficie-hover/50">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full" style={{ backgroundColor: COLORES_ANIOS[(anios.indexOf(anio)) % COLORES_ANIOS.length] }} />
                      <span className="text-texto-secundario">{anio}</span>
                    </div>
                    <span className="text-texto-primario font-bold tabular-nums">{totalAnio}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <TarjetaConPestanas
      titulo="Comparativa interanual"
      subtitulo="Mismo mes, distintos años — ¿estás mejor o peor que antes?"
      pestanas={[
        { etiqueta: META_TIPO.presupuestos.etiqueta, contenido: renderComparativa(datosPresupuestos, 'presupuestos') },
        { etiqueta: META_TIPO.contactos.etiqueta, contenido: renderComparativa(datosContactos, 'contactos') },
      ]}
    />
  )
}

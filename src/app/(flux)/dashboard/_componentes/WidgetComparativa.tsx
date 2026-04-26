'use client'

/**
 * WidgetComparativa — Comparativa interanual mes a mes (Year-over-Year).
 *
 * Convención estándar de CRM/analytics:
 *  - Hero con KPI del período actual + delta YoY (vs mismo mes año anterior)
 *  - Card secundaria con total acumulado YTD vs YTD del año anterior
 *  - Gráfico de barras agrupadas por año
 *  - Tabs de tipo: Presupuestos emitidos / Contactos nuevos
 */

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'
import { MESES_CORTOS } from './compartidos'

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

type Tipo = 'presupuestos' | 'contactos'

const META_TIPO: Record<Tipo, { etiqueta: string; descripcion: string; unidad: string; unidadSingular: string }> = {
  presupuestos: {
    etiqueta: 'Presupuestos',
    descripcion: 'Cantidad de presupuestos creados',
    unidad: 'presupuestos',
    unidadSingular: 'presupuesto',
  },
  contactos: {
    etiqueta: 'Contactos',
    descripcion: 'Cantidad de contactos agregados',
    unidad: 'contactos',
    unidadSingular: 'contacto',
  },
}

function TooltipComparativa({ active, payload, label, unidad }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  unidad: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--superficie-tarjeta)] border border-borde-fuerte rounded-card px-3 py-2.5 shadow-md min-w-[160px]">
      <p className="text-xs text-texto-terciario mb-1.5 font-medium">{label}</p>
      {payload.map((p) => (
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

export function WidgetComparativa({ presupuestosPorMes, contactosPorMes }: Props) {
  const [tipo, setTipo] = useState<Tipo>('presupuestos')

  // Años con datos (últimos 4)
  const anios = useMemo(() => {
    const set = new Set<number>()
    for (const clave of [...Object.keys(presupuestosPorMes), ...Object.keys(contactosPorMes)]) {
      set.add(parseInt(clave.split('-')[0]))
    }
    if (set.size === 0) set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => a - b).slice(-4)
  }, [presupuestosPorMes, contactosPorMes])

  // Datos para el gráfico de barras agrupadas
  const datos = useMemo(() => {
    return MESES_CORTOS.map((mes, i) => {
      const fila: Record<string, string | number> = { mes }
      for (const anio of anios) {
        const clave = `${anio}-${String(i + 1).padStart(2, '0')}`
        fila[String(anio)] = tipo === 'presupuestos'
          ? (presupuestosPorMes[clave]?.creados || 0)
          : (contactosPorMes[clave] || 0)
      }
      return fila
    })
  }, [presupuestosPorMes, contactosPorMes, anios, tipo])

  // Mes y año actual
  const hoy = new Date()
  const mesActualIdx = hoy.getMonth()
  const anioActual = hoy.getFullYear()
  const mesActualStr = String(mesActualIdx + 1).padStart(2, '0')

  const claveActual = `${anioActual}-${mesActualStr}`
  const claveAnterior = `${anioActual - 1}-${mesActualStr}`

  // KPI del mes actual + comparativa YoY
  const valorMesActual = tipo === 'presupuestos'
    ? (presupuestosPorMes[claveActual]?.creados || 0)
    : (contactosPorMes[claveActual] || 0)
  const valorMismoMesAnterior = tipo === 'presupuestos'
    ? (presupuestosPorMes[claveAnterior]?.creados || 0)
    : (contactosPorMes[claveAnterior] || 0)
  const deltaMes = valorMesActual - valorMismoMesAnterior
  const pctMes = valorMismoMesAnterior > 0 ? Math.round((deltaMes / valorMismoMesAnterior) * 100) : 0

  // YTD (Year-To-Date): acumulado desde enero hasta el mes actual, ambos años
  const calcularYTD = (anio: number) => {
    let total = 0
    for (let m = 1; m <= mesActualIdx + 1; m++) {
      const clave = `${anio}-${String(m).padStart(2, '0')}`
      total += tipo === 'presupuestos'
        ? (presupuestosPorMes[clave]?.creados || 0)
        : (contactosPorMes[clave] || 0)
    }
    return total
  }
  const ytdActual = calcularYTD(anioActual)
  const ytdAnterior = calcularYTD(anioActual - 1)
  const deltaYtd = ytdActual - ytdAnterior
  const pctYtd = ytdAnterior > 0 ? Math.round((deltaYtd / ytdAnterior) * 100) : 0

  const meta = META_TIPO[tipo]

  // Total acumulado por año (para pie inferior con resumen anual)
  const totalPorAnio = useMemo(() => {
    return anios.map((anio) => {
      let total = 0
      for (let m = 1; m <= 12; m++) {
        const clave = `${anio}-${String(m).padStart(2, '0')}`
        total += tipo === 'presupuestos'
          ? (presupuestosPorMes[clave]?.creados || 0)
          : (contactosPorMes[clave] || 0)
      }
      return { anio, total }
    })
  }, [anios, tipo, presupuestosPorMes, contactosPorMes])

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
      {/* ─── Header con tabs de tipo ─── */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-borde-sutil">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-sm font-semibold text-texto-primario truncate">Comparativa interanual</h3>
          <InfoBoton
            titulo="Comparativa interanual"
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Te permite responder una pregunta clave:{' '}
                    <strong className="text-texto-primario">¿estás creciendo respecto al año anterior?</strong>{' '}
                    Compara mes contra mes y año contra año la cantidad de presupuestos que generás y los
                    contactos nuevos que sumás.
                  </p>
                ),
              },
              {
                titulo: 'Qué es YoY y YTD',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-texto-primario">YoY (Year over Year):</strong> compara el mes
                      actual con el mismo mes del año pasado. Ej: abril 2026 vs abril 2025.
                    </li>
                    <li>
                      <strong className="text-texto-primario">YTD (Year to Date):</strong> el acumulado del
                      año hasta hoy. Ej: enero a abril 2026 vs enero a abril 2025.
                    </li>
                    <li className="text-texto-terciario pt-1">
                      YoY te muestra si el mes puntual mejoró. YTD te muestra si el año entero va mejor.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Cómo leerlo',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <span className="text-insignia-exito-texto">●</span>{' '}
                      <strong className="text-texto-primario">Pildora verde:</strong> estás generando más
                      que el año pasado.
                    </li>
                    <li>
                      <span className="text-insignia-peligro-texto">●</span>{' '}
                      <strong className="text-texto-primario">Pildora roja:</strong> estás generando menos.
                      Revisá qué pasó con campañas, equipo, mercado.
                    </li>
                    <li className="text-texto-terciario pt-1">
                      Las barras del gráfico están agrupadas por mes y coloreadas por año —el más opaco
                      es el año actual.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Diferencia clave',
                contenido: (
                  <p>
                    <strong className="text-texto-primario">Presupuestos creados ≠ ventas.</strong> Este
                    widget mide <strong>actividad comercial</strong> (cuántos cotizaste). Para saber
                    cuántos se concretaron, mirá el <strong className="text-texto-marca">Pipeline</strong>.
                  </p>
                ),
              },
              {
                titulo: 'Cruzá con otros widgets',
                contenido: (
                  <ul className="space-y-2 list-none">
                    <li>
                      <strong className="text-texto-primario">Con &quot;Pipeline&quot;:</strong>{' '}
                      <span className="text-texto-terciario">si generás muchos presupuestos pero el win
                      rate es bajo, estás haciendo trabajo en vano. Si crece la actividad y el win rate
                      se mantiene, vas a vender más.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Clientes&quot;:</strong>{' '}
                      <span className="text-texto-terciario">la pestaña &quot;Contactos&quot; de acá son
                      contactos nuevos. Cruzalo con la composición de cartera para ver de qué tipo son.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Cobros&quot;:</strong>{' '}
                      <span className="text-texto-terciario">si la actividad sube pero los cobros no
                      acompañan, hay un problema en la conversión a venta o en la cobranza.</span>
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
            onClick={() => setTipo('presupuestos')}
            className={`px-2.5 py-1 rounded-full text-xxs font-medium transition-colors ${
              tipo === 'presupuestos'
                ? 'bg-texto-marca/[0.1] text-texto-marca'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            Presupuestos
          </button>
          <button
            type="button"
            onClick={() => setTipo('contactos')}
            className={`px-2.5 py-1 rounded-full text-xxs font-medium transition-colors ${
              tipo === 'contactos'
                ? 'bg-texto-marca/[0.1] text-texto-marca'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            Contactos
          </button>
        </div>
      </div>

      {/* ─── Hero: KPI del mes + comparativa YoY + YTD ─── */}
      <div className="px-4 sm:px-5 py-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 sm:gap-5 items-start">
        <div>
          <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
            {meta.etiqueta} en {MESES_CORTOS[mesActualIdx]} {anioActual}
          </p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-light tabular-nums text-texto-primario leading-none">
            {valorMesActual}
          </p>

          {/* Pill: YoY (mismo mes año anterior) */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {anios.length >= 2 && valorMismoMesAnterior > 0 && (() => {
              const subio = deltaMes > 0
              const igual = deltaMes === 0
              const colores = igual
                ? 'border-borde-sutil text-texto-terciario'
                : subio
                  ? 'border-insignia-exito/30 text-insignia-exito-texto bg-insignia-exito/[0.04]'
                  : 'border-insignia-peligro/30 text-insignia-peligro-texto bg-insignia-peligro/[0.04]'
              const Icono = igual ? Minus : subio ? TrendingUp : TrendingDown
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xxs ${colores}`}
                  title={`Comparado con ${MESES_CORTOS[mesActualIdx]} ${anioActual - 1} (${valorMismoMesAnterior})`}
                >
                  <Icono className="size-3" />
                  <span className="font-medium tabular-nums">
                    {deltaMes > 0 ? '+' : ''}{deltaMes} ({pctMes > 0 ? '+' : ''}{pctMes}%)
                  </span>
                  <span className="opacity-80">vs {MESES_CORTOS[mesActualIdx]} {anioActual - 1}</span>
                </span>
              )
            })()}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-borde-sutil text-xxs">
              <span className="text-texto-terciario">{meta.descripcion}</span>
            </span>
          </div>
        </div>

        {/* Card YTD (acumulado del año hasta hoy) */}
        {anios.length >= 2 && ytdAnterior > 0 && (() => {
          const subio = deltaYtd > 0
          const igual = deltaYtd === 0
          const colorTexto = igual
            ? 'text-texto-terciario'
            : subio
              ? 'text-insignia-exito-texto'
              : 'text-insignia-peligro-texto'
          const colorBorde = igual
            ? 'border-borde-sutil'
            : subio
              ? 'border-insignia-exito/25'
              : 'border-insignia-peligro/25'
          const Icono = igual ? Minus : subio ? TrendingUp : TrendingDown
          return (
            <div className={`rounded-lg border ${colorBorde} bg-superficie-app/40 px-4 py-3 min-w-[200px]`}>
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
                Acumulado año (YTD)
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-light tabular-nums text-texto-primario leading-none">
                  {ytdActual}
                </span>
                <span className="text-xs text-texto-terciario">en {anioActual}</span>
              </div>
              <div className="mt-3 pt-2 border-t border-borde-sutil/50 flex items-center justify-between gap-2 text-xxs">
                <span className="text-texto-terciario">vs {anioActual - 1}</span>
                <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${colorTexto}`}>
                  <Icono className="size-3" />
                  {deltaYtd > 0 ? '+' : ''}{deltaYtd} ({pctYtd > 0 ? '+' : ''}{pctYtd}%)
                </span>
              </div>
              <p className="text-xxs text-texto-terciario mt-0.5 tabular-nums">
                {ytdAnterior} en mismo período
              </p>
            </div>
          )
        })()}
      </div>

      {/* ─── Gráfico de barras agrupadas por año ─── */}
      <div className="px-4 sm:px-5 pb-3">
        <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-2">
          Mes a mes
        </p>
        <div className="h-48 -mx-2">
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
                  opacity={i === anios.length - 1 ? 1 : 0.45}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Resumen anual (cards al fondo) ─── */}
      {anios.length > 1 && (
        <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-borde-sutil/60">
          <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-2">
            Total {meta.unidad} por año
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[...totalPorAnio].reverse().map(({ anio, total }) => {
              const esActual = anio === anioActual
              return (
                <div
                  key={anio}
                  className={`rounded-lg border px-3 py-2 ${
                    esActual
                      ? 'border-texto-marca/25 bg-texto-marca/[0.03]'
                      : 'border-borde-sutil bg-superficie-app/40'
                  }`}
                >
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORES_ANIOS[anios.indexOf(anio) % COLORES_ANIOS.length] }}
                    />
                    <span className={`text-xxs uppercase tracking-wider ${esActual ? 'text-texto-marca' : 'text-texto-terciario'}`}>
                      {anio}
                    </span>
                  </div>
                  <p className={`text-base font-semibold tabular-nums ${esActual ? 'text-texto-primario' : 'text-texto-secundario'}`}>
                    {total}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

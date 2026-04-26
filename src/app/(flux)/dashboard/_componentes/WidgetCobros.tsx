'use client'

/**
 * WidgetCobros — Vista anual de cobros (complementa al WidgetDetalleCobrosMes
 * que muestra el detalle mensual).
 *
 * Mostrado: total cobrado en el año, comparativa contra el año anterior al
 * mismo punto del calendario, gráfico de barras mensuales (cobrado vs
 * devengado) y top 3 meses del año.
 */

import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'
import { MESES_CORTOS, fmtFijo, MontoConCentavos } from './compartidos'

interface DetalleCobro {
  pago_id: string | null
  presupuesto_id: string
  presupuesto_saldo: number
  presupuesto_fecha_aceptacion: string | null
  fecha_pago: string
  monto: number
}

interface Props {
  /** Pagos reales agrupados por mes (clave YYYY-MM) */
  cobradoPorMes: Record<string, { cantidad: number; monto: number }>
  /** No usado, mantenido por compatibilidad */
  proyeccionPorMes?: Record<string, { cantidad: number; monto: number }>
  /** Presupuestos aceptados por mes (devengado) */
  devengadoPorMes?: Record<string, { cantidad: number; monto: number }>
  /** Detalle de cobros con info por presupuesto (para métricas anuales) */
  detalle?: DetalleCobro[]
  formatoMoneda: (n: number) => string
}

function TooltipPersonalizado({
  active, payload, label, formatoMoneda,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; payload: Record<string, number> }>
  label?: string
  formatoMoneda: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  const datos = payload[0]?.payload
  if (!datos) return null
  const cobrado = datos.cobrado || 0
  const vendido = datos.vendido || 0
  const tasa = vendido > 0 ? (cobrado / vendido) * 100 : 0
  return (
    <div className="bg-[var(--superficie-tarjeta)] border border-borde-fuerte rounded-card px-3 py-2.5 shadow-md min-w-[260px]">
      <p className="text-xs text-texto-terciario mb-2 font-medium">{label}</p>
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ backgroundColor: 'var(--insignia-exito-texto)' }} />
              <span className="text-xs text-texto-primario font-medium">Cobrado</span>
            </div>
            <span className="text-xs font-bold text-insignia-exito-texto tabular-nums">
              {fmtFijo(formatoMoneda, cobrado)}
            </span>
          </div>
          <p className="text-xxs text-texto-terciario ml-3.5 mt-0.5">plata que entró ese mes</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ backgroundColor: 'var(--texto-marca)' }} />
              <span className="text-xs text-texto-primario font-medium">Vendido</span>
            </div>
            <span className="text-xs text-texto-secundario tabular-nums">
              {fmtFijo(formatoMoneda, vendido)}
            </span>
          </div>
          <p className="text-xxs text-texto-terciario ml-3.5 mt-0.5">presupuestos aceptados ese mes</p>
        </div>
        {vendido > 0 && (
          <div className="pt-1.5 border-t border-borde-sutil/60 flex items-center justify-between gap-4">
            <span className="text-xxs text-texto-terciario">Tasa de cobro</span>
            <span className={`text-xs font-bold tabular-nums ${
              tasa >= 80 ? 'text-insignia-exito-texto' : tasa >= 50 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'
            }`}>
              {tasa.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function WidgetCobros({ cobradoPorMes, devengadoPorMes = {}, detalle = [], formatoMoneda }: Props) {
  // Años con actividad
  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>()
    for (const k of Object.keys(cobradoPorMes)) set.add(parseInt(k.split('-')[0]))
    for (const k of Object.keys(devengadoPorMes)) set.add(parseInt(k.split('-')[0]))
    if (set.size === 0) set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [cobradoPorMes, devengadoPorMes])

  const [anioSel, setAnioSel] = useState(aniosDisponibles[0] || new Date().getFullYear())
  const anioPrev = anioSel - 1

  // Mes actual real (para comparativa "al mismo punto del año")
  const hoy = new Date()
  const mesActualReal = hoy.getMonth() + 1 // 1-12

  // Datos del gráfico mensual
  const datosGrafico = useMemo(() => {
    return MESES_CORTOS.map((nombre, i) => {
      const clave = `${anioSel}-${String(i + 1).padStart(2, '0')}`
      const c = cobradoPorMes[clave]?.monto || 0
      const v = devengadoPorMes[clave]?.monto || 0
      return { nombre, cobrado: c, vendido: v }
    })
  }, [anioSel, cobradoPorMes, devengadoPorMes])

  // Totales del año seleccionado
  const totales = useMemo(() => {
    let cobrado = 0
    let vendido = 0
    let cobrosCount = 0
    for (const [k, v] of Object.entries(cobradoPorMes)) {
      if (k.startsWith(`${anioSel}-`)) {
        cobrado += v.monto
        cobrosCount += v.cantidad
      }
    }
    for (const [k, v] of Object.entries(devengadoPorMes)) {
      if (k.startsWith(`${anioSel}-`)) vendido += v.monto
    }
    return { cobrado, vendido, cobrosCount }
  }, [anioSel, cobradoPorMes, devengadoPorMes])

  // Métricas anuales calculadas desde el detalle
  const metricasAnuales = useMemo(() => {
    const presupuestosCobrados = new Set<string>()
    const presupuestosVendidos = new Set<string>()
    const presupuestosCerradosEnAnio = new Set<string>()
    // Mapa: presupuesto → última fecha de cobro (para detectar cerrados en el año)
    const ultimoCobro = new Map<string, string>()

    for (const d of detalle) {
      if (d.monto < 0.01) continue
      const claveAnio = d.fecha_pago.slice(0, 4)
      if (claveAnio === String(anioSel)) {
        presupuestosCobrados.add(d.presupuesto_id)
        const prev = ultimoCobro.get(d.presupuesto_id) || ''
        if (d.fecha_pago > prev) ultimoCobro.set(d.presupuesto_id, d.fecha_pago)
      }
      const claveAceptacion = d.presupuesto_fecha_aceptacion?.slice(0, 4)
      if (claveAceptacion === String(anioSel)) {
        presupuestosVendidos.add(d.presupuesto_id)
      }
    }

    // "Cerrados en el año" = presupuestos cuyo saldo es 0 Y su último cobro
    // está en el año seleccionado
    for (const d of detalle) {
      if (d.presupuesto_saldo > 0.01) continue
      const ultima = ultimoCobro.get(d.presupuesto_id)
      if (ultima && ultima.slice(0, 4) === String(anioSel)) {
        presupuestosCerradosEnAnio.add(d.presupuesto_id)
      }
    }

    return {
      cantPresupuestosCobrados: presupuestosCobrados.size,
      cantVendidos: presupuestosVendidos.size,
      cantCerrados: presupuestosCerradosEnAnio.size,
    }
  }, [detalle, anioSel])

  // Comparativa contra el año anterior.
  //   - Si estoy mirando el año actual: compara hasta el mismo mes del año anterior
  //     (ej: ene-abr 2026 vs ene-abr 2025). Etiqueta: "vs ene-abr 2025"
  //   - Si estoy mirando un año pasado: compara año completo vs año completo.
  //     Etiqueta: "vs 2024"
  const comparativa = useMemo(() => {
    const esAnioActual = anioSel === hoy.getFullYear()
    const mesLimite = esAnioActual ? mesActualReal : 12

    let cobradoPrev = 0
    for (let m = 1; m <= mesLimite; m++) {
      const clave = `${anioPrev}-${String(m).padStart(2, '0')}`
      cobradoPrev += cobradoPorMes[clave]?.monto || 0
    }
    if (cobradoPrev < 0.01) return null
    const delta = totales.cobrado - cobradoPrev
    const pct = (delta / cobradoPrev) * 100

    // Etiqueta legible del rango comparado
    const etiquetaCorta = esAnioActual
      ? mesActualReal === 1
        ? `vs ene ${anioPrev}`
        : `vs ${MESES_CORTOS[0].toLowerCase()}-${MESES_CORTOS[mesActualReal - 1].toLowerCase()} ${anioPrev}`
      : `vs ${anioPrev}`
    const etiquetaLarga = esAnioActual
      ? `Comparado con ene a ${MESES_CORTOS[mesActualReal - 1].toLowerCase()} de ${anioPrev} ($${cobradoPrev.toLocaleString('es-AR', { maximumFractionDigits: 0 })})`
      : `Comparado con todo el año ${anioPrev} ($${cobradoPrev.toLocaleString('es-AR', { maximumFractionDigits: 0 })})`

    return { delta, pct, cobradoPrev, etiquetaCorta, etiquetaLarga }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anioSel, anioPrev, totales.cobrado, mesActualReal, cobradoPorMes])

  // Tasa de cobro: cobrado / devengado
  const tasaCobro = totales.vendido > 0
    ? (totales.cobrado / totales.vendido) * 100
    : 0

  // Top 3 meses del año seleccionado y del anterior (para referencia)
  const topMesesAnio = (anio: number) =>
    MESES_CORTOS.map((nombre, i) => ({
      nombre,
      mes: i + 1,
      monto: cobradoPorMes[`${anio}-${String(i + 1).padStart(2, '0')}`]?.monto || 0,
    }))
      .filter((m) => m.monto > 0.01)
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 3)

  const topMeses = useMemo(() => topMesesAnio(anioSel), [anioSel, cobradoPorMes])
  const topMesesPrev = useMemo(() => topMesesAnio(anioPrev), [anioPrev, cobradoPorMes])

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
      {/* Header con selector de año */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-borde-sutil">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-sm font-semibold text-texto-primario truncate">Cobros del año</h3>
          <InfoBoton
            titulo="Cobros del año"
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Te muestra <strong className="text-texto-primario">la plata real que entró a tu
                    negocio</strong> en el año. Vender no es lo mismo que cobrar: acá ves cuánta de la
                    plata que vendiste efectivamente terminó en tu cuenta.
                  </p>
                ),
              },
              {
                titulo: 'Cobrado vs Vendido — la diferencia',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-insignia-exito-texto">Cobrado:</strong> la plata que ya
                      entró. Pagos que tus clientes te hicieron.
                    </li>
                    <li>
                      <strong className="text-texto-marca">Vendido:</strong> presupuestos que el cliente
                      aceptó, pero todavía pueden estar a medio cobrar (en cuotas, con saldo pendiente, etc.).
                    </li>
                    <li className="text-texto-terciario pt-1">
                      Ejemplo: vendés un trabajo de $100K con un anticipo de $30K. Vendido = $100K, pero
                      Cobrado solo $30K hasta que pagan el resto.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Qué es la tasa de cobro',
                contenido: (
                  <p>
                    Es <strong className="text-texto-primario">qué porcentaje de lo que vendiste ya
                    cobraste</strong>. Si vendés $100 y cobrás $80, tu tasa es 80%. Te dice qué tan rápido
                    se transforman tus ventas en plata real.
                  </p>
                ),
              },
              {
                titulo: 'Cómo interpretarla',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <span className="text-insignia-exito-texto">●</span>{' '}
                      <strong className="text-texto-primario">Sobre 80%:</strong> cobranza saludable, las
                      ventas se hacen plata rápido.
                    </li>
                    <li>
                      <span className="text-insignia-advertencia-texto">●</span>{' '}
                      <strong className="text-texto-primario">Entre 50% y 80%:</strong> hay saldos
                      acumulados. Está bien si trabajás con cuotas largas; mal si son ventas que tenían
                      que estar cobradas.
                    </li>
                    <li>
                      <span className="text-insignia-peligro-texto">●</span>{' '}
                      <strong className="text-texto-primario">Menos de 50%:</strong> demasiada plata
                      pendiente. Revisá tu cobranza y políticas de pago.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Sobre el gráfico',
                contenido: (
                  <p>
                    Las <strong className="text-insignia-exito-texto">barras verdes</strong> son lo que
                    cobraste cada mes. La <strong className="text-texto-marca">línea violeta</strong> es
                    lo que vendiste. Cuando la línea sube y las barras no la siguen, es plata que vendiste
                    pero todavía no cobraste.
                  </p>
                ),
              },
              {
                titulo: 'Cruzá esta info con otros widgets',
                contenido: (
                  <ul className="space-y-2 list-none">
                    <li>
                      <strong className="text-texto-primario">Con &quot;Pipeline de presupuestos&quot;:</strong>{' '}
                      <span className="text-texto-terciario">si tenés mucho pipeline activo, es plata que
                      todavía no contás acá. Pipeline × win rate × tasa cobro = proyección de ingresos
                      futuros.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Detalle de cobros&quot;:</strong>{' '}
                      <span className="text-texto-terciario">éste es el agregado del año. Para ver
                      cobranza día a día y qué clientes pagaron, ese es el widget.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Clientes&quot;:</strong>{' '}
                      <span className="text-texto-terciario">cruzá la cobranza con el tipo de cliente: si
                      tu segmento top tarda mucho en pagar, ajustá políticas con esos clientes.</span>
                    </li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
        <div className="flex items-center gap-1">
          {aniosDisponibles.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAnioSel(a)}
              className={`px-2.5 py-1 rounded-full text-xxs font-medium transition-colors ${
                a === anioSel
                  ? 'bg-texto-marca/[0.1] text-texto-marca'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Hero: total + comparativa + tasa de cobro */}
      <div className="px-4 sm:px-5 py-5 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 sm:gap-5 items-start">
        <div>
          <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
            Total cobrado en {anioSel}
          </p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-light tabular-nums text-texto-primario leading-none">
            <MontoConCentavos valor={totales.cobrado} formatoMoneda={formatoMoneda} />
          </p>
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {comparativa && (() => {
              const subio = comparativa.delta > 0
              const igual = Math.abs(comparativa.delta) < 0.01
              const colores = igual
                ? 'border-borde-sutil text-texto-terciario'
                : subio
                  ? 'border-insignia-exito/30 text-insignia-exito-texto bg-insignia-exito/[0.04]'
                  : 'border-insignia-peligro/30 text-insignia-peligro-texto bg-insignia-peligro/[0.04]'
              const Icono = igual ? Minus : subio ? TrendingUp : TrendingDown
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xxs ${colores}`}
                  title={comparativa.etiquetaLarga}
                >
                  <Icono className="size-3" />
                  <span className="font-medium tabular-nums">
                    {Math.abs(comparativa.pct).toFixed(0)}%
                  </span>
                  <span className="opacity-80">{comparativa.etiquetaCorta}</span>
                </span>
              )
            })()}
            {metricasAnuales.cantVendidos > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-borde-sutil text-xxs"
                title="Presupuestos vendidos / aceptados durante el año"
              >
                <span className="font-medium tabular-nums text-texto-primario">{metricasAnuales.cantVendidos}</span>
                <span className="text-texto-terciario">{metricasAnuales.cantVendidos === 1 ? 'vendido' : 'vendidos'}</span>
              </span>
            )}
            {metricasAnuales.cantCerrados > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-insignia-exito/30 bg-insignia-exito/[0.04] text-xxs"
                title="Presupuestos que terminaron de cobrarse en el año"
              >
                <span className="font-medium tabular-nums text-insignia-exito-texto">{metricasAnuales.cantCerrados}</span>
                <span className="text-insignia-exito-texto/80">{metricasAnuales.cantCerrados === 1 ? 'cerrado' : 'cerrados'}</span>
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-borde-sutil text-xxs"
              title="Pagos individuales recibidos en el año (cuotas, adelantos, etc.)"
            >
              <span className="font-medium tabular-nums text-texto-primario">
                {totales.cobrosCount}
              </span>
              <span className="text-texto-terciario">{totales.cobrosCount === 1 ? 'pago' : 'pagos'}</span>
            </span>
          </div>
        </div>

        {/* Tasa de cobro — con barra de progreso visual */}
        {totales.vendido > 0.01 && (() => {
          const tasaColor = tasaCobro >= 80
            ? { texto: 'text-insignia-exito-texto', barra: 'bg-insignia-exito-texto', borde: 'border-insignia-exito/25' }
            : tasaCobro >= 50
              ? { texto: 'text-insignia-advertencia-texto', barra: 'bg-insignia-advertencia-texto', borde: 'border-insignia-advertencia/25' }
              : { texto: 'text-insignia-peligro-texto', barra: 'bg-insignia-peligro-texto', borde: 'border-insignia-peligro/25' }
          return (
            <div className={`rounded-lg border ${tasaColor.borde} bg-superficie-app/40 px-4 py-3 min-w-[180px]`}>
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
                Tasa de cobro
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-3xl font-light tabular-nums leading-none ${tasaColor.texto}`}>
                  {tasaCobro.toFixed(0)}
                </span>
                <span className={`text-base font-light ${tasaColor.texto}`}>%</span>
              </div>
              {/* Barra de progreso */}
              <div className="mt-3 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className={`h-full ${tasaColor.barra} rounded-full transition-all`}
                  style={{ width: `${Math.min(100, tasaCobro)}%` }}
                />
              </div>
              <p className="text-xxs text-texto-terciario mt-1.5">
                cobrado de lo vendido
              </p>
            </div>
          )
        })()}

        {/* Vendido del año — con desglose cobrado/pendiente */}
        {totales.vendido > 0.01 && (() => {
          const pendiente = Math.max(0, totales.vendido - totales.cobrado)
          return (
            <div className="rounded-lg border border-borde-sutil bg-superficie-app/40 px-4 py-3 min-w-[220px]">
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
                Vendido en {anioSel}
              </p>
              <p className="text-xl font-light tabular-nums text-texto-primario leading-none">
                <MontoConCentavos valor={totales.vendido} formatoMoneda={formatoMoneda} tamanoCentavos="65%" />
              </p>
              <div className="mt-3 pt-2 border-t border-borde-sutil/50 space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-xxs">
                  <span className="inline-flex items-center gap-1 text-texto-terciario">
                    <span className="size-1.5 rounded-full bg-insignia-exito-texto" />
                    Cobrado
                  </span>
                  <span className="text-insignia-exito-texto font-medium tabular-nums">
                    <MontoConCentavos valor={totales.cobrado} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
                  </span>
                </div>
                {pendiente > 0.01 && (
                  <div className="flex items-center justify-between gap-2 text-xxs">
                    <span className="inline-flex items-center gap-1 text-texto-terciario">
                      <span className="size-1.5 rounded-full bg-texto-terciario/50" />
                      Pendiente
                    </span>
                    <span className="text-texto-secundario tabular-nums">
                      <MontoConCentavos valor={pendiente} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Gráfico anual: barras de cobrado + línea de devengado */}
      <div className="px-4 sm:px-5 pb-3" style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <ComposedChart data={datosGrafico} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--borde-sutil)" />
            <XAxis dataKey="nombre" stroke="var(--texto-terciario)" fontSize={11} />
            <YAxis
              stroke="var(--texto-terciario)"
              fontSize={11}
              tickFormatter={(v) =>
                v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M`
                  : v >= 1000 ? `${Math.round(v / 1000)}k`
                    : String(v)
              }
            />
            <Tooltip content={<TooltipPersonalizado formatoMoneda={formatoMoneda} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
            <Bar
              dataKey="cobrado"
              name="Cobrado"
              fill="var(--insignia-exito-texto)"
              radius={[4, 4, 0, 0]}
            />
            <Line
              dataKey="vendido"
              name="Vendido"
              stroke="var(--texto-marca)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--texto-marca)' }}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Top 3 meses del año seleccionado + año anterior como referencia */}
      {(topMeses.length > 0 || topMesesPrev.length > 0) && (
        <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-borde-sutil/60 space-y-3">
          {topMeses.length > 0 && (
            <div>
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-2">
                Mejores meses de {anioSel}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {topMeses.map((m, i) => (
                  <div
                    key={m.nombre}
                    className="rounded-lg border border-borde-sutil bg-superficie-app/40 px-3 py-2"
                  >
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-xxs uppercase tracking-wider text-texto-terciario">
                        #{i + 1}
                      </span>
                      <span className="text-xs font-medium text-texto-primario">{m.nombre}</span>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-insignia-exito-texto">
                      <MontoConCentavos valor={m.monto} formatoMoneda={formatoMoneda} tamanoCentavos="75%" />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topMesesPrev.length > 0 && (
            <div className="opacity-70">
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-2">
                Mejores meses de {anioPrev} <span className="text-texto-terciario/70 normal-case tracking-normal">· referencia</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {topMesesPrev.map((m, i) => (
                  <div
                    key={m.nombre}
                    className="rounded-lg border border-borde-sutil bg-superficie-app/30 px-3 py-2"
                  >
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-xxs uppercase tracking-wider text-texto-terciario">
                        #{i + 1}
                      </span>
                      <span className="text-xs font-medium text-texto-secundario">{m.nombre}</span>
                    </div>
                    <p className="text-sm font-medium tabular-nums text-texto-secundario">
                      <MontoConCentavos valor={m.monto} formatoMoneda={formatoMoneda} tamanoCentavos="75%" />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {totales.cobrado === 0 && (
        <div className="px-4 sm:px-5 py-12 text-center text-xs text-texto-terciario">
          No hay cobros registrados en {anioSel}.
        </div>
      )}
    </div>
  )
}

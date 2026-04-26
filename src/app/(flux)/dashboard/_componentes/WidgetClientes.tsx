'use client'

/**
 * WidgetClientes — Distribución y crecimiento de cartera (clientes con
 * presupuestos). Convención de CRM: total + customer mix + new customers.
 *
 * Vistas:
 *  - Por tipo: total activos + barras por segmento (persona, empresa, etc.)
 *  - Nuevos: nuevos del mes con comparativa MoM/YoY + gráfico 12 meses
 */

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, TrendingUp, TrendingDown, Minus,
  Building2, User, Truck, UserPlus, BadgeCheck, Building,
} from 'lucide-react'
import { Insignia } from '@/componentes/ui/Insignia'
import { InfoBoton } from '@/componentes/ui/InfoBoton'
import { MESES_CORTOS } from './compartidos'

const ICONOS_TIPO: Record<string, React.ReactNode> = {
  persona: <User size={14} />,
  empresa: <Building2 size={14} />,
  edificio: <Building size={14} />,
  proveedor: <Truck size={14} />,
  lead: <UserPlus size={14} />,
  equipo: <BadgeCheck size={14} />,
}

const COLORES_TIPO: Record<string, 'primario' | 'info' | 'cyan' | 'naranja' | 'advertencia' | 'exito' | 'neutro'> = {
  persona: 'primario',
  empresa: 'info',
  edificio: 'cyan',
  proveedor: 'naranja',
  lead: 'advertencia',
  equipo: 'exito',
  sin_tipo: 'neutro',
}

const COLORES_CHART: Record<string, string> = {
  persona: 'var(--insignia-primario-texto)',
  empresa: 'var(--insignia-info-texto)',
  edificio: 'var(--insignia-cyan-texto, var(--insignia-info-texto))',
  proveedor: 'var(--insignia-naranja-texto)',
  lead: 'var(--insignia-advertencia-texto)',
  equipo: 'var(--insignia-exito-texto)',
  sin_tipo: 'var(--texto-terciario)',
}

interface Props {
  activosPorTipo: Record<string, { etiqueta: string; cantidad: number }>
  totalActivos: number
  nuevosPorMes: Record<string, Record<string, number>>
}

function TooltipNuevos({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + p.value, 0)
  return (
    <div className="bg-[var(--superficie-tarjeta)] border border-borde-fuerte rounded-card px-3 py-2.5 shadow-md min-w-[150px]">
      <p className="text-xs text-texto-terciario mb-1.5 font-medium">{label}</p>
      {payload.filter((p) => p.value > 0).map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3 text-xs py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-texto-secundario capitalize">{p.name}</span>
          </div>
          <span className="text-texto-primario font-bold">{p.value}</span>
        </div>
      ))}
      <div className="pt-1 mt-1 border-t border-borde-sutil flex items-center justify-between text-xs">
        <span className="text-texto-terciario">Total</span>
        <span className="text-texto-primario font-bold">{total}</span>
      </div>
    </div>
  )
}

export function WidgetClientes({ activosPorTipo, totalActivos, nuevosPorMes }: Props) {
  const router = useRouter()
  const [vista, setVista] = useState<'tipo' | 'nuevos'>('tipo')

  // ─── Datos por tipo ordenados ───
  const tiposOrdenados = useMemo(() =>
    Object.entries(activosPorTipo)
      .map(([clave, datos]) => ({ clave, ...datos }))
      .sort((a, b) => b.cantidad - a.cantidad),
    [activosPorTipo]
  )

  // Top tipo para card lateral
  const tipoTop = tiposOrdenados[0]
  const pctTipoTop = totalActivos > 0 && tipoTop ? Math.round((tipoTop.cantidad / totalActivos) * 100) : 0

  // ─── Datos para vista de nuevos ───
  const hoy = new Date()
  const mesActualIdx = hoy.getMonth()
  const anioActual = hoy.getFullYear()

  // Tipos que aparecen en los datos
  const tiposEnDatos = useMemo(() => {
    const set = new Set<string>()
    for (const mes of Object.values(nuevosPorMes)) {
      for (const t of Object.keys(mes)) set.add(t)
    }
    return Array.from(set).sort()
  }, [nuevosPorMes])

  // Últimos 12 meses
  const datos12Meses = useMemo(() => {
    const resultado = []
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date(anioActual, mesActualIdx - i, 1)
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
      const mes = MESES_CORTOS[fecha.getMonth()]
      const anio = fecha.getFullYear()
      const fila: Record<string, string | number> = {
        mes: `${mes} ${anio !== anioActual ? anio : ''}`.trim(),
      }
      for (const t of tiposEnDatos) {
        fila[t] = nuevosPorMes[clave]?.[t] || 0
      }
      resultado.push(fila)
    }
    return resultado
  }, [nuevosPorMes, tiposEnDatos, mesActualIdx, anioActual])

  // ─── KPIs del mes actual ───
  const claveActual = `${anioActual}-${String(mesActualIdx + 1).padStart(2, '0')}`
  const totalMesActual = Object.values(nuevosPorMes[claveActual] || {}).reduce((s, v) => s + v, 0)

  // MoM (mes anterior)
  const fechaMesAnt = new Date(anioActual, mesActualIdx - 1, 1)
  const claveMesAnt = `${fechaMesAnt.getFullYear()}-${String(fechaMesAnt.getMonth() + 1).padStart(2, '0')}`
  const totalMesAnt = Object.values(nuevosPorMes[claveMesAnt] || {}).reduce((s, v) => s + v, 0)
  const deltaMom = totalMesActual - totalMesAnt
  const pctMom = totalMesAnt > 0 ? Math.round((deltaMom / totalMesAnt) * 100) : 0

  // YoY (mismo mes año anterior)
  const claveAnioAnt = `${anioActual - 1}-${String(mesActualIdx + 1).padStart(2, '0')}`
  const totalAnioAnt = Object.values(nuevosPorMes[claveAnioAnt] || {}).reduce((s, v) => s + v, 0)
  const deltaYoy = totalMesActual - totalAnioAnt
  const pctYoy = totalAnioAnt > 0 ? Math.round((deltaYoy / totalAnioAnt) * 100) : 0

  // Total acumulado YTD
  const ytdActual = useMemo(() => {
    let total = 0
    for (let m = 1; m <= mesActualIdx + 1; m++) {
      const clave = `${anioActual}-${String(m).padStart(2, '0')}`
      total += Object.values(nuevosPorMes[clave] || {}).reduce((s, v) => s + v, 0)
    }
    return total
  }, [nuevosPorMes, anioActual, mesActualIdx])

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
      {/* ─── Header con tabs ─── */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-borde-sutil">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-sm font-semibold text-texto-primario truncate">Clientes</h3>
          <InfoBoton
            titulo="Clientes"
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Te muestra <strong className="text-texto-primario">quiénes son tus clientes</strong>:
                    cuántos tenés, de qué tipo son y cuántos nuevos sumás cada mes. Saber tu cartera te
                    ayuda a entender de qué depende tu negocio.
                  </p>
                ),
              },
              {
                titulo: 'Qué es un cliente activo',
                contenido: (
                  <p>
                    Es cualquier <strong className="text-texto-primario">contacto al que le hayas
                    generado al menos un presupuesto</strong>. No importa si lo aceptó o no —el solo
                    hecho de cotizarle ya lo cuenta como cliente activo en tu sistema.
                  </p>
                ),
              },
              {
                titulo: 'Distribución por tipo',
                contenido: (
                  <p>
                    Te muestra qué porcentaje de tu cartera son personas, empresas, edificios, etc. Tu
                    <strong className="text-texto-marca"> segmento principal</strong> es el tipo que más
                    plata representa para tu negocio.
                  </p>
                ),
              },
              {
                titulo: 'Cómo leerlo',
                contenido: (
                  <ul className="space-y-1.5 list-disc pl-4">
                    <li>
                      Si <strong className="text-texto-primario">un solo segmento concentra más del 70%</strong>,
                      tu negocio depende mucho de ese tipo de cliente. Diversificar te baja el riesgo.
                    </li>
                    <li>
                      En la pestaña <strong className="text-texto-primario">&quot;Nuevos&quot;</strong>,
                      las pildoras MoM y YoY te dicen si estás sumando más clientes que el mes pasado o que
                      el mismo mes del año anterior.
                    </li>
                    <li>
                      Las barras apiladas del gráfico muestran qué tipos de cliente nuevo estás sumando
                      cada mes.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Cruzá con otros widgets',
                contenido: (
                  <ul className="space-y-2 list-none">
                    <li>
                      <strong className="text-texto-primario">Con &quot;Pipeline&quot;:</strong>{' '}
                      <span className="text-texto-terciario">¿qué tipo de cliente concentra el pipeline
                      activo? Si tu segmento principal genera poco pipeline, tu cartera no se está
                      monetizando bien.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Cobros&quot;:</strong>{' '}
                      <span className="text-texto-terciario">¿qué tipo de cliente paga más rápido? Las
                      empresas suelen tardar más que las personas. Ajustá tus políticas de cobranza por
                      segmento.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Comparativa&quot;:</strong>{' '}
                      <span className="text-texto-terciario">la pestaña &quot;Contactos&quot; mide
                      contactos nuevos en general; acá ves específicamente clientes nuevos (con
                      presupuesto).</span>
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
            onClick={() => setVista('tipo')}
            className={`px-2.5 py-1 rounded-full text-xxs font-medium transition-colors ${
              vista === 'tipo'
                ? 'bg-texto-marca/[0.1] text-texto-marca'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            Por tipo
          </button>
          <button
            type="button"
            onClick={() => setVista('nuevos')}
            className={`px-2.5 py-1 rounded-full text-xxs font-medium transition-colors ${
              vista === 'nuevos'
                ? 'bg-texto-marca/[0.1] text-texto-marca'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            Nuevos
          </button>
        </div>
      </div>

      {/* ─── Vista "Por tipo" ─── */}
      {vista === 'tipo' && (
        <>
          {/* Hero: total + segmento principal */}
          <div className="px-4 sm:px-5 py-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 sm:gap-5 items-start">
            <div>
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
                Clientes activos
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-light tabular-nums text-texto-primario leading-none">
                {totalActivos}
              </p>
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-borde-sutil text-xxs">
                  <span className="text-texto-terciario">con presupuestos generados</span>
                </span>
                {tiposOrdenados.length > 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-borde-sutil text-xxs">
                    <span className="font-medium tabular-nums text-texto-primario">{tiposOrdenados.length}</span>
                    <span className="text-texto-terciario">{tiposOrdenados.length === 1 ? 'segmento' : 'segmentos'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Card segmento principal */}
            {tipoTop && totalActivos > 0 && (
              <div className="rounded-lg border border-texto-marca/25 bg-texto-marca/[0.03] px-4 py-3 min-w-[200px]">
                <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
                  Segmento principal
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-light tabular-nums text-texto-marca leading-none">
                    {pctTipoTop}<span className="text-base">%</span>
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5">
                  <span className="text-texto-marca">
                    {ICONOS_TIPO[tipoTop.clave] || <User size={14} />}
                  </span>
                  <Insignia color={COLORES_TIPO[tipoTop.clave] || 'neutro'}>
                    {tipoTop.etiqueta}
                  </Insignia>
                  <span className="text-xxs text-texto-terciario tabular-nums">
                    {tipoTop.cantidad}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Lista por segmento */}
          {tiposOrdenados.length > 0 ? (
            <div className="px-4 sm:px-5 pb-5">
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-2.5">
                Distribución por segmento
              </p>
              <div className="space-y-2">
                {tiposOrdenados.map((tipo) => {
                  const porcentaje = totalActivos > 0 ? (tipo.cantidad / totalActivos) * 100 : 0
                  return (
                    <div key={tipo.clave}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-texto-terciario">
                            {ICONOS_TIPO[tipo.clave] || <User size={14} />}
                          </span>
                          <Insignia color={COLORES_TIPO[tipo.clave] || 'neutro'}>
                            {tipo.etiqueta}
                          </Insignia>
                        </div>
                        <div className="flex items-baseline gap-2 tabular-nums">
                          <span className="text-xxs text-texto-terciario">
                            {Math.round(porcentaje)}%
                          </span>
                          <span className="text-texto-primario font-semibold">{tipo.cantidad}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-superficie-hover overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(porcentaje, 2)}%`,
                            backgroundColor: COLORES_CHART[tipo.clave] || 'var(--texto-terciario)',
                            opacity: 0.75,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="px-4 sm:px-5 pb-5 text-xs text-texto-terciario text-center py-4">
              Sin clientes con presupuestos aún
            </p>
          )}
        </>
      )}

      {/* ─── Vista "Nuevos" ─── */}
      {vista === 'nuevos' && (
        <>
          {/* Hero: nuevos del mes + comparativas */}
          <div className="px-4 sm:px-5 py-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 sm:gap-5 items-start">
            <div>
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
                Nuevos en {MESES_CORTOS[mesActualIdx]} {anioActual}
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-light tabular-nums text-texto-primario leading-none">
                {totalMesActual}
              </p>

              {/* Pills MoM y YoY */}
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                {totalMesAnt > 0 && (() => {
                  const subio = deltaMom > 0
                  const igual = deltaMom === 0
                  const colores = igual
                    ? 'border-borde-sutil text-texto-terciario'
                    : subio
                      ? 'border-insignia-exito/30 text-insignia-exito-texto bg-insignia-exito/[0.04]'
                      : 'border-insignia-peligro/30 text-insignia-peligro-texto bg-insignia-peligro/[0.04]'
                  const Icono = igual ? Minus : subio ? TrendingUp : TrendingDown
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xxs ${colores}`}
                      title={`vs ${MESES_CORTOS[fechaMesAnt.getMonth()]} (${totalMesAnt})`}
                    >
                      <Icono className="size-3" />
                      <span className="font-medium tabular-nums">
                        {deltaMom > 0 ? '+' : ''}{deltaMom} ({pctMom > 0 ? '+' : ''}{pctMom}%)
                      </span>
                      <span className="opacity-80">vs mes anterior</span>
                    </span>
                  )
                })()}
                {totalAnioAnt > 0 && (() => {
                  const subio = deltaYoy > 0
                  const igual = deltaYoy === 0
                  const colores = igual
                    ? 'border-borde-sutil text-texto-terciario'
                    : subio
                      ? 'border-insignia-exito/30 text-insignia-exito-texto bg-insignia-exito/[0.04]'
                      : 'border-insignia-peligro/30 text-insignia-peligro-texto bg-insignia-peligro/[0.04]'
                  const Icono = igual ? Minus : subio ? TrendingUp : TrendingDown
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xxs ${colores}`}
                      title={`vs ${MESES_CORTOS[mesActualIdx]} ${anioActual - 1} (${totalAnioAnt})`}
                    >
                      <Icono className="size-3" />
                      <span className="font-medium tabular-nums">
                        {deltaYoy > 0 ? '+' : ''}{deltaYoy} ({pctYoy > 0 ? '+' : ''}{pctYoy}%)
                      </span>
                      <span className="opacity-80">vs año anterior</span>
                    </span>
                  )
                })()}
              </div>
            </div>

            {/* Card YTD */}
            <div className="rounded-lg border border-borde-sutil bg-superficie-app/40 px-4 py-3 min-w-[160px]">
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
                Acumulado año
              </p>
              <p className="text-2xl font-light tabular-nums text-texto-primario leading-none">
                {ytdActual}
              </p>
              <p className="text-xxs text-texto-terciario mt-1.5">
                clientes nuevos en {anioActual}
              </p>
            </div>
          </div>

          {/* Gráfico de barras apiladas (12 meses) */}
          <div className="px-4 sm:px-5 pb-3">
            <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-2">
              Últimos 12 meses
            </p>
            <div className="h-44 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datos12Meses} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borde-sutil)" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 9, fill: 'var(--texto-terciario)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--texto-terciario)' }}
                    axisLine={false}
                    tickLine={false}
                    width={25}
                    allowDecimals={false}
                  />
                  <Tooltip content={<TooltipNuevos />} cursor={{ fill: 'var(--superficie-hover)', opacity: 0.3 }} />
                  {tiposEnDatos.map((t) => (
                    <Bar
                      key={t}
                      dataKey={t}
                      stackId="clientes"
                      fill={COLORES_CHART[t] || 'var(--texto-terciario)'}
                      opacity={0.75}
                      radius={t === tiposEnDatos[tiposEnDatos.length - 1] ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leyenda de tipos */}
          {tiposEnDatos.length > 0 && (
            <div className="px-4 sm:px-5 pb-5 pt-1 flex flex-wrap gap-x-3 gap-y-1.5">
              {tiposEnDatos.map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-xxs">
                  <div
                    className="size-2 rounded-full"
                    style={{ backgroundColor: COLORES_CHART[t], opacity: 0.75 }}
                  />
                  <span className="text-texto-terciario capitalize">
                    {activosPorTipo[t]?.etiqueta || t}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer: link al listado */}
      <button
        type="button"
        onClick={() => router.push('/contactos')}
        className="w-full px-4 sm:px-5 py-2.5 border-t border-borde-sutil/60 text-xxs text-texto-terciario hover:text-texto-marca transition-colors inline-flex items-center justify-center gap-1"
      >
        Ver todos los contactos <ArrowRight className="size-3" />
      </button>
    </div>
  )
}

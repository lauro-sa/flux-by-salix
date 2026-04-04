'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, TrendingUp, TrendingDown, Minus,
  Building2, User, Truck, UserPlus, BadgeCheck, Building,
} from 'lucide-react'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'

/**
 * WidgetClientes — Clientes activos (contactos con presupuestos).
 * Pestaña 1 "Por tipo": desglose de clientes activos por tipo (empresa, persona, etc.)
 * Pestaña 2 "Nuevos clientes": clientes nuevos por mes con comparativa dual
 *   (vs mes anterior + vs mismo mes año pasado)
 */

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

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

interface Props {
  activosPorTipo: Record<string, { etiqueta: string; cantidad: number }>
  totalActivos: number
  nuevosPorMes: Record<string, Record<string, number>>
}

function TooltipClientes({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + p.value, 0)
  return (
    <div className="bg-[var(--superficie-tarjeta)] border border-borde-fuerte rounded-lg px-3 py-2.5 shadow-md min-w-[150px]">
      <p className="text-xs text-texto-terciario mb-1.5 font-medium">{label}</p>
      {payload.filter(p => p.value > 0).map(p => (
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
  const [modoComparacion, setModoComparacion] = useState<'mes_anterior' | 'anio_anterior'>('mes_anterior')

  // Datos por tipo ordenados por cantidad
  const tiposOrdenados = useMemo(() =>
    Object.entries(activosPorTipo)
      .map(([clave, datos]) => ({ clave, ...datos }))
      .sort((a, b) => b.cantidad - a.cantidad),
    [activosPorTipo]
  )

  const maxCantidad = tiposOrdenados[0]?.cantidad || 1

  // ─── Datos para gráfico de nuevos clientes (últimos 12 meses) ───
  const hoy = new Date()
  const mesActualIdx = hoy.getMonth()
  const anioActual = hoy.getFullYear()

  // Tipos que aparecen en los datos
  const tiposEnDatos = useMemo(() => {
    const set = new Set<string>()
    for (const mes of Object.values(nuevosPorMes)) {
      for (const tipo of Object.keys(mes)) set.add(tipo)
    }
    return Array.from(set).sort()
  }, [nuevosPorMes])

  // Últimos 12 meses
  const datosNuevos12Meses = useMemo(() => {
    const resultado = []
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date(anioActual, mesActualIdx - i, 1)
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
      const mes = MESES_CORTOS[fecha.getMonth()]
      const anio = fecha.getFullYear()
      const fila: Record<string, string | number> = { mes: `${mes} ${anio !== anioActual ? anio : ''}`.trim() }
      for (const tipo of tiposEnDatos) {
        fila[tipo] = nuevosPorMes[clave]?.[tipo] || 0
      }
      fila._total = Object.values(nuevosPorMes[clave] || {}).reduce((s, v) => s + v, 0)
      resultado.push(fila)
    }
    return resultado
  }, [nuevosPorMes, tiposEnDatos, mesActualIdx, anioActual])

  // ─── Comparativas ───
  const claveMesActual = `${anioActual}-${String(mesActualIdx + 1).padStart(2, '0')}`
  const totalMesActual = Object.values(nuevosPorMes[claveMesActual] || {}).reduce((s, v) => s + v, 0)

  // vs mes anterior
  const fechaMesAnterior = new Date(anioActual, mesActualIdx - 1, 1)
  const claveMesAnterior = `${fechaMesAnterior.getFullYear()}-${String(fechaMesAnterior.getMonth() + 1).padStart(2, '0')}`
  const totalMesAnterior = Object.values(nuevosPorMes[claveMesAnterior] || {}).reduce((s, v) => s + v, 0)
  const difVsMesAnterior = totalMesActual - totalMesAnterior

  // vs mismo mes año anterior
  const claveMismoMesAnioAnterior = `${anioActual - 1}-${String(mesActualIdx + 1).padStart(2, '0')}`
  const totalMismoMesAnioAnterior = Object.values(nuevosPorMes[claveMismoMesAnioAnterior] || {}).reduce((s, v) => s + v, 0)
  const difVsAnioAnterior = totalMesActual - totalMismoMesAnioAnterior

  // Colores para barras del chart
  const COLORES_CHART: Record<string, string> = {
    persona: 'var(--insignia-primario-texto)',
    empresa: 'var(--insignia-info-texto)',
    edificio: 'var(--insignia-cyan-texto, var(--insignia-info-texto))',
    proveedor: 'var(--insignia-naranja-texto)',
    lead: 'var(--insignia-advertencia-texto)',
    equipo: 'var(--insignia-exito-texto)',
    sin_tipo: 'var(--texto-terciario)',
  }

  // ─── Pestaña 1: Por tipo ───
  const contenidoPorTipo = (
    <div className="space-y-4">
      {/* Total activos */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold text-texto-primario">{totalActivos}</span>
          <span className="text-xs text-texto-terciario ml-2">clientes con presupuestos</span>
        </div>
      </div>

      {/* Barras por tipo */}
      {tiposOrdenados.length > 0 ? (
        <div className="space-y-2.5">
          {tiposOrdenados.map(tipo => {
            const porcentaje = (tipo.cantidad / maxCantidad) * 100
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
                  <span className="text-texto-primario font-bold tabular-nums">{tipo.cantidad}</span>
                </div>
                <div className="h-2 rounded-full bg-superficie-hover overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(porcentaje, 3)}%`,
                      backgroundColor: COLORES_CHART[tipo.clave] || 'var(--texto-terciario)',
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-texto-terciario text-center py-4">Sin clientes con presupuestos aún</p>
      )}
    </div>
  )

  // ─── Pestaña 2: Nuevos clientes ───
  const contenidoNuevos = (
    <div className="space-y-4">
      {/* KPI + comparativas */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-2xl font-bold text-texto-primario">{totalMesActual}</span>
          <p className="text-xs text-texto-terciario mt-0.5">
            nuevos en {MESES_CORTOS[mesActualIdx]} {anioActual}
          </p>
        </div>

        {/* Toggle de modo comparación */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1 bg-superficie-hover/50 rounded-lg p-0.5">
            <button
              onClick={() => setModoComparacion('mes_anterior')}
              className={`px-2 py-1 text-xxs rounded-md transition-colors ${
                modoComparacion === 'mes_anterior'
                  ? 'bg-superficie-tarjeta shadow-sm border border-borde-sutil text-texto-primario font-medium'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              vs mes anterior
            </button>
            <button
              onClick={() => setModoComparacion('anio_anterior')}
              className={`px-2 py-1 text-xxs rounded-md transition-colors ${
                modoComparacion === 'anio_anterior'
                  ? 'bg-superficie-tarjeta shadow-sm border border-borde-sutil text-texto-primario font-medium'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              vs año anterior
            </button>
          </div>

          {/* Resultado comparativa */}
          {(() => {
            const dif = modoComparacion === 'mes_anterior' ? difVsMesAnterior : difVsAnioAnterior
            const comparaCon = modoComparacion === 'mes_anterior'
              ? `${MESES_CORTOS[fechaMesAnterior.getMonth()]} (${totalMesAnterior})`
              : `${MESES_CORTOS[mesActualIdx]} ${anioActual - 1} (${totalMismoMesAnioAnterior})`
            return (
              <div className="flex items-center gap-1.5 text-xs">
                {dif > 0 ? (
                  <TrendingUp size={13} className="text-insignia-exito-texto" />
                ) : dif < 0 ? (
                  <TrendingDown size={13} className="text-insignia-peligro-texto" />
                ) : (
                  <Minus size={13} className="text-texto-terciario" />
                )}
                <span className={dif > 0 ? 'text-insignia-exito-texto font-medium' : dif < 0 ? 'text-insignia-peligro-texto font-medium' : 'text-texto-terciario'}>
                  {dif > 0 ? '+' : ''}{dif}
                </span>
                <span className="text-texto-terciario">vs {comparaCon}</span>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Gráfico de barras apiladas */}
      <div className="h-44 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datosNuevos12Meses} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
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
            <Tooltip content={<TooltipClientes />} cursor={{ fill: 'var(--superficie-hover)', opacity: 0.3 }} />
            {tiposEnDatos.map(tipo => (
              <Bar
                key={tipo}
                dataKey={tipo}
                stackId="clientes"
                fill={COLORES_CHART[tipo] || 'var(--texto-terciario)'}
                opacity={0.7}
                radius={tipo === tiposEnDatos[tiposEnDatos.length - 1] ? [2, 2, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda de tipos */}
      <div className="flex flex-wrap gap-3 pt-1">
        {tiposEnDatos.map(tipo => (
          <div key={tipo} className="flex items-center gap-1.5 text-xxs">
            <div className="size-2 rounded-full" style={{ backgroundColor: COLORES_CHART[tipo], opacity: 0.7 }} />
            <span className="text-texto-terciario capitalize">{activosPorTipo[tipo]?.etiqueta || tipo}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <TarjetaConPestanas
      titulo="Clientes"
      subtitulo="Contactos que tienen presupuestos"
      pestanas={[
        { etiqueta: 'Por tipo', contenido: contenidoPorTipo },
        { etiqueta: 'Nuevos', contenido: contenidoNuevos },
      ]}
      acciones={
        <Boton variante="fantasma" tamano="xs" iconoDerecho={<ArrowRight size={12} />} onClick={() => router.push('/contactos')}>
          Ver todo
        </Boton>
      }
    />
  )
}

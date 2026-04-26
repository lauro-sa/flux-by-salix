'use client'

/**
 * HeroResumen — 4 KPIs ejecutivos arriba de la pestaña Métricas.
 *
 * Diseño minimalista tipo dashboard moderno:
 *  - Mobile: grid 2x2
 *  - Desktop: 1x4 en una fila
 *  - Cada card: label uppercase tracking-widest + número grande + delta/contexto
 *  - Color semántico solo en el delta (verde/rojo/neutro)
 *
 * Combina datos que ya devuelve `/api/dashboard` sin requerir backend nuevo.
 */

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Target, DollarSign, Briefcase, Trophy } from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'
import { formatoCompacto } from './compartidos'

interface Props {
  /** Cobros reales por mes (clave YYYY-MM) */
  cobradoPorMes: Record<string, { cantidad: number; monto: number }>
  /** Conteo de presupuestos por estado */
  porEstado: Record<string, number>
  /** Monto de presupuestos por estado */
  pipelineMontos: Record<string, number>
  formatoMoneda: (n: number) => string
}

export function HeroResumen({
  cobradoPorMes, porEstado, pipelineMontos, formatoMoneda,
}: Props) {
  const hoy = new Date()
  const claveMesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const fechaMesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const claveMesAnt = `${fechaMesAnt.getFullYear()}-${String(fechaMesAnt.getMonth() + 1).padStart(2, '0')}`

  const datos = useMemo(() => {
    // ─── KPI 1: Cobrado del mes ───
    const cobradoMes = cobradoPorMes[claveMesActual]?.monto || 0
    const cobradoMesAnt = cobradoPorMes[claveMesAnt]?.monto || 0
    const deltaCobrado = cobradoMes - cobradoMesAnt
    const pctCobrado = cobradoMesAnt > 0 ? Math.round((deltaCobrado / cobradoMesAnt) * 100) : 0

    // ─── KPI 2: Pipeline activo ───
    const cantAbierto = (porEstado.borrador || 0) + (porEstado.enviado || 0) + (porEstado.confirmado_cliente || 0)
    const montoActivo = ['borrador', 'enviado', 'confirmado_cliente'].reduce(
      (s, e) => s + (pipelineMontos[e] || 0), 0
    )

    // ─── KPI 3: Ganado YTD (orden_venta + completado) ───
    const cantGanado = (porEstado.orden_venta || 0) + (porEstado.completado || 0)
    const montoGanado = ['orden_venta', 'completado'].reduce(
      (s, e) => s + (pipelineMontos[e] || 0), 0
    )

    // ─── KPI 4: Win rate (sobre cerrados) ───
    const cantPerdido = (porEstado.rechazado || 0) + (porEstado.vencido || 0) + (porEstado.cancelado || 0)
    const cantCerrados = cantGanado + cantPerdido
    const winRate = cantCerrados > 0 ? Math.round((cantGanado / cantCerrados) * 100) : 0

    return {
      cobradoMes, cobradoMesAnt, deltaCobrado, pctCobrado,
      cantAbierto, montoActivo,
      cantGanado, montoGanado,
      winRate, cantCerrados,
    }
  }, [cobradoPorMes, claveMesActual, claveMesAnt, porEstado, pipelineMontos])

  const nombresMes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const nombreMesAnt = nombresMes[fechaMesAnt.getMonth()]

  // Color del delta de cobro
  const subioCobrado = datos.deltaCobrado > 0
  const igualCobrado = Math.abs(datos.deltaCobrado) < 0.01
  const colorDeltaCobrado = igualCobrado
    ? 'text-texto-terciario border-borde-sutil'
    : subioCobrado
      ? 'text-insignia-exito-texto border-insignia-exito/30 bg-insignia-exito/[0.04]'
      : 'text-insignia-peligro-texto border-insignia-peligro/30 bg-insignia-peligro/[0.04]'
  const IconoDelta = igualCobrado ? Minus : subioCobrado ? TrendingUp : TrendingDown

  // Color del win rate
  const colorWin = datos.winRate >= 50
    ? 'text-insignia-exito-texto'
    : datos.winRate >= 25
      ? 'text-insignia-advertencia-texto'
      : 'text-insignia-peligro-texto'

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
      {/* Header sutil */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-borde-sutil">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-xxs uppercase tracking-widest text-texto-terciario font-medium">Resumen ejecutivo</h3>
          <InfoBoton
            titulo="Resumen ejecutivo"
            tamano={12}
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Es la <strong className="text-texto-primario">foto rápida</strong> de tu negocio: los
                    4 indicadores más importantes que te dicen cómo viene el mes en un vistazo.
                  </p>
                ),
              },
              {
                titulo: 'Los 4 KPIs',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-texto-primario">Cobrado del mes:</strong> la plata que entró
                      este mes, con la comparativa contra el mes anterior.
                    </li>
                    <li>
                      <strong className="text-texto-marca">Pipeline activo:</strong> total de
                      presupuestos en juego (borrador + enviado + confirmado).
                    </li>
                    <li>
                      <strong className="text-insignia-exito-texto">Ganado YTD:</strong> total de
                      presupuestos que se cerraron positivamente (orden de venta + completados).
                    </li>
                    <li>
                      <strong className="text-texto-primario">Win rate:</strong> de los presupuestos que
                      ya se cerraron (ganados + perdidos), qué % terminaste ganando.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Cómo leerlo',
                contenido: (
                  <ul className="space-y-1.5 list-disc pl-4">
                    <li>El delta vs mes anterior te dice si vas mejor, igual o peor.</li>
                    <li>Pipeline activo + win rate te permite proyectar: si el activo es $N y mantenés tu win rate, vas a ganar aprox. N × winRate.</li>
                    <li>Cada KPI tiene un widget detallado más abajo en el dashboard si querés profundizar.</li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* 4 KPIs en grid responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Cobrado del mes */}
        <div className="px-4 sm:px-5 py-4 sm:py-5 border-b lg:border-b-0 lg:border-r border-borde-sutil/60">
          <div className="flex items-center gap-1.5 mb-1.5">
            <DollarSign size={11} className="text-texto-terciario" />
            <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium">
              Cobrado mes
            </p>
          </div>
          <p
            className="text-2xl sm:text-3xl font-light tabular-nums text-texto-primario leading-none whitespace-nowrap"
            title={formatoMoneda(datos.cobradoMes)}
          >
            {formatoCompacto(datos.cobradoMes, formatoMoneda)}
          </p>
          {datos.cobradoMesAnt > 0 && (
            <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full border text-xxs ${colorDeltaCobrado}`}>
              <IconoDelta className="size-3" />
              <span className="font-medium tabular-nums">
                {Math.abs(datos.pctCobrado)}%
              </span>
              <span className="opacity-80">vs {nombreMesAnt}</span>
            </span>
          )}
        </div>

        {/* KPI 2: Pipeline activo */}
        <div className="px-4 sm:px-5 py-4 sm:py-5 border-b lg:border-b-0 lg:border-r border-borde-sutil/60">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Briefcase size={11} className="text-texto-terciario" />
            <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium">
              Pipeline activo
            </p>
          </div>
          <p
            className="text-2xl sm:text-3xl font-light tabular-nums text-texto-marca leading-none whitespace-nowrap"
            title={formatoMoneda(datos.montoActivo)}
          >
            {formatoCompacto(datos.montoActivo, formatoMoneda)}
          </p>
          <p className="text-xxs text-texto-terciario mt-2">
            <span className="font-medium tabular-nums text-texto-secundario">{datos.cantAbierto}</span>
            {' '}{datos.cantAbierto === 1 ? 'abierto' : 'abiertos'}
          </p>
        </div>

        {/* KPI 3: Ganado YTD */}
        <div className="px-4 sm:px-5 py-4 sm:py-5 border-b sm:border-b-0 lg:border-r border-borde-sutil/60">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Trophy size={11} className="text-texto-terciario" />
            <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium">
              Ganado año
            </p>
          </div>
          <p
            className="text-2xl sm:text-3xl font-light tabular-nums text-insignia-exito-texto leading-none whitespace-nowrap"
            title={formatoMoneda(datos.montoGanado)}
          >
            {formatoCompacto(datos.montoGanado, formatoMoneda)}
          </p>
          <p className="text-xxs text-texto-terciario mt-2">
            <span className="font-medium tabular-nums text-texto-secundario">{datos.cantGanado}</span>
            {' '}{datos.cantGanado === 1 ? 'ganado' : 'ganados'}
          </p>
        </div>

        {/* KPI 4: Win rate */}
        <div className="px-4 sm:px-5 py-4 sm:py-5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target size={11} className="text-texto-terciario" />
            <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium">
              Win rate
            </p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl sm:text-3xl font-light tabular-nums leading-none ${colorWin}`}>
              {datos.winRate}
            </span>
            <span className={`text-base sm:text-lg font-light ${colorWin}`}>%</span>
          </div>
          <p className="text-xxs text-texto-terciario mt-2 tabular-nums">
            {datos.cantGanado} de {datos.cantCerrados} cerrados
          </p>
        </div>
      </div>
    </div>
  )
}

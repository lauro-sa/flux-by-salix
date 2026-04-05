'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/**
 * ResumenMetricas — 4 tarjetas KPI del año actual vs anterior.
 * Diseño estilo Stripe: número grande, subtítulo, comparación compacta.
 */

interface Props {
  ingresosPorAnio: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }>
  presupuestosPorMes: Record<string, { creados: number; monto_total: number }>
  contactosPorMes: Record<string, number>
  clientesTotalActivos: number
  slaInbox: number
  tiempoRespuesta: number
  formatoMoneda: (n: number) => string
}

function Variacion({ valor, sufijo, invertir }: { valor: number; sufijo?: string; invertir?: boolean }) {
  if (valor === 0) return <span className="text-xxs text-texto-terciario flex items-center gap-0.5"><Minus size={10} />—</span>
  const positivo = invertir ? valor < 0 : valor > 0
  return (
    <span className={`text-xxs font-medium flex items-center gap-0.5 ${positivo ? 'text-insignia-exito-texto' : 'text-insignia-peligro-texto'}`}>
      {valor > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {valor > 0 ? '+' : ''}{valor}{sufijo || ''}
    </span>
  )
}

export function ResumenMetricas({
  ingresosPorAnio, presupuestosPorMes, contactosPorMes,
  clientesTotalActivos, slaInbox, tiempoRespuesta, formatoMoneda,
}: Props) {
  const anio = new Date().getFullYear()
  const mesNum = new Date().getMonth() + 1
  const pctAnio = Math.round((mesNum / 12) * 100)

  const datos = useMemo(() => {
    const actual = ingresosPorAnio[String(anio)]
    const anterior = ingresosPorAnio[String(anio - 1)]

    const presupActual = Object.entries(presupuestosPorMes)
      .filter(([k]) => k.startsWith(`${anio}-`))
      .reduce((s, [, v]) => s + v.creados, 0)
    const presupAnterior = Object.entries(presupuestosPorMes)
      .filter(([k]) => k.startsWith(`${anio - 1}-`))
      .reduce((s, [, v]) => s + v.creados, 0)

    const contactosActual = Object.entries(contactosPorMes)
      .filter(([k]) => k.startsWith(`${anio}-`))
      .reduce((s, [, v]) => s + v, 0)
    const contactosAnterior = Object.entries(contactosPorMes)
      .filter(([k]) => k.startsWith(`${anio - 1}-`))
      .reduce((s, [, v]) => s + v, 0)

    const tasa = presupActual > 0 ? Math.round(((actual?.ordenes_cantidad || 0) / presupActual) * 100) : 0
    const tasaAnt = presupAnterior > 0 ? Math.round(((anterior?.ordenes_cantidad || 0) / presupAnterior) * 100) : 0

    const pctAlcanzado = anterior?.ordenes_monto
      ? Math.round(((actual?.ordenes_monto || 0) / anterior.ordenes_monto) * 100)
      : 0

    return {
      ordenesMonto: actual?.ordenes_monto || 0,
      ordenesCant: actual?.ordenes_cantidad || 0,
      ordenesMontoAnt: anterior?.ordenes_monto || 0,
      pctAlcanzado,
      presupActual,
      presupAnterior,
      tasa,
      tasaAnt,
      contactosActual,
      contactosAnterior,
    }
  }, [ingresosPorAnio, presupuestosPorMes, contactosPorMes, anio])

  // ¿Vas adelantado o atrasado respecto al ritmo del año anterior?
  const ritmoOk = datos.pctAlcanzado >= pctAnio

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-texto-primario">Resumen {anio}</h3>
        <span className="text-xxs text-texto-terciario">{pctAnio}% del año transcurrido</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Ventas */}
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4">
          <p className="text-xxs text-texto-terciario uppercase tracking-wide mb-1">Vendido</p>
          <p className="text-xl font-bold text-insignia-exito-texto leading-tight">{formatoMoneda(datos.ordenesMonto)}</p>
          <p className="text-xxs text-texto-terciario mt-0.5">{datos.ordenesCant} órdenes</p>
          {datos.ordenesMontoAnt > 0 && (
            <div className="mt-3 pt-3 border-t border-borde-sutil">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xxs text-texto-terciario">vs {anio - 1}</span>
                <span className="text-xxs text-texto-secundario">{formatoMoneda(datos.ordenesMontoAnt)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-superficie-hover overflow-hidden relative">
                <div className="absolute top-0 bottom-0 w-px bg-texto-terciario/40 z-10" style={{ left: `${pctAnio}%` }} />
                <div className={`h-full rounded-full transition-all duration-700 ${ritmoOk ? 'bg-insignia-exito-texto/60' : 'bg-insignia-advertencia-texto/60'}`} style={{ width: `${Math.min(datos.pctAlcanzado, 100)}%` }} />
              </div>
              <p className={`text-xxs mt-1 ${ritmoOk ? 'text-insignia-exito-texto' : 'text-insignia-advertencia-texto'}`}>
                {datos.pctAlcanzado}% — {ritmoOk ? 'buen ritmo' : 'por debajo del ritmo'}
              </p>
            </div>
          )}
        </div>

        {/* Presupuestos */}
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4">
          <p className="text-xxs text-texto-terciario uppercase tracking-wide mb-1">Presupuestado</p>
          <p className="text-xl font-bold text-texto-primario leading-tight">{datos.presupActual}</p>
          <p className="text-xxs text-texto-terciario mt-0.5">presupuestos emitidos</p>
          {datos.presupAnterior > 0 && (
            <div className="mt-3 pt-3 border-t border-borde-sutil flex items-center justify-between">
              <span className="text-xxs text-texto-terciario">{anio - 1}: {datos.presupAnterior}</span>
              <Variacion valor={datos.presupActual - datos.presupAnterior} />
            </div>
          )}
        </div>

        {/* Tasa de cierre */}
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4">
          <p className="text-xxs text-texto-terciario uppercase tracking-wide mb-1">Tasa de cierre</p>
          <p className={`text-xl font-bold leading-tight ${datos.tasa >= 30 ? 'text-insignia-exito-texto' : datos.tasa >= 15 ? 'text-insignia-advertencia-texto' : 'text-texto-primario'}`}>
            {datos.tasa}%
          </p>
          <p className="text-xxs text-texto-terciario mt-0.5">{datos.ordenesCant} de {datos.presupActual}</p>
          {datos.tasaAnt > 0 && (
            <div className="mt-3 pt-3 border-t border-borde-sutil flex items-center justify-between">
              <span className="text-xxs text-texto-terciario">{anio - 1}: {datos.tasaAnt}%</span>
              <Variacion valor={datos.tasa - datos.tasaAnt} sufijo="pp" />
            </div>
          )}
        </div>

        {/* Contactos + Inbox */}
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4">
          <p className="text-xxs text-texto-terciario uppercase tracking-wide mb-1">Contactos nuevos</p>
          <p className="text-xl font-bold text-texto-primario leading-tight">{datos.contactosActual}</p>
          <p className="text-xxs text-texto-terciario mt-0.5">{clientesTotalActivos} con presupuestos</p>
          <div className="mt-3 pt-3 border-t border-borde-sutil space-y-1.5">
            {datos.contactosAnterior > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xxs text-texto-terciario">{anio - 1}: {datos.contactosAnterior}</span>
                <Variacion valor={datos.contactosActual - datos.contactosAnterior} />
              </div>
            )}
            {(slaInbox > 0 || tiempoRespuesta > 0) && (
              <div className="flex items-center justify-between">
                {slaInbox > 0 && (
                  <span className={`text-xxs font-medium ${slaInbox >= 80 ? 'text-insignia-exito-texto' : slaInbox >= 50 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'}`}>
                    SLA {slaInbox}%
                  </span>
                )}
                {tiempoRespuesta > 0 && (
                  <span className="text-xxs text-texto-terciario">{tiempoRespuesta}min resp.</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

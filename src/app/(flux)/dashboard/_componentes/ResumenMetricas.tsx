'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Target, Users, FileText, MessageSquare } from 'lucide-react'

/**
 * ResumenMetricas — Resumen visual del año para la pestaña de métricas.
 * Tarjetas con números grandes, comparaciones claras, indicadores de color.
 * Se lee de un vistazo sin tener que leer párrafos.
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

function Indicador({ valor, sufijo, positivo }: { valor: number; sufijo?: string; positivo?: boolean }) {
  if (valor === 0) return <span className="text-xs text-texto-terciario flex items-center gap-1"><Minus size={12} /> sin cambio</span>
  const esPositivo = positivo !== undefined ? positivo : valor > 0
  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${esPositivo ? 'text-insignia-exito-texto' : 'text-insignia-peligro-texto'}`}>
      {valor > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {valor > 0 ? '+' : ''}{valor}{sufijo || ''}
    </span>
  )
}

export function ResumenMetricas({
  ingresosPorAnio, presupuestosPorMes, contactosPorMes,
  clientesTotalActivos, slaInbox, tiempoRespuesta, formatoMoneda,
}: Props) {
  const anioActual = new Date().getFullYear()

  const resumen = useMemo(() => {
    const datosActual = ingresosPorAnio[String(anioActual)]
    const datosAnterior = ingresosPorAnio[String(anioActual - 1)]

    // Presupuestos emitidos
    const presupActual = Object.entries(presupuestosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual}-`))
      .reduce((s, [, v]) => s + v.creados, 0)
    const presupAnterior = Object.entries(presupuestosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual - 1}-`))
      .reduce((s, [, v]) => s + v.creados, 0)
    const montoPresupActual = Object.entries(presupuestosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual}-`))
      .reduce((s, [, v]) => s + v.monto_total, 0)

    // Contactos
    const contactosActual = Object.entries(contactosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual}-`))
      .reduce((s, [, v]) => s + v, 0)
    const contactosAnterior = Object.entries(contactosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual - 1}-`))
      .reduce((s, [, v]) => s + v, 0)

    // Tasa de cierre
    const tasaActual = presupActual > 0 ? Math.round(((datosActual?.ordenes_cantidad || 0) / presupActual) * 100) : 0
    const tasaAnterior = presupAnterior > 0 ? Math.round(((datosAnterior?.ordenes_cantidad || 0) / presupAnterior) * 100) : 0

    // % del año anterior alcanzado
    const pctDelAnterior = datosAnterior?.ordenes_monto
      ? Math.round(((datosActual?.ordenes_monto || 0) / datosAnterior.ordenes_monto) * 100)
      : 0

    return {
      ordenesMonto: datosActual?.ordenes_monto || 0,
      ordenesCantidad: datosActual?.ordenes_cantidad || 0,
      ordenesMontoAnterior: datosAnterior?.ordenes_monto || 0,
      ordenesCantidadAnterior: datosAnterior?.ordenes_cantidad || 0,
      pctDelAnterior,
      presupActual,
      presupAnterior,
      montoPresupActual,
      tasaActual,
      tasaAnterior,
      contactosActual,
      contactosAnterior,
    }
  }, [ingresosPorAnio, presupuestosPorMes, contactosPorMes, anioActual])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="space-y-3"
    >
      <h3 className="text-sm font-semibold text-texto-primario">Resumen {anioActual}</h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Órdenes de venta */}
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-texto-terciario">
            <Target size={14} />
            <span className="text-xxs font-medium uppercase tracking-wide">Órdenes de venta</span>
          </div>
          <p className="text-xl font-bold text-insignia-exito-texto">{formatoMoneda(resumen.ordenesMonto)}</p>
          <p className="text-xxs text-texto-terciario">{resumen.ordenesCantidad} cerradas</p>
          {resumen.ordenesMontoAnterior > 0 && (
            <div className="pt-2 border-t border-borde-sutil space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xxs text-texto-terciario">{anioActual - 1}</span>
                <span className="text-xxs text-texto-secundario font-medium">{formatoMoneda(resumen.ordenesMontoAnterior)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-superficie-hover overflow-hidden">
                <div
                  className="h-full rounded-full bg-insignia-exito-texto/60 transition-all duration-700"
                  style={{ width: `${Math.min(resumen.pctDelAnterior, 100)}%` }}
                />
              </div>
              <p className="text-xxs text-texto-terciario">{resumen.pctDelAnterior}% del total {anioActual - 1}</p>
            </div>
          )}
        </div>

        {/* Presupuestos emitidos */}
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-texto-terciario">
            <FileText size={14} />
            <span className="text-xxs font-medium uppercase tracking-wide">Presupuestado</span>
          </div>
          <p className="text-xl font-bold text-texto-primario">{resumen.presupActual}</p>
          <p className="text-xxs text-texto-terciario">por {formatoMoneda(resumen.montoPresupActual)}</p>
          {resumen.presupAnterior > 0 && (
            <div className="pt-2 border-t border-borde-sutil">
              <div className="flex items-center justify-between">
                <span className="text-xxs text-texto-terciario">vs {anioActual - 1}</span>
                <Indicador valor={resumen.presupActual - resumen.presupAnterior} />
              </div>
            </div>
          )}
        </div>

        {/* Tasa de cierre */}
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-texto-terciario">
            <TrendingUp size={14} />
            <span className="text-xxs font-medium uppercase tracking-wide">Tasa de cierre</span>
          </div>
          <p className={`text-xl font-bold ${resumen.tasaActual >= 30 ? 'text-insignia-exito-texto' : resumen.tasaActual >= 15 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'}`}>
            {resumen.tasaActual}%
          </p>
          <p className="text-xxs text-texto-terciario">{resumen.ordenesCantidad} de {resumen.presupActual} presupuestos</p>
          {resumen.tasaAnterior > 0 && (
            <div className="pt-2 border-t border-borde-sutil">
              <div className="flex items-center justify-between">
                <span className="text-xxs text-texto-terciario">{anioActual - 1}: {resumen.tasaAnterior}%</span>
                <Indicador valor={resumen.tasaActual - resumen.tasaAnterior} sufijo="pp" />
              </div>
            </div>
          )}
        </div>

        {/* Contactos + Inbox */}
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-texto-terciario">
            <Users size={14} />
            <span className="text-xxs font-medium uppercase tracking-wide">Contactos nuevos</span>
          </div>
          <p className="text-xl font-bold text-texto-primario">{resumen.contactosActual}</p>
          <p className="text-xxs text-texto-terciario">{clientesTotalActivos} con presupuestos</p>
          {resumen.contactosAnterior > 0 && (
            <div className="pt-2 border-t border-borde-sutil">
              <div className="flex items-center justify-between">
                <span className="text-xxs text-texto-terciario">vs {anioActual - 1}</span>
                <Indicador valor={resumen.contactosActual - resumen.contactosAnterior} />
              </div>
            </div>
          )}
          {(slaInbox > 0 || tiempoRespuesta > 0) && (
            <div className="pt-2 border-t border-borde-sutil flex items-center gap-3">
              {slaInbox > 0 && (
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={11} className="text-texto-terciario" />
                  <span className={`text-xxs font-medium ${slaInbox >= 80 ? 'text-insignia-exito-texto' : slaInbox >= 50 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'}`}>
                    SLA {slaInbox}%
                  </span>
                </div>
              )}
              {tiempoRespuesta > 0 && (
                <span className="text-xxs text-texto-terciario">{tiempoRespuesta}min resp.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

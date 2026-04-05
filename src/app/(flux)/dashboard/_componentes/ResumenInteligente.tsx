'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, Clock, Mail, DollarSign, FileText, Users, CheckSquare,
} from 'lucide-react'

/**
 * ResumenInteligente — Resumen del mes actual.
 * Siempre muestra 4 métricas del mes + alertas si hay.
 * Formato: tarjeta con números claros, no texto.
 */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface Props {
  contactosTotal: number
  contactosNuevosMes: number
  contactosNuevosMesAnterior: number
  presupuestosTotal: number
  presupuestosNuevosMes: number
  presupuestosNuevosMesAnterior: number
  presupuestosBorradores: number
  ordenesMontoMes: number
  ordenesMontoMesAnterior: number
  ordenesCantidadMes: number
  ordenesCantidadMesAnterior: number
  actividadesPendientes: number
  actividadesVencidas: number
  actividadesCompletadasHoy: number
  conversacionesAbiertas: number
  conversacionesSinLeer: number
  presupuestosPorVencer: number
  formatoMoneda: (n: number) => string
}

function Variacion({ actual, anterior, esMonto, formatoMoneda }: {
  actual: number; anterior: number; esMonto?: boolean; formatoMoneda?: (n: number) => string
}) {
  if (anterior === 0) return null
  const dif = actual - anterior
  if (dif === 0) return <span className="text-xxs text-texto-terciario flex items-center gap-0.5"><Minus size={10} /> igual</span>
  const positivo = dif > 0
  return (
    <span className={`text-xxs font-medium flex items-center gap-0.5 ${positivo ? 'text-insignia-exito-texto' : 'text-insignia-peligro-texto'}`}>
      {positivo ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {positivo ? '+' : ''}{esMonto && formatoMoneda ? formatoMoneda(dif) : dif} vs mes ant.
    </span>
  )
}

export function ResumenInteligente(props: Props) {
  const {
    contactosNuevosMes, contactosNuevosMesAnterior,
    presupuestosNuevosMes, presupuestosNuevosMesAnterior, presupuestosBorradores,
    ordenesMontoMes, ordenesMontoMesAnterior, ordenesCantidadMes, ordenesCantidadMesAnterior,
    actividadesPendientes, actividadesVencidas, actividadesCompletadasHoy,
    conversacionesSinLeer, presupuestosPorVencer, formatoMoneda,
  } = props

  const hoy = new Date()
  const mesNombre = MESES[hoy.getMonth()]
  const anio = hoy.getFullYear()
  const diaDelMes = hoy.getDate()
  const diasEnMes = new Date(anio, hoy.getMonth() + 1, 0).getDate()

  // Alertas urgentes
  const alertas = useMemo(() => {
    const items: Array<{ icono: React.ReactNode; texto: string; color: string }> = []
    if (actividadesVencidas > 0) items.push({ icono: <AlertTriangle size={12} />, texto: `${actividadesVencidas} vencida${actividadesVencidas > 1 ? 's' : ''}`, color: 'text-insignia-peligro-texto' })
    if (presupuestosPorVencer > 0) items.push({ icono: <Clock size={12} />, texto: `${presupuestosPorVencer} por vencer`, color: 'text-insignia-advertencia-texto' })
    if (presupuestosBorradores > 0) items.push({ icono: <FileText size={12} />, texto: `${presupuestosBorradores} borrador${presupuestosBorradores > 1 ? 'es' : ''}`, color: 'text-texto-terciario' })
    if (conversacionesSinLeer > 0) items.push({ icono: <Mail size={12} />, texto: `${conversacionesSinLeer} sin leer`, color: conversacionesSinLeer > 5 ? 'text-insignia-advertencia-texto' : 'text-texto-terciario' })
    return items
  }, [actividadesVencidas, presupuestosPorVencer, presupuestosBorradores, conversacionesSinLeer])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-texto-primario">{mesNombre} {anio}</h3>
        <span className="text-xxs text-texto-terciario">Día {diaDelMes} de {diasEnMes}</span>
      </div>

      {/* 4 métricas del mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vendido */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={12} className="text-insignia-exito-texto" />
            <span className="text-xxs text-texto-terciario uppercase tracking-wide">Vendido</span>
          </div>
          <p className={`text-lg font-bold leading-tight ${ordenesCantidadMes > 0 ? 'text-insignia-exito-texto' : 'text-texto-secundario'}`}>
            {formatoMoneda(ordenesMontoMes)}
          </p>
          <p className="text-xxs text-texto-terciario">{ordenesCantidadMes} orden{ordenesCantidadMes !== 1 ? 'es' : ''}</p>
          <Variacion actual={ordenesMontoMes} anterior={ordenesMontoMesAnterior} esMonto formatoMoneda={formatoMoneda} />
        </div>

        {/* Presupuestado */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <FileText size={12} className="text-insignia-info-texto" />
            <span className="text-xxs text-texto-terciario uppercase tracking-wide">Presupuestado</span>
          </div>
          <p className="text-lg font-bold text-texto-primario leading-tight">{presupuestosNuevosMes}</p>
          <p className="text-xxs text-texto-terciario">emitidos este mes</p>
          <Variacion actual={presupuestosNuevosMes} anterior={presupuestosNuevosMesAnterior} />
        </div>

        {/* Contactos nuevos */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={12} className="text-insignia-primario-texto" />
            <span className="text-xxs text-texto-terciario uppercase tracking-wide">Contactos</span>
          </div>
          <p className="text-lg font-bold text-texto-primario leading-tight">+{contactosNuevosMes}</p>
          <p className="text-xxs text-texto-terciario">nuevos este mes</p>
          <Variacion actual={contactosNuevosMes} anterior={contactosNuevosMesAnterior} />
        </div>

        {/* Actividades */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <CheckSquare size={12} className="text-insignia-exito-texto" />
            <span className="text-xxs text-texto-terciario uppercase tracking-wide">Actividades</span>
          </div>
          <p className="text-lg font-bold text-texto-primario leading-tight">{actividadesPendientes}</p>
          <p className="text-xxs text-texto-terciario">pendientes</p>
          {actividadesCompletadasHoy > 0 && (
            <span className="text-xxs text-insignia-exito-texto flex items-center gap-0.5 mt-0.5">
              <TrendingUp size={10} />{actividadesCompletadasHoy} hoy
            </span>
          )}
        </div>
      </div>

      {/* Alertas (si hay) */}
      {alertas.length > 0 && (
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-borde-sutil">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-center gap-1 text-xs ${a.color}`}>
              {a.icono}
              <span>{a.texto}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

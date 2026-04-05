'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, Clock, Mail,
} from 'lucide-react'

/**
 * ResumenInteligente — Indicadores rápidos del mes actual.
 * Formato: íconos + textos cortos con color semántico.
 * Se lee en 3 segundos sin esfuerzo.
 */

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

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

export function ResumenInteligente(props: Props) {
  const {
    presupuestosBorradores,
    ordenesMontoMes, ordenesMontoMesAnterior, ordenesCantidadMes,
    actividadesVencidas, actividadesCompletadasHoy,
    conversacionesSinLeer, presupuestosPorVencer, formatoMoneda,
  } = props

  const hoy = new Date()
  const diaDelMes = hoy.getDate()
  const mesNombre = MESES[hoy.getMonth()]

  const alertas = useMemo(() => {
    const items: Array<{ icono: React.ReactNode; texto: string; color: 'rojo' | 'verde' | 'amarillo' | 'gris' }> = []

    // ─── Ventas ───
    if (ordenesCantidadMes > 0) {
      items.push({
        icono: <TrendingUp size={14} />,
        texto: `${formatoMoneda(ordenesMontoMes)} vendido (${ordenesCantidadMes})`,
        color: 'verde',
      })
    }

    // ─── Alertas urgentes ───
    if (actividadesVencidas > 0) {
      items.push({
        icono: <AlertTriangle size={14} />,
        texto: `${actividadesVencidas} vencida${actividadesVencidas > 1 ? 's' : ''}`,
        color: 'rojo',
      })
    }

    if (presupuestosPorVencer > 0) {
      items.push({
        icono: <Clock size={14} />,
        texto: `${presupuestosPorVencer} por vencer`,
        color: 'amarillo',
      })
    }

    if (presupuestosBorradores > 0) {
      items.push({
        icono: <Clock size={14} />,
        texto: `${presupuestosBorradores} borrador${presupuestosBorradores > 1 ? 'es' : ''}`,
        color: 'gris',
      })
    }

    if (conversacionesSinLeer > 0) {
      items.push({
        icono: <Mail size={14} />,
        texto: `${conversacionesSinLeer} sin leer`,
        color: conversacionesSinLeer > 5 ? 'amarillo' : 'gris',
      })
    }

    if (actividadesCompletadasHoy > 0) {
      items.push({
        icono: <CheckCircle2 size={14} />,
        texto: `${actividadesCompletadasHoy} completada${actividadesCompletadasHoy > 1 ? 's' : ''} hoy`,
        color: 'verde',
      })
    }

    return items
  }, [
    ordenesCantidadMes, ordenesMontoMes, formatoMoneda,
    actividadesVencidas, actividadesCompletadasHoy,
    presupuestosBorradores, presupuestosPorVencer, conversacionesSinLeer,
  ])

  if (alertas.length === 0) return null

  const ESTILOS = {
    rojo: 'text-insignia-peligro-texto bg-insignia-peligro-fondo/60',
    verde: 'text-insignia-exito-texto bg-insignia-exito-fondo/60',
    amarillo: 'text-insignia-advertencia-texto bg-insignia-advertencia-fondo/60',
    gris: 'text-texto-terciario bg-superficie-hover',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 flex-wrap"
    >
      <span className="text-xxs text-texto-terciario font-medium shrink-0">{mesNombre} {diaDelMes}:</span>
      {alertas.map((a, i) => (
        <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${ESTILOS[a.color]}`}>
          {a.icono}
          <span>{a.texto}</span>
        </div>
      ))}
    </motion.div>
  )
}

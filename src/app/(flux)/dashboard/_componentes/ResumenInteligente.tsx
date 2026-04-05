'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, Clock, MessageSquare,
} from 'lucide-react'

/**
 * ResumenInteligente — Resumen visual del mes actual.
 * Muestra indicadores clave con colores, flechas y contexto breve.
 * Se lee de un vistazo — no es un párrafo.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

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
    contactosNuevosMes, contactosNuevosMesAnterior,
    presupuestosNuevosMes, presupuestosNuevosMesAnterior, presupuestosBorradores,
    ordenesMontoMes, ordenesMontoMesAnterior, ordenesCantidadMes,
    actividadesPendientes, actividadesVencidas, actividadesCompletadasHoy,
    conversacionesSinLeer, presupuestosPorVencer, formatoMoneda,
  } = props

  const mesActual = MESES[new Date().getMonth()]

  // Puntos de atención (alertas + logros)
  const puntos = useMemo(() => {
    const items: Array<{ tipo: 'alerta' | 'logro' | 'info'; icono: React.ReactNode; texto: string }> = []

    // Ventas del mes
    if (ordenesCantidadMes > 0) {
      const dif = ordenesMontoMes - ordenesMontoMesAnterior
      items.push({
        tipo: dif >= 0 ? 'logro' : 'info',
        icono: dif >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />,
        texto: `${ordenesCantidadMes} venta${ordenesCantidadMes > 1 ? 's' : ''} por ${formatoMoneda(ordenesMontoMes)} en ${mesActual}${
          ordenesMontoMesAnterior > 0
            ? dif >= 0 ? ` (+${formatoMoneda(dif)} vs mes anterior)` : ` (${formatoMoneda(dif)} vs mes anterior)`
            : ''
        }`,
      })
    } else if (ordenesMontoMesAnterior > 0) {
      items.push({
        tipo: 'alerta',
        icono: <AlertTriangle size={14} />,
        texto: `Sin ventas cerradas en ${mesActual} — el mes pasado fueron ${formatoMoneda(ordenesMontoMesAnterior)}`,
      })
    }

    // Presupuestos por vencer
    if (presupuestosPorVencer > 0) {
      items.push({
        tipo: 'alerta',
        icono: <Clock size={14} />,
        texto: `${presupuestosPorVencer} presupuesto${presupuestosPorVencer > 1 ? 's' : ''} vence${presupuestosPorVencer > 1 ? 'n' : ''} en 7 días`,
      })
    }

    // Borradores pendientes
    if (presupuestosBorradores > 0) {
      items.push({
        tipo: 'info',
        icono: <Clock size={14} />,
        texto: `${presupuestosBorradores} borrador${presupuestosBorradores > 1 ? 'es' : ''} pendiente${presupuestosBorradores > 1 ? 's' : ''} de enviar`,
      })
    }

    // Actividades vencidas
    if (actividadesVencidas > 0) {
      items.push({
        tipo: 'alerta',
        icono: <AlertTriangle size={14} />,
        texto: `${actividadesVencidas} actividad${actividadesVencidas > 1 ? 'es' : ''} vencida${actividadesVencidas > 1 ? 's' : ''}`,
      })
    }

    // Completadas hoy
    if (actividadesCompletadasHoy > 0) {
      items.push({
        tipo: 'logro',
        icono: <CheckCircle2 size={14} />,
        texto: `${actividadesCompletadasHoy} actividad${actividadesCompletadasHoy > 1 ? 'es' : ''} completada${actividadesCompletadasHoy > 1 ? 's' : ''} hoy`,
      })
    }

    // Inbox sin leer
    if (conversacionesSinLeer > 3) {
      items.push({
        tipo: 'info',
        icono: <MessageSquare size={14} />,
        texto: `${conversacionesSinLeer} conversaciones sin leer`,
      })
    }

    // Contactos nuevos
    if (contactosNuevosMes > 0) {
      const dif = contactosNuevosMes - contactosNuevosMesAnterior
      items.push({
        tipo: dif >= 0 ? 'logro' : 'info',
        icono: dif >= 0 ? <TrendingUp size={14} /> : <Minus size={14} />,
        texto: `+${contactosNuevosMes} contacto${contactosNuevosMes > 1 ? 's' : ''} nuevo${contactosNuevosMes > 1 ? 's' : ''}${
          contactosNuevosMesAnterior > 0 ? ` (${dif >= 0 ? '+' : ''}${dif} vs mes anterior)` : ''
        }`,
      })
    }

    return items
  }, [
    mesActual, contactosNuevosMes, contactosNuevosMesAnterior,
    presupuestosNuevosMes, presupuestosNuevosMesAnterior, presupuestosBorradores,
    ordenesMontoMes, ordenesMontoMesAnterior, ordenesCantidadMes,
    actividadesPendientes, actividadesVencidas, actividadesCompletadasHoy,
    conversacionesSinLeer, presupuestosPorVencer, formatoMoneda,
  ])

  if (puntos.length === 0) return null

  const COLORES_TIPO = {
    alerta: 'text-insignia-peligro-texto bg-insignia-peligro-fondo',
    logro: 'text-insignia-exito-texto bg-insignia-exito-fondo',
    info: 'text-texto-terciario bg-superficie-hover',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-superficie-tarjeta border border-borde-sutil rounded-lg px-5 py-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="size-6 rounded-md bg-texto-marca/10 flex items-center justify-center">
          <Sparkles size={12} className="text-texto-marca" />
        </div>
        <span className="text-xs font-semibold text-texto-primario capitalize">{mesActual} — puntos clave</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {puntos.map((p, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${COLORES_TIPO[p.tipo]}`}
          >
            {p.icono}
            <span>{p.texto}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

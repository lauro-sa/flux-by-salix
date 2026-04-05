'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

/**
 * ResumenInteligente — Párrafo generado a partir de los datos del dashboard.
 * Analiza presupuestos, ventas, contactos, actividades e inbox para dar
 * un panorama rápido del estado del negocio sin tener que mirar cada widget.
 *
 * No usa IA — es lógica determinística basada en comparaciones y umbrales.
 * Esto es más rápido, más barato, y siempre predecible.
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
    conversacionesAbiertas, conversacionesSinLeer,
    presupuestosPorVencer,
    formatoMoneda,
  } = props

  const mesActual = MESES[new Date().getMonth()]
  const mesAnterior = MESES[new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1]

  const parrafos = useMemo(() => {
    const lineas: string[] = []

    // ─── Ventas / Órdenes ───
    if (ordenesCantidadMes > 0) {
      const difMonto = ordenesMontoMes - ordenesMontoMesAnterior
      if (ordenesMontoMesAnterior > 0) {
        const pct = Math.round((difMonto / ordenesMontoMesAnterior) * 100)
        if (pct > 0) {
          lineas.push(`En ${mesActual} cerraste ${ordenesCantidadMes} venta${ordenesCantidadMes > 1 ? 's' : ''} por ${formatoMoneda(ordenesMontoMes)}, un ${pct}% más que en ${mesAnterior}.`)
        } else if (pct < -10) {
          lineas.push(`En ${mesActual} llevas ${ordenesCantidadMes} venta${ordenesCantidadMes > 1 ? 's' : ''} por ${formatoMoneda(ordenesMontoMes)}. Comparado con ${mesAnterior} (${formatoMoneda(ordenesMontoMesAnterior)}), bajó un ${Math.abs(pct)}%.`)
        } else {
          lineas.push(`En ${mesActual} cerraste ${ordenesCantidadMes} venta${ordenesCantidadMes > 1 ? 's' : ''} por ${formatoMoneda(ordenesMontoMes)}, similar a ${mesAnterior}.`)
        }
      } else {
        lineas.push(`En ${mesActual} cerraste ${ordenesCantidadMes} venta${ordenesCantidadMes > 1 ? 's' : ''} por ${formatoMoneda(ordenesMontoMes)}.`)
      }
    } else {
      if (ordenesMontoMesAnterior > 0) {
        lineas.push(`Todavía no cerraste ventas en ${mesActual}. En ${mesAnterior} habías facturado ${formatoMoneda(ordenesMontoMesAnterior)}.`)
      }
    }

    // ─── Presupuestos ───
    if (presupuestosNuevosMes > 0) {
      let textoPresup = `Emitiste ${presupuestosNuevosMes} presupuesto${presupuestosNuevosMes > 1 ? 's' : ''} este mes`
      if (presupuestosNuevosMesAnterior > 0) {
        const difPresup = presupuestosNuevosMes - presupuestosNuevosMesAnterior
        if (difPresup > 0) textoPresup += ` (+${difPresup} vs ${mesAnterior})`
        else if (difPresup < 0) textoPresup += ` (${difPresup} vs ${mesAnterior})`
      }
      textoPresup += '.'
      if (presupuestosBorradores > 0) {
        textoPresup += ` Tenés ${presupuestosBorradores} en borrador pendiente${presupuestosBorradores > 1 ? 's' : ''} de enviar.`
      }
      lineas.push(textoPresup)
    }

    // ─── Por vencer (urgente) ───
    if (presupuestosPorVencer > 0) {
      lineas.push(`⚠ ${presupuestosPorVencer} presupuesto${presupuestosPorVencer > 1 ? 's' : ''} enviado${presupuestosPorVencer > 1 ? 's' : ''} vence${presupuestosPorVencer > 1 ? 'n' : ''} en los próximos 7 días — revisalos para no perder esas oportunidades.`)
    }

    // ─── Contactos ───
    if (contactosNuevosMes > 0) {
      let textoContactos = `Sumaste ${contactosNuevosMes} contacto${contactosNuevosMes > 1 ? 's' : ''} nuevo${contactosNuevosMes > 1 ? 's' : ''}`
      if (contactosNuevosMesAnterior > 0) {
        const dif = contactosNuevosMes - contactosNuevosMesAnterior
        if (dif > 0) textoContactos += `, ${dif} más que el mes pasado`
        else if (dif < 0) textoContactos += `, ${Math.abs(dif)} menos que el mes pasado`
      }
      textoContactos += '.'
      lineas.push(textoContactos)
    }

    // ─── Actividades ───
    if (actividadesVencidas > 0) {
      lineas.push(`Tenés ${actividadesVencidas} actividad${actividadesVencidas > 1 ? 'es' : ''} vencida${actividadesVencidas > 1 ? 's' : ''} que necesitan atención.`)
    } else if (actividadesPendientes > 0) {
      let textoAct = `${actividadesPendientes} actividad${actividadesPendientes > 1 ? 'es' : ''} pendiente${actividadesPendientes > 1 ? 's' : ''}`
      if (actividadesCompletadasHoy > 0) {
        textoAct += ` (completaste ${actividadesCompletadasHoy} hoy)`
      }
      textoAct += '.'
      lineas.push(textoAct)
    }

    // ─── Inbox ───
    if (conversacionesSinLeer > 3) {
      lineas.push(`Tenés ${conversacionesSinLeer} conversaciones sin leer en el inbox.`)
    } else if (conversacionesAbiertas > 0 && conversacionesSinLeer === 0) {
      lineas.push(`Inbox al día — ${conversacionesAbiertas} conversacion${conversacionesAbiertas > 1 ? 'es' : ''} abierta${conversacionesAbiertas > 1 ? 's' : ''}, todo leído.`)
    }

    return lineas
  }, [
    mesActual, mesAnterior,
    contactosNuevosMes, contactosNuevosMesAnterior,
    presupuestosNuevosMes, presupuestosNuevosMesAnterior, presupuestosBorradores,
    ordenesMontoMes, ordenesMontoMesAnterior, ordenesCantidadMes,
    actividadesPendientes, actividadesVencidas, actividadesCompletadasHoy,
    conversacionesAbiertas, conversacionesSinLeer,
    presupuestosPorVencer, formatoMoneda,
  ])

  if (parrafos.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-superficie-tarjeta border border-borde-sutil rounded-lg px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <div className="size-7 rounded-lg bg-texto-marca/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={14} className="text-texto-marca" />
        </div>
        <div className="text-sm text-texto-secundario leading-relaxed space-y-1">
          {parrafos.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

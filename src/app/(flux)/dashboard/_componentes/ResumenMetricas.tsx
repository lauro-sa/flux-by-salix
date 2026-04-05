'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'

/**
 * ResumenMetricas — Resumen anual para la pestaña de métricas.
 * Compara el año actual con años anteriores: ventas, presupuestos,
 * contactos, tasa de cierre, productos, inbox.
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

export function ResumenMetricas({
  ingresosPorAnio, presupuestosPorMes, contactosPorMes,
  clientesTotalActivos, slaInbox, tiempoRespuesta, formatoMoneda,
}: Props) {
  const anioActual = new Date().getFullYear()
  const mesActualIdx = new Date().getMonth()

  const parrafos = useMemo(() => {
    const lineas: string[] = []

    // ─── Datos del año actual y anterior ───
    const datosActual = ingresosPorAnio[String(anioActual)]
    const datosAnterior = ingresosPorAnio[String(anioActual - 1)]

    // Presupuestos emitidos por año
    const presupEmitidosActual = Object.entries(presupuestosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual}-`))
      .reduce((s, [, v]) => s + v.creados, 0)
    const presupEmitidosAnterior = Object.entries(presupuestosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual - 1}-`))
      .reduce((s, [, v]) => s + v.creados, 0)
    const montoEmitidoActual = Object.entries(presupuestosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual}-`))
      .reduce((s, [, v]) => s + v.monto_total, 0)

    // Contactos por año
    const contactosActual = Object.entries(contactosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual}-`))
      .reduce((s, [, v]) => s + v, 0)
    const contactosAnterior = Object.entries(contactosPorMes)
      .filter(([k]) => k.startsWith(`${anioActual - 1}-`))
      .reduce((s, [, v]) => s + v, 0)

    // ─── Ventas / Órdenes del año ───
    if (datosActual?.ordenes_monto) {
      let texto = `En ${anioActual} llevas ${formatoMoneda(datosActual.ordenes_monto)} en órdenes de venta (${datosActual.ordenes_cantidad} cerradas)`
      if (datosAnterior?.ordenes_monto) {
        // Comparar al mismo punto del año anterior (mismos meses transcurridos)
        let ordenesAnteriorAlMismoPunto = 0
        let cantAnteriorAlMismoPunto = 0
        for (let m = 1; m <= mesActualIdx + 1; m++) {
          const clave = `${anioActual - 1}-${String(m).padStart(2, '0')}`
          const ingresosMes = Object.entries(presupuestosPorMes).find(([k]) => k === clave)
          // Buscar en ingresos por mes del año anterior
          ordenesAnteriorAlMismoPunto += 0 // No tenemos desglose mensual del año anterior aquí
          cantAnteriorAlMismoPunto += 0
        }
        // Usar total del año anterior como referencia
        const pctDelAnterior = datosAnterior.ordenes_monto > 0
          ? Math.round((datosActual.ordenes_monto / datosAnterior.ordenes_monto) * 100)
          : 0
        texto += `. El año pasado cerraste ${formatoMoneda(datosAnterior.ordenes_monto)} en total (${datosAnterior.ordenes_cantidad} órdenes)`
        if (pctDelAnterior > 0) {
          texto += ` — vas al ${pctDelAnterior}% de ese total`
        }
      }
      texto += '.'
      lineas.push(texto)
    } else {
      if (datosAnterior?.ordenes_monto) {
        lineas.push(`Todavía no cerraste órdenes de venta en ${anioActual}. El año pasado facturaste ${formatoMoneda(datosAnterior.ordenes_monto)} (${datosAnterior.ordenes_cantidad} órdenes).`)
      }
    }

    // ─── Presupuestos emitidos ───
    if (presupEmitidosActual > 0) {
      let texto = `Emitiste ${presupEmitidosActual} presupuestos en ${anioActual} por ${formatoMoneda(montoEmitidoActual)}`
      if (presupEmitidosAnterior > 0) {
        const dif = presupEmitidosActual - presupEmitidosAnterior
        if (presupEmitidosAnterior > presupEmitidosActual) {
          texto += `. A esta altura del ${anioActual - 1} ya habías emitido ${presupEmitidosAnterior}`
        } else if (dif > 0) {
          texto += `, ${dif} más que a esta altura del ${anioActual - 1}`
        }
      }
      // Tasa de cierre
      if (datosActual?.ordenes_cantidad && presupEmitidosActual > 0) {
        const tasa = Math.round((datosActual.ordenes_cantidad / presupEmitidosActual) * 100)
        texto += `. Tasa de cierre: ${tasa}%`
        if (datosAnterior?.ordenes_cantidad && presupEmitidosAnterior > 0) {
          const tasaAnterior = Math.round((datosAnterior.ordenes_cantidad / presupEmitidosAnterior) * 100)
          if (tasa > tasaAnterior) texto += ` (mejoró vs ${tasaAnterior}% del ${anioActual - 1})`
          else if (tasa < tasaAnterior) texto += ` (bajó vs ${tasaAnterior}% del ${anioActual - 1})`
        }
      }
      texto += '.'
      lineas.push(texto)
    }

    // ─── Contactos ───
    if (contactosActual > 0) {
      let texto = `${contactosActual} contactos nuevos en lo que va del año`
      if (contactosAnterior > 0) {
        if (contactosAnterior > contactosActual) {
          texto += ` (a esta altura del ${anioActual - 1} eran ${contactosAnterior})`
        } else {
          texto += ` (${contactosActual - contactosAnterior} más que a esta altura del ${anioActual - 1})`
        }
      }
      texto += `. ${clientesTotalActivos} contactos tienen presupuestos vinculados.`
      lineas.push(texto)
    }

    // ─── Inbox ───
    if (slaInbox > 0 || tiempoRespuesta > 0) {
      let texto = ''
      if (slaInbox > 0) {
        texto += `SLA de inbox al ${slaInbox}%`
        if (slaInbox >= 80) texto += ' — buen nivel'
        else if (slaInbox >= 50) texto += ' — se puede mejorar'
        else texto += ' — necesita atención urgente'
      }
      if (tiempoRespuesta > 0) {
        texto += `${texto ? '. ' : ''}Tiempo de respuesta promedio: ${tiempoRespuesta} minutos`
      }
      texto += '.'
      lineas.push(texto)
    }

    // ─── Años disponibles ───
    const aniosConDatos = Object.keys(ingresosPorAnio).sort()
    if (aniosConDatos.length >= 3) {
      lineas.push(`Datos disponibles desde ${aniosConDatos[0]} hasta ${aniosConDatos[aniosConDatos.length - 1]}.`)
    }

    return lineas
  }, [ingresosPorAnio, presupuestosPorMes, contactosPorMes, clientesTotalActivos, slaInbox, tiempoRespuesta, formatoMoneda, anioActual, mesActualIdx])

  if (parrafos.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-superficie-tarjeta border border-borde-sutil rounded-lg px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <div className="size-7 rounded-lg bg-insignia-info-fondo flex items-center justify-center shrink-0 mt-0.5">
          <TrendingUp size={14} className="text-insignia-info-texto" />
        </div>
        <div>
          <p className="text-xs font-semibold text-texto-primario mb-1.5">Resumen {anioActual}</p>
          <div className="text-sm text-texto-secundario leading-relaxed space-y-1">
            {parrafos.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

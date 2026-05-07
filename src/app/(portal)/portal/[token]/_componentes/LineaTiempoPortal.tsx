'use client'

/**
 * LineaTiempoPortal — Timeline visual del estado del presupuesto en el portal.
 * Pre-aceptación: muestra pasos hasta la firma.
 * Post-aceptación: muestra timeline de pagos por cuota con estados.
 * Se actualiza en vivo via polling.
 * Se usa en: VistaPortal
 */

import { Check, Clock, FileSignature, CreditCard, CircleDollarSign, PackageCheck } from 'lucide-react'
import { formatearNumero } from '@/lib/pdf/renderizar-html'
import { useTraduccion } from '@/lib/i18n'
import type { EstadoPortal } from '@/tipos/portal'
import type { CuotaPago } from '@/tipos/presupuesto'
import { EstadosCuota } from '@/tipos/cuota'
import type { ComprobantePortal } from '@/tipos/portal'

interface Props {
  estadoCliente: EstadoPortal
  cuotas: CuotaPago[]
  comprobantes: ComprobantePortal[]
  monedaSimbolo: string
  totalFinal: string
  colorMarca: string
  estadoPresupuesto?: string
}

// ─── Paso de la timeline ───
interface Paso {
  id: string
  etiqueta: string
  descripcion?: string
  estado: 'completado' | 'activo' | 'pendiente'
  icono: React.ReactNode
  detalle?: string
}

export default function LineaTiempoPortal({
  estadoCliente,
  cuotas,
  comprobantes,
  monedaSimbolo,
  totalFinal,
  colorMarca,
  estadoPresupuesto,
}: Props) {
  const { t } = useTraduccion()

  const estaAceptado = estadoCliente === 'aceptado'
  const estaRechazado = estadoCliente === 'rechazado'

  // ── Pre-aceptación ──
  if (!estaAceptado && !estaRechazado) {
    const pasos: Paso[] = [
      {
        id: 'enviado',
        etiqueta: t('portal.timeline_enviado'),
        estado: 'completado',
        icono: <Check size={14} />,
      },
      {
        id: 'revisado',
        etiqueta: t('portal.timeline_revisado'),
        estado: estadoCliente === 'visto' || estadoCliente === 'pendiente' ? 'completado' : 'pendiente',
        icono: <Check size={14} />,
      },
      {
        id: 'aceptar',
        etiqueta: t('portal.timeline_aceptar_firmar'),
        descripcion: t('portal.timeline_aceptar_instruccion'),
        estado: 'activo',
        icono: <FileSignature size={14} />,
      },
    ]

    return <TimelineVertical pasos={pasos} colorMarca={colorMarca} />
  }

  // ── Rechazado ──
  if (estaRechazado) {
    return null // No mostrar timeline si rechazó
  }

  // ── Post-aceptación: timeline de pagos ──
  const tieneCuotas = cuotas.length > 1
  const esOrdenVenta = estadoPresupuesto === 'orden_venta'

  // Resolver estado de cada cuota mirando comprobantes
  const estadoCuota = (cuota: CuotaPago) => {
    const comprobantesCuota = comprobantes.filter(c => c.cuota_id === cuota.id)
    const confirmado = comprobantesCuota.some(c => c.estado === 'confirmado')
    const pendienteRevision = comprobantesCuota.some(c => c.estado === 'pendiente')

    if (cuota.estado === EstadosCuota.COBRADA || confirmado) return 'confirmado' as const
    if (pendienteRevision) return 'en_revision' as const
    return 'pendiente' as const
  }

  // Para pago único (sin cuotas)
  const comprobantesTotales = comprobantes.filter(c => !c.cuota_id)
  const pagoUnicoConfirmado = comprobantesTotales.some(c => c.estado === 'confirmado')
  const pagoUnicoPendiente = comprobantesTotales.some(c => c.estado === 'pendiente')

  const pasos: Paso[] = [
    // Paso 1: Aceptado
    {
      id: 'aceptado',
      etiqueta: t('portal.timeline_aceptado'),
      descripcion: t('portal.timeline_firmado_digital'),
      estado: 'completado',
      icono: <Check size={14} />,
    },
  ]

  if (tieneCuotas) {
    // Pasos por cuota
    cuotas.forEach((cuota, i) => {
      const est = estadoCuota(cuota)
      const etiqueta = cuota.descripcion
        || (i === 0 ? t('portal.adelanto') : i === cuotas.length - 1 ? t('portal.pago_final') : `${t('portal.cuota')} ${i}`)

      // Encontrar el primer paso pendiente para marcarlo como activo
      const primerPendiente = pasos.every(p => p.estado === 'completado')

      let estadoPaso: Paso['estado'] = 'pendiente'
      if (est === 'confirmado') {
        estadoPaso = 'completado'
      } else if (est === 'en_revision') {
        estadoPaso = 'activo'
      } else if (primerPendiente || pasos[pasos.length - 1]?.estado === 'completado') {
        estadoPaso = 'activo'
      }

      pasos.push({
        id: cuota.id,
        etiqueta: `${etiqueta} (${cuota.porcentaje}%)`,
        detalle: `${monedaSimbolo} ${formatearNumero(cuota.monto)}`,
        descripcion: est === 'confirmado'
          ? t('portal.timeline_pago_confirmado')
          : est === 'en_revision'
            ? t('portal.timeline_comprobante_revision')
            : t('portal.timeline_pendiente_pago'),
        estado: estadoPaso,
        icono: est === 'confirmado'
          ? <Check size={14} />
          : est === 'en_revision'
            ? <Clock size={14} />
            : <CreditCard size={14} />,
      })
    })
  } else {
    // Pago único
    let estadoPago: Paso['estado'] = 'activo'
    let descripcionPago = t('portal.timeline_pendiente_pago')
    if (pagoUnicoConfirmado) {
      estadoPago = 'completado'
      descripcionPago = t('portal.timeline_pago_confirmado')
    } else if (pagoUnicoPendiente) {
      estadoPago = 'activo'
      descripcionPago = t('portal.timeline_comprobante_revision')
    }

    pasos.push({
      id: 'pago',
      etiqueta: t('portal.pago'),
      detalle: `${monedaSimbolo} ${formatearNumero(totalFinal)}`,
      descripcion: descripcionPago,
      estado: estadoPago,
      icono: estadoPago === 'completado'
        ? <Check size={14} />
        : pagoUnicoPendiente
          ? <Clock size={14} />
          : <CircleDollarSign size={14} />,
    })
  }

  // Paso final: Trabajo completado
  pasos.push({
    id: 'completado',
    etiqueta: esOrdenVenta ? t('portal.timeline_orden_confirmada') : t('portal.timeline_orden_trabajo'),
    descripcion: esOrdenVenta
      ? t('portal.timeline_pagos_completos')
      : t('portal.timeline_confirma_pagos'),
    estado: esOrdenVenta ? 'completado' : 'pendiente',
    icono: esOrdenVenta ? <Check size={14} /> : <PackageCheck size={14} />,
  })

  return <TimelineVertical pasos={pasos} colorMarca={colorMarca} />
}

// ─── Timeline vertical reutilizable ───
function TimelineVertical({ pasos, colorMarca }: { pasos: Paso[]; colorMarca: string }) {
  return (
    <div className="bg-superficie-tarjeta rounded-card border border-borde-sutil px-5 py-4">
      <div className="flex flex-col">
        {pasos.map((paso, i) => {
          const esUltimo = i === pasos.length - 1

          const colorCirculo =
            paso.estado === 'completado'
              ? 'bg-insignia-exito text-white'
              : paso.estado === 'activo'
                ? 'text-white'
                : 'bg-superficie-hover text-texto-terciario'

          const styleCirculo = paso.estado === 'activo'
            ? { backgroundColor: colorMarca }
            : undefined

          return (
            <div key={paso.id} className="flex gap-3">
              {/* Línea y punto */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center size-7 rounded-full shrink-0 ${colorCirculo}`}
                  style={styleCirculo}
                >
                  {paso.icono}
                </div>
                {!esUltimo && (
                  <div className={`w-0.5 flex-1 my-1 min-h-[20px] ${
                    paso.estado === 'completado' ? 'bg-insignia-exito/40' : 'bg-borde-sutil'
                  }`} />
                )}
              </div>

              {/* Contenido */}
              <div className={`pb-5 pt-0.5 flex-1 min-w-0 ${esUltimo ? 'pb-0' : ''}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`text-sm font-medium ${
                    paso.estado === 'completado'
                      ? 'text-texto-primario'
                      : paso.estado === 'activo'
                        ? 'text-texto-primario'
                        : 'text-texto-terciario'
                  }`}>
                    {paso.etiqueta}
                  </p>
                  {paso.detalle && (
                    <span className={`text-sm font-mono font-medium shrink-0 ${
                      paso.estado === 'completado'
                        ? 'text-insignia-exito'
                        : paso.estado === 'activo'
                          ? 'text-texto-primario'
                          : 'text-texto-terciario'
                    }`}>
                      {paso.detalle}
                    </span>
                  )}
                </div>
                {paso.descripcion && (
                  <p className={`text-xs mt-0.5 ${
                    paso.estado === 'activo' ? 'text-texto-secundario' : 'text-texto-terciario'
                  }`}>
                    {paso.descripcion}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

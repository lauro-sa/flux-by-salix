'use client'

/**
 * InfoDocumento — Información del presupuesto: estado, número, total prominente,
 * fechas, referencia, vendedor, contacto.
 * Se usa en: VistaPortal
 */

import { Clock, Eye, Check, X, AlertTriangle } from 'lucide-react'
import { formatearFecha, formatearNumero } from '@/lib/pdf/renderizar-html'
import { useTraduccion } from '@/lib/i18n'
import type { EstadoPortal } from '@/tipos/portal'

interface Props {
  presupuesto: {
    numero: string
    estado: string
    fecha_emision: string
    fecha_vencimiento: string | null
    condicion_pago_label: string | null
    referencia: string | null
    total_final: string
    contacto_nombre: string | null
    contacto_apellido: string | null
    contacto_identificacion: string | null
    contacto_direccion: string | null
    contacto_correo: string | null
    atencion_nombre: string | null
    atencion_cargo: string | null
    atencion_correo: string | null
  }
  vendedorNombre: string
  monedaSimbolo: string
  estadoCliente: EstadoPortal
  colorMarca: string
}

const BADGES_ESTADO: Record<EstadoPortal, { icono: typeof Clock; clase: string; label: string }> = {
  pendiente: { icono: Clock, clase: 'bg-estado-pendiente/10 text-estado-pendiente', label: 'estado_pendiente' },
  visto: { icono: Eye, clase: 'bg-insignia-info/10 text-insignia-info', label: 'estado_visto' },
  aceptado: { icono: Check, clase: 'bg-insignia-exito/10 text-insignia-exito', label: 'estado_aceptado' },
  rechazado: { icono: X, clase: 'bg-estado-error/10 text-estado-error', label: 'estado_rechazado' },
  cancelado: { icono: AlertTriangle, clase: 'bg-texto-terciario/10 text-texto-terciario', label: 'cancelado' },
}

export default function InfoDocumento({ presupuesto, vendedorNombre, monedaSimbolo, estadoCliente, colorMarca }: Props) {
  const { t } = useTraduccion()
  const nombreContacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido]
    .filter(Boolean).join(' ')

  const badge = BADGES_ESTADO[estadoCliente] || BADGES_ESTADO.pendiente
  const IconoEstado = badge.icono

  return (
    <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">
      {/* Franja de color marca arriba */}
      <div className="h-1" style={{ backgroundColor: colorMarca }} />

      <div className="p-5 space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${colorMarca}15`, color: colorMarca }}
          >
            {t('portal.presupuesto')}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${badge.clase}`}>
            <IconoEstado size={12} />
            {t(`portal.${badge.label}`)}
          </span>
        </div>

        {/* Número + Total prominente */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h2 className="text-2xl sm:text-3xl font-bold text-texto-primario">
            {t('portal.presupuesto')} N&deg; {presupuesto.numero}
          </h2>
          <div className="text-right">
            <p className="text-xs text-texto-terciario uppercase tracking-wider">{t('portal.total')}</p>
            <p className="text-2xl sm:text-3xl font-bold" style={{ color: colorMarca }}>
              {monedaSimbolo} {formatearNumero(presupuesto.total_final)}
            </p>
          </div>
        </div>

        {/* Grid de datos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-texto-terciario">{t('portal.emitido')}</span>
            <p className="text-texto-primario font-medium">{formatearFecha(presupuesto.fecha_emision)}</p>
          </div>
          {presupuesto.fecha_vencimiento && (
            <div>
              <span className="text-texto-terciario">{t('portal.vencimiento')}</span>
              <p className="text-texto-primario font-medium">{formatearFecha(presupuesto.fecha_vencimiento)}</p>
            </div>
          )}
          {presupuesto.condicion_pago_label && (
            <div>
              <span className="text-texto-terciario">{t('portal.pago')}</span>
              <p className="text-texto-primario font-medium">{presupuesto.condicion_pago_label}</p>
            </div>
          )}
          {presupuesto.referencia && (
            <div>
              <span className="text-texto-terciario">{t('portal.referencia')}</span>
              <p className="text-texto-primario font-medium">{presupuesto.referencia}</p>
            </div>
          )}
          <div>
            <span className="text-texto-terciario">{t('portal.vendedor')}</span>
            <p className="text-texto-primario font-medium">{vendedorNombre}</p>
          </div>
        </div>

        {/* Separador */}
        <hr className="border-borde-sutil" />

        {/* Para quién */}
        <div className="space-y-2">
          {nombreContacto && (
            <div>
              <span className="text-xs text-texto-terciario uppercase tracking-wider">{t('portal.para')}</span>
              <p className="text-sm font-medium text-texto-primario mt-0.5">{nombreContacto}</p>
              {presupuesto.contacto_identificacion && (
                <p className="text-xs text-texto-secundario">{presupuesto.contacto_identificacion}</p>
              )}
              {presupuesto.contacto_direccion && (
                <p className="text-xs text-texto-secundario">{presupuesto.contacto_direccion}</p>
              )}
              {presupuesto.contacto_correo && (
                <p className="text-xs text-texto-secundario">{presupuesto.contacto_correo}</p>
              )}
            </div>
          )}

          {presupuesto.atencion_nombre && (
            <div className="mt-2">
              <span className="text-xs text-texto-terciario uppercase tracking-wider">{t('portal.dirigido_a')}</span>
              <p className="text-sm font-medium text-texto-primario mt-0.5">{presupuesto.atencion_nombre}</p>
              {presupuesto.atencion_cargo && (
                <p className="text-xs text-texto-secundario">{presupuesto.atencion_cargo}</p>
              )}
              {presupuesto.atencion_correo && (
                <p className="text-xs text-texto-secundario">{presupuesto.atencion_correo}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

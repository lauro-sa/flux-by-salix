'use client'

/**
 * InfoDocumento — Información del presupuesto estilo portal profesional.
 * Layout: badges (tipo izq + estado der) → número grande → grid datos →
 * separador → grid contacto (nombre | CUIT | dirección).
 * Se usa en: VistaPortal
 */

import { Clock, Eye, Check, X, AlertTriangle } from 'lucide-react'
import { formatearFecha } from '@/lib/pdf/renderizar-html'
import { useTraduccion } from '@/lib/i18n'
import type { EstadoPortal } from '@/tipos/portal'

interface Props {
  presupuesto: {
    numero: string
    estado: string
    fecha_emision: string
    fecha_emision_original: string | null
    fecha_vencimiento: string | null
    condicion_pago_label: string | null
    referencia: string | null
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
  estadoCliente: EstadoPortal
  colorMarca: string
}

const BADGES_ESTADO: Record<EstadoPortal, { icono: typeof Clock; clase: string; label: string }> = {
  pendiente: { icono: Clock, clase: 'bg-estado-pendiente/10 text-estado-pendiente border-estado-pendiente/20', label: 'estado_pendiente' },
  visto: { icono: Eye, clase: 'bg-insignia-info/10 text-insignia-info border-insignia-info/20', label: 'estado_visto' },
  aceptado: { icono: Check, clase: 'bg-insignia-exito/10 text-insignia-exito border-insignia-exito/20', label: 'estado_aceptado' },
  rechazado: { icono: X, clase: 'bg-estado-error/10 text-estado-error border-estado-error/20', label: 'estado_rechazado' },
  cancelado: { icono: AlertTriangle, clase: 'bg-texto-terciario/10 text-texto-terciario border-texto-terciario/20', label: 'cancelado' },
}

export default function InfoDocumento({ presupuesto, vendedorNombre, estadoCliente, colorMarca }: Props) {
  const { t } = useTraduccion()
  const nombreContacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido]
    .filter(Boolean).join(' ')
  const numeroLimpio = presupuesto.numero.replace(/^Pres\s*/i, '')

  const badge = BADGES_ESTADO[estadoCliente] || BADGES_ESTADO.pendiente
  const IconoEstado = badge.icono

  return (
    <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">
      {/* Franja de color marca arriba */}
      <div className="h-1" style={{ backgroundColor: colorMarca }} />

      <div className="p-5 sm:p-6 space-y-5">
        {/* ── Badges: tipo izquierda + estado derecha ── */}
        <div className="flex items-center justify-between">
          <span
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: `${colorMarca}18`, color: colorMarca }}
          >
            {t('portal.presupuesto')}
          </span>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${badge.clase}`}>
            <IconoEstado size={13} />
            {t(`portal.${badge.label}`)}
          </span>
        </div>

        {/* ── Número grande ── */}
        <div>
          <p className="text-sm text-texto-terciario">{t('portal.presupuesto')} N.&deg;</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-texto-primario tracking-tight mt-0.5">
            {numeroLimpio}
          </h2>
        </div>

        {/* ── Grid de datos (3 cols en desktop) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <span className="text-texto-terciario">{presupuesto.fecha_emision_original ? 'Fecha de re-emisión' : 'Fecha de emisión'}</span>
            <p className="text-texto-primario font-medium mt-0.5">{formatearFecha(presupuesto.fecha_emision)}</p>
            {presupuesto.fecha_emision_original && (
              <p className="text-[11px] text-texto-terciario mt-0.5">Emisión original: {formatearFecha(presupuesto.fecha_emision_original)}</p>
            )}
          </div>
          {presupuesto.fecha_vencimiento && (
            <div>
              <span className="text-texto-terciario">Fecha de vencimiento</span>
              <p className="text-texto-primario font-medium mt-0.5">{formatearFecha(presupuesto.fecha_vencimiento)}</p>
            </div>
          )}
          {presupuesto.condicion_pago_label && (
            <div>
              <span className="text-texto-terciario">Condición de pago</span>
              <p className="text-texto-primario font-medium mt-0.5">{presupuesto.condicion_pago_label}</p>
            </div>
          )}
          {presupuesto.referencia && (
            <div>
              <span className="text-texto-terciario">{t('portal.referencia')}</span>
              <p className="text-texto-primario font-medium mt-0.5">{presupuesto.referencia}</p>
            </div>
          )}
          <div>
            <span className="text-texto-terciario">Enviado por</span>
            <p className="text-texto-primario font-medium mt-0.5">{vendedorNombre}</p>
          </div>
        </div>

        {/* ── Separador ── */}
        <hr className="border-borde-sutil" />

        {/* ── Contacto en grid horizontal (como el portal antiguo) ── */}
        {nombreContacto && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <span className="text-texto-terciario">{t('portal.para')}</span>
              <p className="text-texto-primario font-medium mt-0.5">{nombreContacto}</p>
              {presupuesto.contacto_correo && (
                <p className="text-texto-secundario text-xs mt-0.5">{presupuesto.contacto_correo}</p>
              )}
            </div>
            {presupuesto.contacto_identificacion && (
              <div>
                <span className="text-texto-terciario">CUIT</span>
                <p className="text-texto-primario font-medium mt-0.5">{presupuesto.contacto_identificacion}</p>
              </div>
            )}
            {presupuesto.contacto_direccion && (
              <div>
                <span className="text-texto-terciario">Dirección</span>
                <p className="text-texto-primario font-medium mt-0.5">{presupuesto.contacto_direccion}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Dirigido a (si hay persona de atención) ── */}
        {presupuesto.atencion_nombre && (
          <div className="text-sm">
            <span className="text-texto-terciario">{t('portal.dirigido_a')}</span>
            <p className="text-texto-primario font-medium mt-0.5">{presupuesto.atencion_nombre}</p>
            {presupuesto.atencion_cargo && (
              <p className="text-texto-secundario text-xs mt-0.5">{presupuesto.atencion_cargo}</p>
            )}
            {presupuesto.atencion_correo && (
              <p className="text-texto-secundario text-xs mt-0.5">{presupuesto.atencion_correo}</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

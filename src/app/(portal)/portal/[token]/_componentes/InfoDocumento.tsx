'use client'

/**
 * InfoDocumento — Información del presupuesto: estado, número, fechas, contacto.
 * Se usa en: VistaPortal
 */

import { formatearFecha } from '@/lib/pdf/renderizar-html'

interface Props {
  presupuesto: {
    numero: string
    estado: string
    fecha_emision: string
    fecha_vencimiento: string | null
    condicion_pago_label: string | null
    contacto_nombre: string | null
    contacto_apellido: string | null
    contacto_identificacion: string | null
    contacto_direccion: string | null
    contacto_correo: string | null
    atencion_nombre: string | null
    atencion_cargo: string | null
    atencion_correo: string | null
  }
}

export default function InfoDocumento({ presupuesto }: Props) {
  const nombreContacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido]
    .filter(Boolean).join(' ')

  return (
    <div className="space-y-4">
      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-marca-500/10 text-marca-500">
          Presupuesto
        </span>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-estado-pendiente/10 text-estado-pendiente">
          Pendiente de aprobaci&oacute;n
        </span>
      </div>

      {/* Número */}
      <h2 className="text-2xl sm:text-3xl font-bold text-texto-primario">
        Presupuesto N&deg; {presupuesto.numero}
      </h2>

      {/* Fechas y condición */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-texto-terciario">Emisi&oacute;n: </span>
          <span className="text-texto-primario font-medium">{formatearFecha(presupuesto.fecha_emision)}</span>
        </div>
        {presupuesto.fecha_vencimiento && (
          <div>
            <span className="text-texto-terciario">Vencimiento: </span>
            <span className="text-texto-primario font-medium">{formatearFecha(presupuesto.fecha_vencimiento)}</span>
          </div>
        )}
        {presupuesto.condicion_pago_label && (
          <div>
            <span className="text-texto-terciario">Pago: </span>
            <span className="text-texto-primario font-medium">{presupuesto.condicion_pago_label}</span>
          </div>
        )}
      </div>

      {/* Separador */}
      <hr className="border-borde-sutil" />

      {/* Para quién */}
      <div className="space-y-2">
        {nombreContacto && (
          <div>
            <span className="text-[11px] text-texto-terciario uppercase tracking-wider">Para</span>
            <p className="text-sm font-medium text-texto-primario mt-0.5">{nombreContacto}</p>
            {presupuesto.contacto_identificacion && (
              <p className="text-xs text-texto-secundario">{presupuesto.contacto_identificacion}</p>
            )}
            {presupuesto.contacto_direccion && (
              <p className="text-xs text-texto-secundario">{presupuesto.contacto_direccion}</p>
            )}
          </div>
        )}

        {presupuesto.atencion_nombre && (
          <div className="mt-2">
            <span className="text-[11px] text-texto-terciario uppercase tracking-wider">Dirigido a</span>
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
  )
}

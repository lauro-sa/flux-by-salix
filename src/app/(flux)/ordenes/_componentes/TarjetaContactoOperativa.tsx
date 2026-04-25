'use client'

import { Phone, MapPin, Mail } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { Boton } from '@/componentes/ui/Boton'
import { TextoTelefono } from '@/componentes/ui/TextoTelefono'
import { useTraduccion } from '@/lib/i18n'

/**
 * TarjetaContactoOperativa — Card compacta con datos del contacto para uso en campo.
 * Botones grandes y tappables para llamar, WhatsApp, mapa y correo.
 * Se usa en: VistaOrdenTrabajo (detalle de orden).
 */

interface PropsTarjeta {
  nombre: string | null
  telefono: string | null
  whatsapp: string | null
  direccion: string | null
  correo: string | null
}

export default function TarjetaContactoOperativa({ nombre, telefono, whatsapp, direccion, correo }: PropsTarjeta) {
  const { t } = useTraduccion()

  // Limpiar teléfono para links
  const telLimpio = telefono?.replace(/[^+\d]/g, '') || ''
  const waLimpio = (whatsapp || telefono)?.replace(/[^+\d]/g, '') || ''

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-4 space-y-3">
      {/* Header */}
      <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
        {t('ordenes.contacto_seccion')}
      </p>

      {/* Nombre */}
      {nombre && (
        <p className="text-base font-semibold text-texto-primario">{nombre}</p>
      )}

      {/* Botones de acción rápida */}
      <div className="flex flex-wrap gap-2">
        {telLimpio && (
          <a href={`tel:${telLimpio}`} className="flex-1 min-w-[120px]">
            <Boton variante="secundario" tamano="sm" icono={<Phone size={15} />} className="w-full justify-center">
              {t('ordenes.llamar')}
            </Boton>
          </a>
        )}
        {waLimpio && (
          <a href={`https://wa.me/${waLimpio}`} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[120px]">
            <Boton variante="secundario" tamano="sm" icono={<IconoWhatsApp size={15} />} className="w-full justify-center" style={{ borderColor: 'var(--canal-whatsapp)', color: 'var(--canal-whatsapp)' }}>
              {t('ordenes.whatsapp')}
            </Boton>
          </a>
        )}
      </div>

      {/* Dirección */}
      {direccion && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-sm text-texto-secundario hover:text-texto-marca transition-colors group"
        >
          <MapPin size={14} className="shrink-0 mt-0.5 text-texto-terciario group-hover:text-texto-marca" />
          <span className="underline decoration-borde-sutil underline-offset-2 group-hover:decoration-texto-marca">
            {direccion}
          </span>
        </a>
      )}

      {/* Correo */}
      {correo && (
        <a href={`mailto:${correo}`} className="flex items-center gap-2 text-sm text-texto-terciario hover:text-texto-marca transition-colors">
          <Mail size={14} className="shrink-0" />
          {correo}
        </a>
      )}

      {/* Teléfono visible */}
      {telefono && (
        <p className="text-xs text-texto-terciario"><TextoTelefono valor={telefono} /></p>
      )}
    </div>
  )
}

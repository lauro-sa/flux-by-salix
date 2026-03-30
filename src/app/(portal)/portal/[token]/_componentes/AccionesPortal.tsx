'use client'

/**
 * AccionesPortal — Botones de acción: ver PDF, WhatsApp, llamar, aceptar, rechazar.
 * Se usa en: VistaPortal
 */

import { useState } from 'react'
import { FileText, Phone, Check, X } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'

interface Props {
  pdfUrl: string | null
  vendedorTelefono: string | null
  presupuestoNumero: string
  contactoNombre: string
  onAceptar: () => void
  onRechazar: () => void
  aceptado: boolean
  rechazado: boolean
}

export default function AccionesPortal({
  pdfUrl,
  vendedorTelefono,
  presupuestoNumero,
  contactoNombre,
  onAceptar,
  onRechazar,
  aceptado,
  rechazado,
}: Props) {
  const { t } = useTraduccion()
  const [mostrarConfirmarRechazo, setMostrarConfirmarRechazo] = useState(false)

  // Mensaje pre-armado para WhatsApp
  const mensajeWa = encodeURIComponent(
    `${t('portal.whatsapp_mensaje')} ${presupuestoNumero}. Soy ${contactoNombre}.`
  )
  const linkWa = vendedorTelefono
    ? `https://wa.me/${vendedorTelefono.replace(/\D/g, '')}?text=${mensajeWa}`
    : null

  if (aceptado) {
    return (
      <div className="rounded-xl bg-insignia-exito/10 border border-insignia-exito/20 p-4 text-center">
        <Check size={20} className="mx-auto text-insignia-exito mb-1" />
        <p className="text-sm font-medium text-insignia-exito">{t('portal.presupuesto')} {t('portal.aceptado').toLowerCase()}</p>
      </div>
    )
  }

  if (rechazado) {
    return (
      <div className="rounded-xl bg-estado-error/10 border border-estado-error/20 p-4 text-center">
        <X size={20} className="mx-auto text-estado-error mb-1" />
        <p className="text-sm font-medium text-estado-error">{t('portal.presupuesto')} {t('portal.rechazado').toLowerCase()}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Ver PDF */}
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-superficie-elevada border border-borde-sutil text-sm font-medium text-texto-primario hover:bg-superficie-app transition-colors"
        >
          <FileText size={18} />
          {t('portal.ver_detalle')}
        </a>
      )}

      {/* WhatsApp + Llamar */}
      <div className="flex gap-2">
        {linkWa && (
          <a
            href={linkWa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#25D366' }}
          >
            <IconoWhatsApp size={16} />
            WhatsApp
          </a>
        )}
        {vendedorTelefono && (
          <a
            href={`tel:${vendedorTelefono}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-superficie-elevada border border-borde-sutil text-sm font-medium text-texto-primario hover:bg-superficie-app transition-colors"
          >
            <Phone size={16} />
            {t('portal.llamar')}
          </a>
        )}
      </div>

      {/* Aceptar / Rechazar */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onAceptar}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-marca-500 hover:bg-marca-600 transition-colors"
        >
          <Check size={16} />
          {t('portal.aceptar')} {t('portal.presupuesto').toLowerCase()}
        </button>
        {!mostrarConfirmarRechazo ? (
          <button
            onClick={() => setMostrarConfirmarRechazo(true)}
            className="px-3 py-3 rounded-xl text-xs text-texto-terciario hover:text-estado-error hover:bg-estado-error/5 transition-colors"
          >
            {t('portal.rechazar')}
          </button>
        ) : (
          <button
            onClick={() => { onRechazar(); setMostrarConfirmarRechazo(false) }}
            className="px-3 py-3 rounded-xl text-xs font-medium text-estado-error bg-estado-error/10 hover:bg-estado-error/20 transition-colors"
          >
            {t('portal.confirmar_rechazo')}
          </button>
        )}
      </div>
    </div>
  )
}

'use client'

/**
 * AccionesPortal — Botones de acción: ver PDF, WhatsApp, llamar, aceptar, rechazar, cancelar.
 * Usa color de marca de la empresa. Persiste acciones via API.
 * Se usa en: VistaPortal
 */

import { useState } from 'react'
import { FileText, Phone, Check, X, Undo2, Loader2 } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { EstadoPortal } from '@/tipos/portal'

interface Props {
  pdfUrl: string | null
  vendedorTelefono: string | null
  presupuestoNumero: string
  contactoNombre: string
  estadoCliente: EstadoPortal
  colorMarca: string
  firmaNombre: string | null
  firmaUrl: string | null
  motivoRechazo: string | null
  onAceptar: () => void
  onRechazar: (motivo: string) => void
  onCancelar: () => void
  cargando: boolean
}

export default function AccionesPortal({
  pdfUrl,
  vendedorTelefono,
  presupuestoNumero,
  contactoNombre,
  estadoCliente,
  colorMarca,
  firmaNombre,
  firmaUrl,
  motivoRechazo,
  onAceptar,
  onRechazar,
  onCancelar,
  cargando,
}: Props) {
  const { t } = useTraduccion()
  const [mostrarRechazo, setMostrarRechazo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [mostrarCancelar, setMostrarCancelar] = useState(false)

  // Mensaje pre-armado para WhatsApp
  const mensajeWa = encodeURIComponent(
    `${t('portal.whatsapp_mensaje')} ${presupuestoNumero}. Soy ${contactoNombre}.`
  )
  const linkWa = vendedorTelefono
    ? `https://wa.me/${vendedorTelefono.replace(/\D/g, '')}?text=${mensajeWa}`
    : null

  // ── Estado: Aceptado ──
  if (estadoCliente === 'aceptado') {
    return (
      <div className="space-y-3">
        {/* Banner de aceptado */}
        <div className="rounded-xl bg-insignia-exito/10 border border-insignia-exito/20 p-4">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-full bg-insignia-exito/20 flex items-center justify-center shrink-0 mt-0.5">
              <Check size={16} className="text-insignia-exito" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-insignia-exito">
                {t('portal.presupuesto')} {t('portal.aceptado').toLowerCase()}
              </p>
              {firmaNombre && (
                <p className="text-xs text-texto-secundario mt-1">{t('portal.firmado_por')} {firmaNombre}</p>
              )}
              {firmaUrl && (
                <img src={firmaUrl} alt="Firma" className="max-h-[60px] mt-2 opacity-70" />
              )}
            </div>
          </div>
        </div>

        {/* Botones de contacto + PDF (siempre visibles) */}
        <BotonesContacto pdfUrl={pdfUrl} linkWa={linkWa} vendedorTelefono={vendedorTelefono} colorMarca={colorMarca} t={t} />

        {/* Cancelar aceptación */}
        {!mostrarCancelar ? (
          <button
            onClick={() => setMostrarCancelar(true)}
            className="w-full text-xs text-texto-terciario hover:text-estado-error py-2 transition-colors flex items-center justify-center gap-1"
          >
            <Undo2 size={12} />
            {t('portal.cancelar_aceptacion')}
          </button>
        ) : (
          <div className="flex items-center gap-2 justify-center">
            <span className="text-xs text-estado-error">{t('portal.confirmar_cancelar')}</span>
            <button
              onClick={() => { onCancelar(); setMostrarCancelar(false) }}
              disabled={cargando}
              className="px-3 py-1.5 text-xs font-medium text-white bg-estado-error rounded-lg hover:bg-estado-error/90 disabled:opacity-50 transition-colors"
            >
              {cargando ? <Loader2 size={12} className="animate-spin" /> : 'Sí, cancelar'}
            </button>
            <button
              onClick={() => setMostrarCancelar(false)}
              className="px-3 py-1.5 text-xs text-texto-terciario hover:text-texto-primario transition-colors"
            >
              No
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Estado: Rechazado ──
  if (estadoCliente === 'rechazado') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-estado-error/10 border border-estado-error/20 p-4">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-full bg-estado-error/20 flex items-center justify-center shrink-0 mt-0.5">
              <X size={16} className="text-estado-error" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-estado-error">
                {t('portal.presupuesto')} {t('portal.rechazado').toLowerCase()}
              </p>
              {motivoRechazo && (
                <p className="text-xs text-texto-secundario mt-1">&ldquo;{motivoRechazo}&rdquo;</p>
              )}
            </div>
          </div>
        </div>
        <BotonesContacto pdfUrl={pdfUrl} linkWa={linkWa} vendedorTelefono={vendedorTelefono} colorMarca={colorMarca} t={t} />
      </div>
    )
  }

  // ── Estado: Pendiente / Visto (puede aceptar o rechazar) ──
  return (
    <div className="space-y-3">
      {/* Ver PDF (prominente, con color empresa) */}
      <BotonesContacto pdfUrl={pdfUrl} linkWa={linkWa} vendedorTelefono={vendedorTelefono} colorMarca={colorMarca} t={t} />

      {/* Aceptar / Rechazar */}
      {!mostrarRechazo ? (
        <div className="flex gap-2 pt-1">
          <button
            onClick={onAceptar}
            disabled={cargando}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: colorMarca }}
          >
            {cargando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {t('portal.aceptar')} {t('portal.presupuesto').toLowerCase()}
          </button>
          <button
            onClick={() => setMostrarRechazo(true)}
            className="px-3 py-3 rounded-xl text-xs text-texto-terciario hover:text-estado-error hover:bg-estado-error/5 transition-colors"
          >
            {t('portal.rechazar')}
          </button>
        </div>
      ) : (
        <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil p-4 space-y-3">
          <p className="text-sm font-medium text-texto-primario">{t('portal.motivo_rechazo')}</p>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder={t('portal.motivo_placeholder')}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-borde-sutil bg-superficie-app text-sm text-texto-primario placeholder:text-texto-terciario focus:ring-2 focus:ring-estado-error/30 focus:border-estado-error outline-none resize-none transition"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setMostrarRechazo(false); setMotivo('') }}
              className="px-3 py-2 text-sm text-texto-terciario hover:text-texto-primario transition-colors"
            >
              {t('comun.cancelar')}
            </button>
            <button
              onClick={() => onRechazar(motivo)}
              disabled={cargando}
              className="px-4 py-2 text-sm font-medium text-white bg-estado-error rounded-lg hover:bg-estado-error/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              {t('portal.confirmar_rechazo')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Botones de contacto reutilizables ──
function BotonesContacto({
  pdfUrl, linkWa, vendedorTelefono, colorMarca, t,
}: {
  pdfUrl: string | null
  linkWa: string | null
  vendedorTelefono: string | null
  colorMarca: string
  t: (key: string) => string
}) {
  return (
    <>
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: colorMarca }}
        >
          <FileText size={18} />
          {t('portal.ver_detalle')}
        </a>
      )}
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
    </>
  )
}

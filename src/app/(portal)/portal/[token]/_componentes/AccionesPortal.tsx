'use client'

/**
 * AccionesPortal — Botones de acción: ver PDF, WhatsApp, llamar, aceptar, rechazar, cancelar.
 * Usa color de marca de la empresa. Persiste acciones via API.
 * Se usa en: VistaPortal
 */

import { useState } from 'react'
import { FileText, Phone, Check, X, Undo2, Loader2 } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { TextArea } from '@/componentes/ui/TextArea'
import { useTraduccion } from '@/lib/i18n'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { EstadoPortal } from '@/tipos/portal'

interface Props {
  pdfUrl: string | null
  empresaTelefono: string | null
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
  empresaTelefono,
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
  const linkWa = empresaTelefono
    ? `https://wa.me/${empresaTelefono.replace(/\D/g, '')}?text=${mensajeWa}`
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
        <BotonesContacto pdfUrl={pdfUrl} linkWa={linkWa} empresaTelefono={empresaTelefono} colorMarca={colorMarca} t={t} />

        {/* Cancelar aceptación */}
        {!mostrarCancelar ? (
          <Boton variante="fantasma" tamano="xs" anchoCompleto icono={<Undo2 size={12} />} onClick={() => setMostrarCancelar(true)} className="text-texto-terciario hover:text-estado-error">
            {t('portal.cancelar_aceptacion')}
          </Boton>
        ) : (
          <div className="flex items-center gap-2 justify-center">
            <span className="text-xs text-estado-error">{t('portal.confirmar_cancelar')}</span>
            <Boton variante="peligro" tamano="xs" onClick={() => { onCancelar(); setMostrarCancelar(false) }} disabled={cargando} cargando={cargando}>
              Sí, cancelar
            </Boton>
            <Boton variante="fantasma" tamano="xs" onClick={() => setMostrarCancelar(false)}>
              No
            </Boton>
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
        <BotonesContacto pdfUrl={pdfUrl} linkWa={linkWa} empresaTelefono={empresaTelefono} colorMarca={colorMarca} t={t} />
      </div>
    )
  }

  // ── Estado: Pendiente / Visto (puede aceptar o rechazar) ──
  return (
    <div className="space-y-3">
      {/* Ver PDF (prominente, con color empresa) */}
      <BotonesContacto pdfUrl={pdfUrl} linkWa={linkWa} empresaTelefono={empresaTelefono} colorMarca={colorMarca} t={t} />

      {/* Aceptar y firmar / Rechazar — dentro de tarjeta */}
      {!mostrarRechazo ? (
        <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil p-4">
          <div className="flex items-center justify-between">
            <Boton variante="exito" tamano="md" icono={<Check size={16} />} onClick={onAceptar} disabled={cargando} cargando={cargando}>
              Aceptar y firmar
            </Boton>
            <Boton variante="fantasma" tamano="sm" icono={<X size={15} />} onClick={() => setMostrarRechazo(true)} className="text-estado-error hover:text-estado-error/80">
              {t('portal.rechazar')}
            </Boton>
          </div>
        </div>
      ) : (
        <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil p-4 space-y-3">
          <p className="text-sm font-medium text-texto-primario">{t('portal.motivo_rechazo')}</p>
          <TextArea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder={t('portal.motivo_placeholder')}
            rows={3}
          />
          <div className="flex items-center gap-3">
            <Boton variante="peligro" tamano="md" icono={<X size={14} />} onClick={() => onRechazar(motivo)} disabled={cargando} cargando={cargando}>
              {t('portal.confirmar_rechazo')}
            </Boton>
            <Boton variante="fantasma" tamano="sm" onClick={() => { setMostrarRechazo(false); setMotivo('') }}>
              {t('comun.cancelar')}
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Botones de contacto reutilizables ──
function BotonesContacto({
  pdfUrl, linkWa, empresaTelefono, colorMarca, t,
}: {
  pdfUrl: string | null
  linkWa: string | null
  empresaTelefono: string | null
  colorMarca: string
  t: (key: string) => string
}) {
  return (
    <>
      {/* Ver PDF — prominente, color marca */}
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: colorMarca }}
        >
          <FileText size={18} />
          {t('portal.ver_detalle')}
        </a>
      )}
      {/* WhatsApp + Llamar — estilo outlined/sutil */}
      <div className="flex gap-3">
        {linkWa && (
          <a
            href={linkWa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors border"
            style={{ borderColor: 'var(--canal-whatsapp)', color: 'var(--canal-whatsapp)', backgroundColor: 'var(--canal-whatsapp-fondo)' }}
          >
            <IconoWhatsApp size={18} />
            Escribir por WhatsApp
          </a>
        )}
        {empresaTelefono && (
          <a
            href={`tel:${empresaTelefono}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-borde-fuerte text-sm font-medium text-texto-primario hover:bg-superficie-elevada transition-colors"
          >
            <Phone size={16} />
            {t('portal.llamar')}
          </a>
        )}
      </div>
    </>
  )
}

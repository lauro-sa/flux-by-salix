'use client'

/**
 * ModalAvisoEnCamino — Se abre al marcar una parada como "En camino".
 * Ofrece enviar un aviso por WhatsApp al contacto con ETA redondeado (estimado no comprometedor).
 * Se usa en: PaginaRecorrido, cuando el visitador cambia el estado de una visita a en_camino.
 */

import { useEffect, useState } from 'react'
import { X, Clock, Loader2, MapPin } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { motion, AnimatePresence } from 'framer-motion'

interface PropiedadesModalAvisoEnCamino {
  abierto: boolean
  onCerrar: () => void
  onEnviado?: () => void
  visitaId: string
  contactoNombre: string
  direccionTexto: string
  ubicacionActual: { lat: number; lng: number } | null
}

interface RespuestaPreview {
  eta_min_real: number | null
  eta_min_comunicado: number | null
  mensaje: string
  telefono: string | null
  tiene_whatsapp: boolean
  plantilla_estado: string
  plantilla_lista: boolean
}

function ModalAvisoEnCamino({
  abierto,
  onCerrar,
  onEnviado,
  visitaId,
  contactoNombre,
  direccionTexto,
  ubicacionActual,
}: PropiedadesModalAvisoEnCamino) {
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [preview, setPreview] = useState<RespuestaPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Pedir preview cada vez que se abre el modal
  useEffect(() => {
    if (!abierto || !visitaId) return

    let cancelado = false
    setCargandoPreview(true)
    setError(null)
    setPreview(null)

    fetch('/api/recorrido/aviso-en-camino', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visita_id: visitaId,
        ubicacion_actual: ubicacionActual,
        solo_preview: true,
      }),
    })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Error al calcular aviso')
        return data as RespuestaPreview
      })
      .then(data => { if (!cancelado) setPreview(data) })
      .catch(e => { if (!cancelado) setError(e.message) })
      .finally(() => { if (!cancelado) setCargandoPreview(false) })

    return () => { cancelado = true }
  }, [abierto, visitaId, ubicacionActual])

  const enviarAviso = async () => {
    if (!preview?.tiene_whatsapp) return
    setEnviando(true)
    setError(null)
    try {
      const resp = await fetch('/api/recorrido/aviso-en-camino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visita_id: visitaId,
          ubicacion_actual: ubicacionActual,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'No se pudo enviar el aviso')
      onEnviado?.()
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onCerrar}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 z-50 bg-superficie-tarjeta rounded-modal border border-borde-sutil shadow-xl overflow-hidden"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-4 pb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-2 rounded-full bg-[var(--insignia-info)] animate-pulse" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--insignia-info)]">
                    En camino
                  </span>
                </div>
                <h3 className="text-lg font-bold text-texto-primario truncate">{contactoNombre}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin size={12} className="text-texto-terciario shrink-0" />
                  <p className="text-sm text-texto-secundario truncate">{direccionTexto}</p>
                </div>
              </div>
              <button
                onClick={onCerrar}
                className="flex items-center justify-center size-8 rounded-full hover:bg-superficie-elevada transition-colors shrink-0 ml-2"
              >
                <X size={16} className="text-texto-terciario" />
              </button>
            </div>

            {/* Contenido */}
            <div className="px-4 pb-4 space-y-3">
              {/* Chip con ETA */}
              {preview?.eta_min_comunicado != null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--insignia-info)]/10 border border-[var(--insignia-info)]/20 w-fit">
                  <Clock size={13} className="text-[var(--insignia-info)]" />
                  <span className="text-xs font-medium text-[var(--insignia-info)]">
                    ~{preview.eta_min_comunicado} min aprox.
                  </span>
                </div>
              )}

              {/* Preview del mensaje */}
              <div className="rounded-card border border-borde-sutil bg-white/[0.02] p-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-texto-terciario mb-1.5">
                  Mensaje por WhatsApp
                </div>
                {cargandoPreview ? (
                  <div className="flex items-center gap-2 py-2 text-texto-terciario">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-sm">Calculando tiempo estimado…</span>
                  </div>
                ) : preview ? (
                  <p className="text-sm text-texto-primario whitespace-pre-wrap leading-relaxed">
                    {preview.mensaje}
                  </p>
                ) : error ? (
                  <p className="text-sm text-[var(--insignia-peligro)]">{error}</p>
                ) : null}
              </div>

              {/* Avisos complementarios */}
              {preview && !preview.tiene_whatsapp && (
                <p className="text-center text-[11px] text-texto-terciario">
                  El contacto no tiene WhatsApp configurado — no se puede enviar el aviso.
                </p>
              )}
              {preview && preview.tiene_whatsapp && preview.eta_min_real == null && (
                <p className="text-[11px] text-texto-terciario">
                  No se pudo calcular el tiempo de viaje. El mensaje igual se puede enviar.
                </p>
              )}
              {preview && preview.tiene_whatsapp && !preview.plantilla_lista && (
                <div className="rounded-card border border-insignia-advertencia/30 bg-insignia-advertencia/10 px-3 py-2">
                  <p className="text-[11px] text-insignia-advertencia leading-relaxed">
                    {preview.plantilla_estado === 'FALTANTE'
                      ? 'La plantilla "Aviso en Camino" no está creada en esta empresa. Avisá al administrador.'
                      : `Plantilla en estado ${preview.plantilla_estado}. Enviala a Meta desde la pantalla de Plantillas para poder usarla.`}
                  </p>
                </div>
              )}

              {/* Botones */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={onCerrar}
                  disabled={enviando}
                  className="py-3 rounded-card border border-borde-sutil text-sm font-medium text-texto-secundario hover:bg-superficie-elevada transition-colors disabled:opacity-50"
                >
                  Saltar
                </button>
                <button
                  onClick={enviarAviso}
                  disabled={enviando || cargandoPreview || !preview?.tiene_whatsapp || !preview?.plantilla_lista}
                  className="flex items-center justify-center gap-2 py-3 rounded-card text-sm font-semibold text-white bg-[var(--canal-whatsapp)] hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {enviando ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <IconoWhatsApp size={16} className="text-white" />
                  )}
                  <span>{enviando ? 'Enviando…' : 'Enviar aviso'}</span>
                </button>
              </div>

              {error && !cargandoPreview && preview && (
                <p className="text-center text-[11px] text-[var(--insignia-peligro)]">{error}</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { ModalAvisoEnCamino }

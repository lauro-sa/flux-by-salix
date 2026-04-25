'use client'

/**
 * ModalAvisoLlegada — Se abre al confirmar "Llegué" desde ModalLlegada.
 * Envía un WhatsApp avisando que el visitador ya está en la dirección del contacto.
 * Análogo a ModalAvisoEnCamino pero sin ETA (ya no hay tiempo estimado).
 *
 * Se usa en: PaginaRecorrido — después de marcar una visita como en_sitio.
 */

import { useEffect, useState } from 'react'
import { X, Loader2, MapPin } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { motion, AnimatePresence } from 'framer-motion'

interface PropiedadesModalAvisoLlegada {
  abierto: boolean
  onCerrar: () => void
  onEnviado?: () => void
  visitaId: string
  contactoNombre: string
  direccionTexto: string
}

interface RespuestaPreview {
  mensaje: string
  telefono: string | null
  tiene_whatsapp: boolean
  plantilla_estado: string
  plantilla_lista: boolean
}

function ModalAvisoLlegada({
  abierto,
  onCerrar,
  onEnviado,
  visitaId,
  contactoNombre,
  direccionTexto,
}: PropiedadesModalAvisoLlegada) {
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [preview, setPreview] = useState<RespuestaPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Pedir preview al abrir — similar al flujo del aviso en camino.
  useEffect(() => {
    if (!abierto || !visitaId) return

    let cancelado = false
    setCargandoPreview(true)
    setError(null)
    setPreview(null)

    fetch('/api/recorrido/aviso-llegada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visita_id: visitaId, solo_preview: true }),
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
  }, [abierto, visitaId])

  const enviarAviso = async () => {
    if (!preview?.tiene_whatsapp) return
    setEnviando(true)
    setError(null)
    try {
      const resp = await fetch('/api/recorrido/aviso-llegada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visita_id: visitaId }),
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
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="size-1.5 rounded-full bg-[var(--insignia-exito)] animate-pulse" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--insignia-exito)]">
                  Avisar llegada
                </span>
              </div>
              <button
                onClick={onCerrar}
                className="flex items-center justify-center size-7 rounded-full hover:bg-superficie-elevada transition-colors"
              >
                <X size={14} className="text-texto-terciario" />
              </button>
            </div>

            <div className="px-4 pb-4 space-y-3">
              <div>
                <h3 className="text-base font-semibold text-texto-primario truncate">{contactoNombre}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin size={11} className="text-texto-terciario shrink-0" />
                  <p className="text-xs text-texto-terciario truncate">{direccionTexto}</p>
                </div>
              </div>

              {/* Preview del mensaje — muestra el texto real que se va a enviar */}
              {cargandoPreview ? (
                <div className="flex items-center gap-2 text-texto-terciario">
                  <Loader2 size={13} className="animate-spin" />
                  <span className="text-sm">Preparando mensaje…</span>
                </div>
              ) : preview?.mensaje && (
                <div className="rounded-card bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
                  <p className="text-[12px] text-texto-secundario whitespace-pre-wrap leading-relaxed">
                    {preview.mensaje}
                  </p>
                </div>
              )}

              {/* Avisos de bloqueo */}
              {preview && !preview.tiene_whatsapp && (
                <p className="text-[11px] text-insignia-advertencia">
                  El contacto no tiene WhatsApp cargado.
                </p>
              )}
              {preview && preview.tiene_whatsapp && !preview.plantilla_lista && (
                <p className="text-[11px] text-insignia-advertencia">
                  {preview.plantilla_estado === 'FALTANTE'
                    ? 'La plantilla "flux_aviso_llegada_visita" no está creada. Creala desde Configuración → WhatsApp → Plantillas.'
                    : `Plantilla ${preview.plantilla_estado.toLowerCase()} — requiere aprobación de Meta.`}
                </p>
              )}
              {error && (
                <p className="text-[11px] text-[var(--insignia-peligro)]">{error}</p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={onCerrar}
                  disabled={enviando}
                  className="py-2.5 rounded-card border border-borde-sutil text-sm font-medium text-texto-secundario hover:bg-superficie-elevada transition-colors disabled:opacity-50"
                >
                  No enviar
                </button>
                <button
                  onClick={enviarAviso}
                  disabled={enviando || cargandoPreview || !preview?.tiene_whatsapp || !preview?.plantilla_lista}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-card text-sm font-semibold text-white bg-[var(--canal-whatsapp)] hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {enviando ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <IconoWhatsApp size={14} className="text-white" />
                  )}
                  <span>{enviando ? 'Enviando…' : 'Enviar aviso'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { ModalAvisoLlegada }

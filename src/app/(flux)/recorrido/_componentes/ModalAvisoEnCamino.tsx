'use client'

/**
 * ModalAvisoEnCamino — Se abre al marcar una parada como "En camino".
 * Ofrece enviar un aviso por WhatsApp al contacto con ETA redondeado (estimado no comprometedor).
 * Se usa en: PaginaRecorrido, cuando el visitador cambia el estado de una visita a en_camino.
 */

import { useEffect, useRef, useState } from 'react'
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

  // Ref con la ubicación más reciente del GPS (actualizada sin disparar re-fetch).
  // Se congela al momento de abrir el modal para calcular ETA estable, y se usa
  // también al tocar "Enviar aviso" para tomar la posición más actualizada.
  const ubicacionRef = useRef(ubicacionActual)
  useEffect(() => { ubicacionRef.current = ubicacionActual }, [ubicacionActual])

  // Pedir preview UNA sola vez al abrir (no re-fetchea cuando el GPS se actualiza,
  // si no el modal quedaba en loop por watchPosition emitiendo cada pocos segundos).
  useEffect(() => {
    if (!abierto || !visitaId) return

    let cancelado = false
    setCargandoPreview(true)
    setError(null)
    setPreview(null)

    const ubicacionSnapshot = ubicacionRef.current

    fetch('/api/recorrido/aviso-en-camino', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visita_id: visitaId,
        ubicacion_actual: ubicacionSnapshot,
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
  }, [abierto, visitaId])

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
          ubicacion_actual: ubicacionRef.current,
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
            {/* Header compacto con cerrar */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="size-1.5 rounded-full bg-[var(--insignia-info)] animate-pulse" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--insignia-info)]">
                  Avisar al contacto
                </span>
              </div>
              <button
                onClick={onCerrar}
                className="flex items-center justify-center size-7 rounded-full hover:bg-superficie-elevada transition-colors"
              >
                <X size={14} className="text-texto-terciario" />
              </button>
            </div>

            {/* Cuerpo compacto: nombre + dirección + ETA + botones */}
            <div className="px-4 pb-4 space-y-3">
              <div>
                <h3 className="text-base font-semibold text-texto-primario truncate">{contactoNombre}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin size={11} className="text-texto-terciario shrink-0" />
                  <p className="text-xs text-texto-terciario truncate">{direccionTexto}</p>
                </div>
              </div>

              {/* ETA en línea */}
              <div className="flex items-center gap-1.5 text-texto-secundario">
                <Clock size={13} className="text-[var(--insignia-info)] shrink-0" />
                {cargandoPreview ? (
                  <span className="text-sm">Calculando tiempo…</span>
                ) : preview?.eta_min_comunicado != null ? (
                  <span className="text-sm">
                    Llegada estimada: <span className="text-texto-primario font-medium">~{preview.eta_min_comunicado} min</span>
                  </span>
                ) : (
                  <span className="text-sm text-texto-terciario">Sin estimación de tiempo</span>
                )}
              </div>

              {/* Avisos de bloqueo (solo si hay) */}
              {preview && !preview.tiene_whatsapp && (
                <p className="text-[11px] text-insignia-advertencia">
                  El contacto no tiene WhatsApp cargado.
                </p>
              )}
              {preview && preview.tiene_whatsapp && !preview.plantilla_lista && (
                <p className="text-[11px] text-insignia-advertencia">
                  {preview.plantilla_estado === 'FALTANTE'
                    ? 'La plantilla no está creada.'
                    : `Plantilla ${preview.plantilla_estado.toLowerCase()} — requiere aprobación de Meta.`}
                </p>
              )}
              {error && (
                <p className="text-[11px] text-[var(--insignia-peligro)]">{error}</p>
              )}

              {/* Botones */}
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

export { ModalAvisoEnCamino }

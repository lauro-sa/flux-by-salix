'use client'

/**
 * Lightbox — Visor de imagen/PDF por encima de otros modales.
 * Muestra la imagen o el PDF en un overlay, soporta ESC para cerrar y
 * click en el backdrop. Se usa para previsualizar comprobantes, adjuntos
 * del chatter, etc.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X as XIcon, Paperclip } from 'lucide-react'

interface PropsLightbox {
  /** URL pública del archivo. Si está vacía pero se pasa `endpointDescarga`,
   *  el visor pide la signed URL al endpoint antes de mostrar. */
  url: string
  nombre: string
  /** MIME type o cadena que empieza con `image/` / `application/pdf`.
   *  Si se omite, se infiere por la extensión del nombre. */
  tipo?: string
  /** Endpoint que retorna `{ url }` con una signed URL de corta duración.
   *  Se usa para archivos en buckets privados (ej. comprobantes de pago). */
  endpointDescarga?: string
  onCerrar: () => void
}

export function Lightbox({ url, nombre, tipo, endpointDescarga, onCerrar }: PropsLightbox) {
  const esImagen = (tipo || '').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|heic|bmp|svg)$/i.test(nombre)
  const esPDF = (tipo || '') === 'application/pdf' || /\.pdf$/i.test(nombre)

  // Resolver URL real: si vino vacía pero hay endpoint, fetcheamos signed URL.
  const [urlReal, setUrlReal] = useState<string>(url)
  const [errorCarga, setErrorCarga] = useState(false)

  useEffect(() => {
    if (url) {
      setUrlReal(url)
      return
    }
    if (!endpointDescarga) return
    let cancelado = false
    setErrorCarga(false)
    fetch(endpointDescarga)
      .then(async (r) => {
        if (!r.ok) throw new Error('descarga')
        const data = (await r.json()) as { url: string }
        if (!cancelado) setUrlReal(data.url)
      })
      .catch(() => {
        if (!cancelado) setErrorCarga(true)
      })
    return () => { cancelado = true }
  }, [url, endpointDescarga])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCerrar()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onCerrar])

  if (typeof window === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-8"
      style={{ zIndex: 'var(--z-overlay)' as unknown as number }}
      onClick={onCerrar}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-3 z-10">
        <p className="text-sm text-white/90 truncate px-2 py-1 rounded bg-black/40 max-w-[70%]">
          {nombre}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="size-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
          aria-label="Cerrar"
          title="Cerrar (Esc)"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      <div
        className="relative max-w-full max-h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {errorCarga ? (
          <div className="px-6 py-8 rounded bg-superficie-elevada border border-borde-sutil text-center">
            <p className="text-sm text-texto-primario mb-1">{nombre}</p>
            <p className="text-xs text-insignia-peligro">No se pudo cargar el archivo.</p>
          </div>
        ) : !urlReal ? (
          <div className="px-6 py-8 rounded bg-superficie-elevada border border-borde-sutil text-center">
            <p className="text-xs text-texto-terciario">Cargando…</p>
          </div>
        ) : esImagen ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={urlReal}
            alt={nombre}
            className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl"
          />
        ) : esPDF ? (
          <iframe
            src={urlReal}
            title={nombre}
            className="w-[90vw] h-[88vh] rounded shadow-2xl bg-white"
          />
        ) : (
          <div className="px-6 py-8 rounded bg-superficie-elevada border border-borde-sutil text-center">
            <Paperclip className="size-10 mx-auto text-texto-terciario mb-3" />
            <p className="text-sm text-texto-primario mb-1">{nombre}</p>
            <p className="text-xs text-texto-terciario mb-4">
              Este tipo de archivo no se puede previsualizar.
            </p>
            <a
              href={urlReal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-texto-marca text-white text-sm hover:bg-texto-marca/90"
            >
              Abrir en pestaña nueva
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

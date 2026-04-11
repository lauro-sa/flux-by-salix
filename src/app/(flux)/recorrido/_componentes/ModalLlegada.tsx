'use client'

/**
 * ModalLlegada — Se abre al tocar "Llegué" en una parada.
 * Muestra datos del contacto + acciones rápidas: llamar, WhatsApp, avisar llegada.
 * Se usa en: PaginaRecorrido, cuando el visitador llega a una parada.
 */

import { Phone, MessageCircle, Bell, X, MapPin, Navigation } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface PropiedadesModalLlegada {
  abierto: boolean
  onCerrar: () => void
  contactoNombre: string
  direccionTexto: string
  telefono?: string | null
  direccionLat?: number | null
  direccionLng?: number | null
  onAvisarLlegada: () => void
}

function ModalLlegada({
  abierto,
  onCerrar,
  contactoNombre,
  direccionTexto,
  telefono,
  direccionLat,
  direccionLng,
  onAvisarLlegada,
}: PropiedadesModalLlegada) {

  const llamar = () => {
    if (telefono) window.open(`tel:${telefono}`, '_self')
  }

  const abrirWhatsApp = () => {
    if (!telefono) return
    // Limpiar número: solo dígitos, agregar código de país si no tiene
    const num = telefono.replace(/\D/g, '')
    const mensaje = encodeURIComponent(`Hola ${contactoNombre}, ya llegué a ${direccionTexto}`)
    window.open(`https://wa.me/${num}?text=${mensaje}`, '_blank')
  }

  const navegarDireccion = () => {
    if (direccionLat && direccionLng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${direccionLat},${direccionLng}&travelmode=driving`, '_blank')
    }
  }

  return (
    <AnimatePresence>
      {abierto && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onCerrar}
          />

          {/* Modal centrado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 z-50 bg-superficie-tarjeta rounded-2xl border border-borde-sutil shadow-xl overflow-hidden"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-4 pb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-2 rounded-full bg-[var(--insignia-exito)] animate-pulse" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--insignia-exito)]">
                    Llegaste
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

            {/* Acciones */}
            <div className="px-4 pb-4 space-y-2">
              {/* Fila de contacto: llamar + WhatsApp */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={llamar}
                  disabled={!telefono}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors disabled:opacity-30"
                >
                  <Phone size={16} className="text-[var(--insignia-info)]" />
                  <span className="text-sm font-medium text-texto-primario">Llamar</span>
                </button>
                <button
                  onClick={abrirWhatsApp}
                  disabled={!telefono}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors disabled:opacity-30"
                >
                  <MessageCircle size={16} className="text-[var(--canal-whatsapp)]" />
                  <span className="text-sm font-medium text-texto-primario">WhatsApp</span>
                </button>
              </div>

              {/* Navegar a la dirección */}
              {direccionLat && direccionLng && (
                <button
                  onClick={navegarDireccion}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                >
                  <Navigation size={16} className="text-texto-terciario" />
                  <span className="text-sm font-medium text-texto-secundario">Ver en mapa</span>
                </button>
              )}

              {/* Avisar que llegué — acción principal */}
              <button
                onClick={() => { onAvisarLlegada(); onCerrar() }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: 'var(--insignia-exito)' }}
              >
                <Bell size={16} />
                <span>Avisar que llegué</span>
              </button>

              {!telefono && (
                <p className="text-center text-[11px] text-texto-terciario">
                  Sin teléfono registrado para este contacto
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { ModalLlegada }

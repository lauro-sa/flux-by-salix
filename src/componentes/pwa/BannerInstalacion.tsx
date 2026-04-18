'use client'

import { Download, X, Ellipsis, Share, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { Boton } from '@/componentes/ui/Boton'

/**
 * BannerInstalacion — Sugiere instalar Flux como PWA.
 *
 * - Android/Chrome: botón "Instalar" que dispara el prompt nativo.
 * - iOS Safari: pasos reales (··· → Compartir → Agregar a Inicio).
 * - Se oculta si ya está instalada o si el usuario la descartó (7 días).
 *
 * Se monta en PlantillaApp, visible solo en móvil/tablet.
 */
export function BannerInstalacion() {
  const { puedeInstalar, esIOS, instalar, descartar } = usePWAInstall()

  return (
    <AnimatePresence>
      {puedeInstalar && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-4 right-4 z-50 md:left-auto md:right-6 md:bottom-6 md:w-[360px]"
        >
          <div className="bg-superficie-elevada/95 backdrop-blur-md border border-borde-sutil rounded-popover shadow-elevada p-4 flex items-start gap-3">
            {/* Ícono */}
            <div className="size-10 rounded-card bg-texto-marca/10 flex items-center justify-center shrink-0">
              <Download size={20} className="text-texto-marca" />
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-texto-primario">Instalar Flux</p>
              {esIOS ? (
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-texto-secundario">
                    <span className="size-5 rounded-boton bg-superficie-hover flex items-center justify-center shrink-0">
                      <Ellipsis size={14} className="text-texto-primario" />
                    </span>
                    <span>Tocá los <strong>tres puntos</strong> abajo</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-texto-secundario">
                    <span className="size-5 rounded-boton bg-superficie-hover flex items-center justify-center shrink-0">
                      <Share size={12} className="text-texto-primario" />
                    </span>
                    <span>Luego <strong>Compartir</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-texto-secundario">
                    <span className="size-5 rounded-boton bg-superficie-hover flex items-center justify-center shrink-0">
                      <Plus size={14} className="text-texto-primario" />
                    </span>
                    <span>Y por último <strong>Agregar a Inicio</strong></span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-texto-secundario mt-0.5">
                  Accedé más rápido desde tu pantalla de inicio
                </p>
              )}

              {/* Botón instalar (solo Chrome/Android) */}
              {!esIOS && (
                <Boton
                  variante="primario"
                  tamano="xs"
                  onClick={instalar}
                  className="mt-2"
                  icono={<Download size={14} />}
                >
                  Instalar
                </Boton>
              )}
            </div>

            {/* Cerrar */}
            <button
              onClick={descartar}
              className="shrink-0 size-10 flex items-center justify-center rounded-card text-texto-terciario hover:bg-superficie-hover active:bg-superficie-hover transition-colors cursor-pointer bg-transparent border-none"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

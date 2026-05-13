'use client'

/**
 * BotonFlotanteNotas — Botón flotante de notas rápidas.
 * Posición: arriba del botón de Salix IA en el stack vertical.
 * Recibe notasRapidas como prop desde PlantillaApp (una sola instancia del hook).
 * Badge animado con número de notas compartidas con cambios no leídos.
 * Cuando hay alertas, el contenedor padre lo mantiene visible.
 *
 * Se usa en: PlantillaApp (dentro del contenedor de botones flotantes).
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelNotas } from './PanelNotas'
import type { useNotasRapidas } from '@/hooks/useNotasRapidas'

/** Ícono de nota minimalista — líneas de texto estilizadas */
function IconoNota({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8l6-6V5a2 2 0 0 0-2-2H6z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 21v-4a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

interface PropiedadesBotonNotas {
  notasRapidas?: ReturnType<typeof useNotasRapidas>
}

function BotonFlotanteNotas({ notasRapidas }: PropiedadesBotonNotas) {
  const [panelAbierto, setPanelAbierto] = useState(false)

  // Escucha evento global para abrir el panel desde otras partes de la app
  // (ej: acceso rápido del dashboard → window.dispatchEvent(new Event('flux:abrir-notas')))
  useEffect(() => {
    const abrir = () => setPanelAbierto(true)
    window.addEventListener('flux:abrir-notas', abrir)
    return () => window.removeEventListener('flux:abrir-notas', abrir)
  }, [])

  // Si no se pasa prop, no renderizar (necesita el hook del padre)
  if (!notasRapidas) return null

  const cantidadSinLeer = notasRapidas.compartidas.filter((n) => n._tiene_cambios).length
  const hayAlerta = cantidadSinLeer > 0

  return (
    <>
      {/* Botón flotante */}
      <AnimatePresence>
        {!panelAbierto && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setPanelAbierto(true)}
            // Cuando hay alertas sin leer subimos la saturación del ícono
            // al 100% para que se note que requiere atención. Sin alertas
            // queda al 70% como antes (presencia discreta).
            className={`size-12 flex items-center justify-center drop-shadow-lg transition-all duration-200 cursor-pointer relative ${
              hayAlerta
                ? 'text-acento-notas'
                : 'text-acento-notas/70 hover:text-acento-notas'
            }`}
            title={hayAlerta
              ? `Notas rápidas — ${cantidadSinLeer} sin leer`
              : 'Notas rápidas'}
          >
            {/* Halo respirante detrás del ícono cuando hay alertas. Le
                da presencia sin ser invasivo (animación de 2.4s). */}
            {hayAlerta && (
              <motion.span
                aria-hidden
                animate={{
                  scale: [1, 1.35, 1],
                  opacity: [0.45, 0, 0.45],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute inset-0 rounded-full bg-acento-notas/40 pointer-events-none"
              />
            )}
            <motion.span
              whileHover={{ scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="size-6 relative"
            >
              <IconoNota className="size-6" />
            </motion.span>

            {/* Badge con número de cambios sin leer */}
            {hayAlerta && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [1, 0.85, 1],
                }}
                transition={{
                  scale: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
                  opacity: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
                }}
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-insignia-peligro border-2 border-superficie-app flex items-center justify-center px-1 shadow-md shadow-insignia-peligro/40 z-10"
              >
                <span className="text-[10px] font-bold text-white leading-none">
                  {cantidadSinLeer > 9 ? '9+' : cantidadSinLeer}
                </span>
              </motion.span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel de notas */}
      <PanelNotas
        abierto={panelAbierto}
        onCerrar={() => setPanelAbierto(false)}
        notas={notasRapidas}
      />
    </>
  )
}

export { BotonFlotanteNotas }

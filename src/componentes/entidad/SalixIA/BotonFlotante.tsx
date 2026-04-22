'use client'

/**
 * BotonFlotante — Botón flotante de Salix IA.
 * Posición fija bottom-right. Al tocar, abre el PanelChat.
 * Usa el IconoSalix (logo Flux) con hover interactivo que separa las piezas.
 * Solo visible si el usuario tiene salix_ia_web = true.
 *
 * Se usa en: PlantillaApp (se renderiza una vez en el layout principal).
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelChat } from './PanelChat'
import { useAuth } from '@/hooks/useAuth'
import IconoSalix from '@/componentes/marca/IconoSalix'

interface PropiedadesBoton {
  /** Callback para avisar al padre que el hover está activo (para empujar al botón de arriba) */
  onHoverChange?: (hover: boolean) => void
}

function BotonFlotanteSalixIA({ onHoverChange }: PropiedadesBoton = {}) {
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [habilitado, setHabilitado] = useState(false)
  const [hover, setHover] = useState(false)
  const { usuario, cargando } = useAuth()

  // Verificar si Salix IA está habilitado — depende solo de que haya sesión
  useEffect(() => {
    if (cargando || !usuario) return

    const verificar = async () => {
      try {
        const res = await fetch('/api/salix-ia/estado')
        if (res.ok) {
          const data = await res.json()
          setHabilitado(data.habilitado)
        }
      } catch {
        // Si falla, no mostrar el botón
      }
    }

    verificar()
  }, [usuario, cargando])

  if (!habilitado) return null

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
            onMouseEnter={() => { setHover(true); onHoverChange?.(true) }}
            onMouseLeave={() => { setHover(false); onHoverChange?.(false) }}
            onClick={() => setPanelAbierto(true)}
            className="size-12 flex items-center justify-center text-texto-marca drop-shadow-lg transition-all duration-200 relative"
            title="Abrir Salix IA"
          >
            {/* Glow centrado detrás del ícono — rellena huecos entre piezas al separarse */}
            <motion.div
              animate={{
                scale: hover ? 1.15 : 0.85,
                opacity: hover ? 0.85 : 0,
              }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--superficie-app)',
                filter: 'blur(12px)',
                pointerEvents: 'none',
              }}
            />
            <IconoSalix
              tamano={hover ? 38 : 32}
              hover
              variante="estatico"
              className="transition-all duration-200 relative"
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel de chat */}
      <PanelChat
        abierto={panelAbierto}
        onCerrar={() => setPanelAbierto(false)}
      />
    </>
  )
}

export { BotonFlotanteSalixIA }

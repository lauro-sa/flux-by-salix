'use client'

/**
 * BotonFlotante — Botón flotante de Salix IA.
 * Posición fija bottom-right. Al tocar, abre el PanelChat.
 * Solo visible si el usuario tiene salix_ia_habilitado = true.
 *
 * Se usa en: PlantillaApp (se renderiza una vez en el layout principal).
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { PanelChat } from './PanelChat'
import { useAuth } from '@/hooks/useAuth'

function BotonFlotanteSalixIA() {
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [habilitado, setHabilitado] = useState(false)
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
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setPanelAbierto(true)}
            className="fixed right-4 bottom-20 md:bottom-6 z-[70] size-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25 flex items-center justify-center text-white hover:shadow-violet-500/40 transition-shadow"
            title="Abrir Salix IA"
          >
            <Sparkles className="size-5" />
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

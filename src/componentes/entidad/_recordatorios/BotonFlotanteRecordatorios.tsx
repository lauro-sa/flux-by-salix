'use client'

/**
 * BotonFlotanteRecordatorios — Botón flotante que abre el PanelRecordatorios.
 * Mismo patrón visual que BotonFlotanteNotas y BotonFlotanteSalixIA.
 * Muestra punto de aviso cuando hay recordatorios vencidos.
 *
 * Se usa en: PlantillaApp (stack de botones flotantes) — y dentro de
 * BotonesFlotantes como sub-botón expandido del speed-dial.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlarmClock } from 'lucide-react'
import { PanelRecordatorios } from './PanelRecordatorios'

function BotonFlotanteRecordatorios() {
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [vencidos, setVencidos] = useState(0)

  // Conteo liviano de vencidos para el badge (no depende de abrir el panel)
  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch('/api/recordatorios?estado=activos&limite=50')
        if (!res.ok) return
        const data = await res.json()
        const hoy = new Date().toISOString().slice(0, 10)
        const cantidad = (data.recordatorios || []).filter((r: { fecha: string }) => r.fecha < hoy).length
        setVencidos(cantidad)
      } catch { /* silenciar */ }
    }
    cargar()
    const interval = setInterval(cargar, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <AnimatePresence>
        {!panelAbierto && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setPanelAbierto(true)}
            className="size-12 flex items-center justify-center text-orange-400/60 hover:text-orange-400/85 drop-shadow-lg transition-all duration-200 cursor-pointer relative"
            title="Recordatorios"
          >
            <motion.span
              whileHover={{ scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="size-6 flex items-center justify-center"
            >
              <AlarmClock className="size-6" strokeWidth={1.75} />
            </motion.span>

            {vencidos > 0 && (
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
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-insignia-peligro border-2 border-superficie-app flex items-center justify-center px-1 shadow-md shadow-insignia-peligro/40"
              >
                <span className="text-[10px] font-bold text-white leading-none">
                  {vencidos > 9 ? '9+' : vencidos}
                </span>
              </motion.span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <PanelRecordatorios
        abierto={panelAbierto}
        onCerrar={() => setPanelAbierto(false)}
      />
    </>
  )
}

export { BotonFlotanteRecordatorios }

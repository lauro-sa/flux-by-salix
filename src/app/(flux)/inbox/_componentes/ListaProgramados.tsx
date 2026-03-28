'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import {
  Clock, X, Mail, User, Loader2,
} from 'lucide-react'
import type { CorreoProgramado } from '@/tipos/inbox'

/**
 * Lista de correos programados pendientes.
 * Se puede cancelar cada uno antes de que se envíe.
 */

export function ListaProgramados() {
  const [programados, setProgramados] = useState<CorreoProgramado[]>([])
  const [cargando, setCargando] = useState(false)
  const [cancelando, setCancelando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/inbox/correo/programar')
      const data = await res.json()
      setProgramados(data.programados || [])
    } catch { /* silenciar */ }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const cancelar = async (id: string) => {
    setCancelando(id)
    try {
      await fetch(`/api/inbox/correo/programar?id=${id}`, { method: 'DELETE' })
      setProgramados(prev => prev.filter(p => p.id !== id))
    } catch { /* silenciar */ }
    setCancelando(null)
  }

  if (cargando) {
    return (
      <div className="py-4 text-center">
        <Loader2 size={16} className="animate-spin mx-auto" style={{ color: 'var(--texto-terciario)' }} />
      </div>
    )
  }

  if (programados.length === 0) {
    return (
      <div className="py-6 text-center">
        <Clock size={20} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
        <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
          Sin correos programados
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>
        Correos programados ({programados.length})
      </p>
      <AnimatePresence>
        {programados.map((prog) => {
          const fechaEnvio = new Date(prog.enviar_en)
          const esHoy = fechaEnvio.toDateString() === new Date().toDateString()

          return (
            <motion.div
              key={prog.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-3 p-2.5 rounded-lg"
              style={{ background: 'var(--superficie-hover)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(37, 99, 235, 0.1)' }}
              >
                <Clock size={14} style={{ color: 'var(--canal-correo)' }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                    {prog.correo_asunto || '(Sin asunto)'}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                    Para: {prog.correo_para.join(', ')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Insignia color="info" tamano="sm">
                    {esHoy
                      ? `Hoy ${fechaEnvio.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
                      : fechaEnvio.toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    }
                  </Insignia>
                </div>
              </div>

              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                icono={cancelando === prog.id
                  ? <Loader2 size={12} className="animate-spin" />
                  : <X size={12} />
                }
                onClick={() => cancelar(prog.id)}
                disabled={cancelando === prog.id}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

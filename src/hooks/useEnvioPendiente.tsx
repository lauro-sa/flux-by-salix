'use client'

/**
 * useEnvioPendiente — Contexto global de "undo send" para correos.
 * Al enviar, el correo no sale de inmediato: se muestra un toast con countdown
 * de 30 segundos. El usuario puede cancelar (reabre el modal) o enviar ya.
 * Si el countdown llega a 0, se envía automáticamente.
 * Se usa en: EditorPresupuesto, y cualquier otro módulo que envíe correos.
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Undo2, Loader2, Clock } from 'lucide-react'

const SEGUNDOS_DESHACER = 30

interface DatosEnvioPendiente {
  id: string
  enviarFn: () => Promise<void>
  onDeshacer: () => void
  descripcion: string
}

interface ContextoEnvioPendiente {
  programarEnvio: (
    enviarFn: () => Promise<void>,
    opciones: { onDeshacer: () => void; descripcion: string },
  ) => void
  hayPendiente: boolean
}

const Contexto = createContext<ContextoEnvioPendiente | null>(null)

// ─── Toast visual con countdown ───

function ToastEnvioPendiente({
  segundos,
  descripcion,
  enviando,
  onDeshacer,
  onEnviarYa,
}: {
  segundos: number
  descripcion: string
  enviando: boolean
  onDeshacer: () => void
  onEnviarYa: () => void
}) {
  const progreso = (segundos / SEGUNDOS_DESHACER) * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="fixed top-4 right-4 z-[9999] w-[380px] bg-superficie-elevada border border-borde-sutil rounded-xl shadow-xl overflow-hidden"
    >
      {enviando ? (
        <div className="flex items-center gap-3 px-4 py-4">
          <Loader2 size={18} className="animate-spin text-texto-marca" />
          <span className="text-sm font-medium text-texto-primario">Enviando correo...</span>
        </div>
      ) : (
        <>
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-texto-terciario" />
              <span className="text-sm font-semibold text-texto-primario">
                Enviando en {segundos}s
              </span>
            </div>
            <p className="text-xs text-texto-terciario truncate">{descripcion}</p>
          </div>

          <div className="flex items-center gap-2 px-4 pb-3">
            <button
              onClick={onDeshacer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-insignia-advertencia/15 text-insignia-advertencia hover:bg-insignia-advertencia/25 transition-colors"
            >
              <Undo2 size={13} />
              Deshacer
            </button>
            <button
              onClick={onEnviarYa}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-texto-marca/15 text-texto-marca hover:bg-texto-marca/25 transition-colors"
            >
              <Send size={13} />
              Enviar ya
            </button>
          </div>

          {/* Barra de progreso */}
          <div className="h-0.5 bg-borde-sutil">
            <div
              className="h-full bg-texto-marca transition-all duration-1000 ease-linear"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </>
      )}
    </motion.div>
  )
}

// ─── Provider ───

function ProveedorEnvioPendiente({ children }: { children: ReactNode }) {
  const [pendiente, setPendiente] = useState<DatosEnvioPendiente | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Limpiar intervalo
  const limpiarIntervalo = useCallback(() => {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current)
      intervaloRef.current = null
    }
  }, [])

  // Ejecutar el envío real
  const ejecutarEnvio = useCallback(async () => {
    if (!pendiente || enviando) return
    setEnviando(true)
    limpiarIntervalo()
    try {
      await pendiente.enviarFn()
    } catch (err) {
      console.error('Error al enviar correo:', err)
    } finally {
      setEnviando(false)
      setPendiente(null)
      setSegundos(0)
    }
  }, [pendiente, enviando, limpiarIntervalo])

  // Countdown con setInterval
  useEffect(() => {
    if (!pendiente || segundos <= 0 || enviando) {
      limpiarIntervalo()
      return
    }
    intervaloRef.current = setInterval(() => {
      setSegundos(prev => {
        if (prev <= 1) {
          limpiarIntervalo()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return limpiarIntervalo
  }, [pendiente, segundos > 0, enviando, limpiarIntervalo])

  // Auto-enviar cuando llega a 0
  useEffect(() => {
    if (pendiente && segundos === 0 && !enviando) {
      ejecutarEnvio()
    }
  }, [segundos, pendiente, enviando, ejecutarEnvio])

  // Programar envío (API pública)
  const programarEnvio = useCallback((
    enviarFn: () => Promise<void>,
    opciones: { onDeshacer: () => void; descripcion: string },
  ) => {
    // Si hay uno pendiente, enviarlo inmediatamente
    if (pendiente && !enviando) {
      pendiente.enviarFn().catch(console.error)
    }
    limpiarIntervalo()
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setPendiente({ id, enviarFn, onDeshacer: opciones.onDeshacer, descripcion: opciones.descripcion })
    setSegundos(SEGUNDOS_DESHACER)
    setEnviando(false)
  }, [pendiente, enviando, limpiarIntervalo])

  // Deshacer (cancelar envío)
  const deshacer = useCallback(() => {
    if (!pendiente) return
    limpiarIntervalo()
    const callback = pendiente.onDeshacer
    setPendiente(null)
    setSegundos(0)
    setEnviando(false)
    callback()
  }, [pendiente, limpiarIntervalo])

  // Enviar ya (sin esperar countdown)
  const enviarYa = useCallback(() => {
    setSegundos(0)
  }, [])

  return (
    <Contexto.Provider value={{ programarEnvio, hayPendiente: !!pendiente }}>
      {children}
      <AnimatePresence>
        {pendiente && (
          <ToastEnvioPendiente
            key={pendiente.id}
            segundos={segundos}
            descripcion={pendiente.descripcion}
            enviando={enviando}
            onDeshacer={deshacer}
            onEnviarYa={enviarYa}
          />
        )}
      </AnimatePresence>
    </Contexto.Provider>
  )
}

function useEnvioPendiente() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useEnvioPendiente debe usarse dentro de <ProveedorEnvioPendiente>')
  return ctx
}

export { ProveedorEnvioPendiente, useEnvioPendiente }

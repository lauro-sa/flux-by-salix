'use client'

import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type TipoToast = 'exito' | 'error' | 'advertencia' | 'info'

interface DatosToast { id: string; tipo: TipoToast; mensaje: string; duracion?: number }
interface ContextoToast { mostrar: (tipo: TipoToast, mensaje: string, duracion?: number) => void }

const ContextoToastInterno = createContext<ContextoToast | null>(null)

const clasesToast: Record<TipoToast, string> = {
  exito: 'bg-insignia-exito-fondo text-insignia-exito-texto border-l-insignia-exito',
  error: 'bg-insignia-peligro-fondo text-insignia-peligro-texto border-l-insignia-peligro',
  advertencia: 'bg-insignia-advertencia-fondo text-insignia-advertencia-texto border-l-insignia-advertencia',
  info: 'bg-insignia-info-fondo text-insignia-info-texto border-l-insignia-info',
}

const iconosToast: Record<TipoToast, ReactNode> = {
  exito: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  advertencia: <AlertTriangle size={16} />,
  info: <Info size={16} />,
}

function ProveedorToast({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<DatosToast[]>([])
  const [pausados, setPausados] = useState<Set<string>>(new Set())

  const mostrar = useCallback((tipo: TipoToast, mensaje: string, duracion = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, tipo, mensaje, duracion }])
  }, [])

  const remover = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ContextoToastInterno.Provider value={{ mostrar }}>
      {children}
      <div className="fixed top-4 right-4 flex flex-col gap-2 z-[100] pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemover={() => remover(toast.id)}
              pausado={pausados.has(toast.id)}
              onPausar={() => setPausados((p) => new Set(p).add(toast.id))}
              onReanudar={() => setPausados((p) => { const n = new Set(p); n.delete(toast.id); return n })}
            />
          ))}
        </AnimatePresence>
      </div>
    </ContextoToastInterno.Provider>
  )
}

function ToastItem({ toast, onRemover, pausado, onPausar, onReanudar }: {
  toast: DatosToast; onRemover: () => void; pausado: boolean; onPausar: () => void; onReanudar: () => void
}) {
  useEffect(() => {
    if (pausado) return
    const timer = setTimeout(onRemover, toast.duracion || 4000)
    return () => clearTimeout(timer)
  }, [toast.duracion, onRemover, pausado])

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={onPausar}
      onMouseLeave={onReanudar}
      className={`flex items-center gap-3 px-4 py-3 rounded-md border-l-[3px] shadow-md text-sm font-medium pointer-events-auto max-w-[380px] ${clasesToast[toast.tipo]}`}
    >
      <span className="shrink-0">{iconosToast[toast.tipo]}</span>
      <span className="flex-1">{toast.mensaje}</span>
      <button onClick={onRemover} className="bg-transparent border-none text-current cursor-pointer opacity-60 hover:opacity-100 p-0">
        <X size={14} />
      </button>
    </motion.div>
  )
}

function useToast() {
  const ctx = useContext(ContextoToastInterno)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ProveedorToast>')
  return ctx
}

export { ProveedorToast, useToast, type TipoToast }

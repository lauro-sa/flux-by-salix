'use client'

import { useEffect, useState, useCallback, createContext, useContext, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, AlertTriangle, Info } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { sonidos } from '@/hooks/useSonido'

type TipoToast = 'exito' | 'error' | 'advertencia' | 'info'

interface DatosToast {
  id: string
  tipo: TipoToast
  mensaje: string
  duracion: number
  creado: number
}

interface ContextoToast {
  mostrar: (tipo: TipoToast, mensaje: string, duracion?: number) => void
}

const ContextoToastInterno = createContext<ContextoToast | null>(null)

/* ─── Configuración por tipo ─── */

const CONFIG_TIPO: Record<TipoToast, {
  icono: typeof Check
  colorIcono: string
  fondoIcono: string
  barra: string
}> = {
  exito: {
    icono: Check,
    colorIcono: 'var(--insignia-exito-texto)',
    fondoIcono: 'color-mix(in srgb, var(--insignia-exito-texto) 12%, transparent)',
    barra: 'var(--insignia-exito-texto)',
  },
  error: {
    icono: X,
    colorIcono: 'var(--insignia-peligro-texto)',
    fondoIcono: 'color-mix(in srgb, var(--insignia-peligro-texto) 12%, transparent)',
    barra: 'var(--insignia-peligro-texto)',
  },
  advertencia: {
    icono: AlertTriangle,
    colorIcono: 'var(--insignia-advertencia-texto)',
    fondoIcono: 'color-mix(in srgb, var(--insignia-advertencia-texto) 12%, transparent)',
    barra: 'var(--insignia-advertencia-texto)',
  },
  info: {
    icono: Info,
    colorIcono: 'var(--insignia-info-texto)',
    fondoIcono: 'color-mix(in srgb, var(--insignia-info-texto) 12%, transparent)',
    barra: 'var(--insignia-info-texto)',
  },
}

/* ─── Proveedor ─── */

function ProveedorToast({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<DatosToast[]>([])

  const mostrar = useCallback((tipo: TipoToast, mensaje: string, duracion = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => {
      const nuevos = [...prev, { id, tipo, mensaje, duracion, creado: Date.now() }]
      return nuevos.slice(-5)
    })
    // Sonido sutil según tipo
    if (tipo === 'exito') sonidos.pop()
    else if (tipo === 'error') sonidos.error()
    else if (tipo === 'advertencia' || tipo === 'info') sonidos.click()
  }, [])

  const remover = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ContextoToastInterno.Provider value={{ mostrar }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col-reverse gap-2.5 z-[10001] pointer-events-none max-sm:bottom-[calc(var(--safe-area-bottom,0px)+16px)] max-sm:right-4 max-sm:left-4">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemover={() => remover(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ContextoToastInterno.Provider>
  )
}

/* ─── Toast individual ─── */

function ToastItem({ toast, onRemover }: { toast: DatosToast; onRemover: () => void }) {
  const [pausado, setPausado] = useState(false)
  const restanteRef = useRef(toast.duracion)
  const inicioRef = useRef(Date.now())

  useEffect(() => {
    if (pausado) return
    inicioRef.current = Date.now()
    const timer = setTimeout(onRemover, restanteRef.current)
    return () => {
      // Guardar cuánto tiempo falta al pausar
      restanteRef.current = Math.max(0, restanteRef.current - (Date.now() - inicioRef.current))
      clearTimeout(timer)
    }
  }, [onRemover, pausado])

  const { icono: Icono, colorIcono, fondoIcono, barra } = CONFIG_TIPO[toast.tipo]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      className="pointer-events-auto"
    >
      <div
        className="relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl border border-borde-sutil shadow-elevada overflow-hidden max-w-[400px] max-sm:max-w-none backdrop-blur-sm"
        style={{ backgroundColor: 'var(--superficie-elevada)' }}
      >
        {/* Barra de progreso inferior */}
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] origin-left"
          style={{ backgroundColor: barra }}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: pausado ? undefined : 0 }}
          transition={pausado ? { duration: 0 } : {
            duration: restanteRef.current / 1000,
            ease: 'linear',
          }}
        />

        {/* Ícono con fondo */}
        <div
          className="size-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: fondoIcono }}
        >
          <Icono size={14} strokeWidth={2.5} style={{ color: colorIcono }} />
        </div>

        {/* Mensaje */}
        <span className="flex-1 text-sm text-texto-primario font-medium leading-snug">
          {toast.mensaje}
        </span>

        {/* Botón cerrar */}
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<X size={14} />}
          onClick={onRemover}
        />
      </div>
    </motion.div>
  )
}

/* ─── Hook ─── */

function useToast() {
  const ctx = useContext(ContextoToastInterno)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ProveedorToast>')
  return ctx
}

export { ProveedorToast, useToast, type TipoToast }

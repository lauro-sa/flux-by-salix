'use client'

import { useEffect, useState, useCallback, createContext, useContext, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, AlertTriangle, Info } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { sonidos } from '@/hooks/useSonido'

type TipoToast = 'exito' | 'error' | 'advertencia' | 'info'

interface AccionToast {
  /** Texto del botón. Ej: "Deshacer". */
  etiqueta: string
  /** Callback al hacer click. El toast se cierra automáticamente después. */
  onClick: () => void
}

interface DatosToast {
  id: string
  tipo: TipoToast
  mensaje: string
  duracion: number
  creado: number
  /** Acción opcional al final del toast (ej. botón Deshacer en eliminar). */
  accion?: AccionToast
  /** Progreso real de una tarea (0..total). Cuando está presente se muestra
   *  una barra de progreso real en vez del countdown de auto-cierre. */
  progreso?: { hechos: number; total: number }
  /** Si true, el toast no se auto-cierra. Para tareas con progreso. */
  persistente?: boolean
}

interface OpcionesToast {
  duracion?: number
  /** Acción tipo "deshacer". Se renderiza como botón al final del toast. */
  accion?: AccionToast
}

interface ContextoToast {
  mostrar: (tipo: TipoToast, mensaje: string, opcionesODuracion?: OpcionesToast | number) => void
  /** Inicia un toast persistente con barra de progreso real. Devuelve el id
   *  para actualizarlo o cerrarlo. */
  mostrarProgreso: (mensaje: string, total: number) => string
  /** Actualiza un toast de progreso en curso. */
  actualizarProgreso: (id: string, hechos: number, mensaje?: string) => void
  /** Cierra un toast de progreso. Si se pasa mensajeFinal, lo reemplaza por
   *  un toast normal con auto-cierre. */
  cerrarProgreso: (id: string, mensajeFinal?: string, tipoFinal?: TipoToast) => void
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

/** Rutas donde los toasts aparecen arriba en vez de abajo (pantallas mobile-first con bottom bar) */
const RUTAS_TOAST_ARRIBA = ['/recorrido']

function ProveedorToast({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<DatosToast[]>([])
  const pathname = usePathname()
  const arriba = RUTAS_TOAST_ARRIBA.some(r => pathname.startsWith(r))

  const mostrar = useCallback((
    tipo: TipoToast,
    mensaje: string,
    opcionesODuracion?: OpcionesToast | number,
  ) => {
    // Compat: el tercer parámetro acepta number (legacy) u objeto OpcionesToast.
    const opciones: OpcionesToast =
      typeof opcionesODuracion === 'number'
        ? { duracion: opcionesODuracion }
        : opcionesODuracion ?? {}
    const duracion = opciones.duracion ?? 4000
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => {
      const nuevos = [
        ...prev,
        { id, tipo, mensaje, duracion, creado: Date.now(), accion: opciones.accion },
      ]
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

  const mostrarProgreso = useCallback((mensaje: string, total: number) => {
    const id = `prog-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const nuevo: DatosToast = {
      id,
      tipo: 'info',
      mensaje,
      duracion: 0,
      creado: Date.now(),
      progreso: { hechos: 0, total },
      persistente: true,
    }
    setToasts((prev) => [...prev, nuevo].slice(-5))
    return id
  }, [])

  const actualizarProgreso = useCallback((id: string, hechos: number, mensaje?: string) => {
    setToasts((prev) => prev.map(t => {
      if (t.id !== id || !t.progreso) return t
      return {
        ...t,
        mensaje: mensaje ?? t.mensaje,
        progreso: { hechos, total: t.progreso.total },
      }
    }))
  }, [])

  const cerrarProgreso = useCallback((id: string, mensajeFinal?: string, tipoFinal: TipoToast = 'exito') => {
    setToasts((prev) => {
      const sinViejo = prev.filter(t => t.id !== id)
      if (!mensajeFinal) return sinViejo
      const final: DatosToast = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tipo: tipoFinal,
        mensaje: mensajeFinal,
        duracion: 4000,
        creado: Date.now(),
      }
      return [...sinViejo, final].slice(-5)
    })
    if (mensajeFinal) {
      if (tipoFinal === 'exito') sonidos.pop()
      else if (tipoFinal === 'error') sonidos.error()
    }
  }, [])

  const clasesPosicion = arriba
    ? 'fixed top-4 left-4 right-4 flex flex-col gap-2.5 z-[var(--z-toast)] pointer-events-none md:left-auto md:right-6 md:top-6'
    : 'fixed bottom-6 right-6 flex flex-col-reverse gap-2.5 z-[var(--z-toast)] pointer-events-none max-sm:bottom-[calc(var(--safe-area-bottom,0px)+16px)] max-sm:right-4 max-sm:left-4'

  return (
    <ContextoToastInterno.Provider value={{ mostrar, mostrarProgreso, actualizarProgreso, cerrarProgreso }}>
      {children}
      <div
        className={clasesPosicion}
        style={arriba ? { paddingTop: 'env(safe-area-inset-top, 0px)' } : undefined}
      >
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
    // Toasts persistentes (con progreso real de una tarea) no se auto-cierran.
    if (toast.persistente) return
    if (pausado) return
    inicioRef.current = Date.now()
    const timer = setTimeout(onRemover, restanteRef.current)
    return () => {
      // Guardar cuánto tiempo falta al pausar
      restanteRef.current = Math.max(0, restanteRef.current - (Date.now() - inicioRef.current))
      clearTimeout(timer)
    }
  }, [onRemover, pausado, toast.persistente])

  const { icono: Icono, colorIcono, fondoIcono, barra } = CONFIG_TIPO[toast.tipo]
  const progreso = toast.progreso
  const fraccion = progreso ? Math.min(1, Math.max(0, progreso.hechos / Math.max(progreso.total, 1))) : null

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
        className="relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-card border border-borde-sutil shadow-elevada overflow-hidden max-w-[400px] max-sm:max-w-none backdrop-blur-sm"
        style={{ backgroundColor: 'var(--superficie-elevada)' }}
      >
        {/* Barra de progreso inferior. Si el toast tiene `progreso` real,
            mostramos esa fracción (crece de 0→1 según avanza la tarea).
            Si no, es el countdown del auto-cierre (decrece 1→0). */}
        {fraccion !== null ? (
          <motion.div
            className="absolute bottom-0 left-0 h-[2px] origin-left"
            style={{ backgroundColor: barra, width: '100%' }}
            initial={false}
            animate={{ scaleX: fraccion }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        ) : (
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
        )}

        {/* Ícono con fondo */}
        <div
          className="size-7 rounded-card flex items-center justify-center shrink-0"
          style={{ backgroundColor: fondoIcono }}
        >
          <Icono size={14} strokeWidth={2.5} style={{ color: colorIcono }} />
        </div>

        {/* Mensaje */}
        <span className="flex-1 text-sm text-texto-primario font-medium leading-snug">
          {toast.mensaje}
        </span>

        {/* Acción opcional (ej. "Deshacer"). Click ejecuta callback y cierra. */}
        {toast.accion && (
          <button
            type="button"
            onClick={() => {
              toast.accion?.onClick()
              onRemover()
            }}
            className="text-xs font-medium text-texto-marca hover:underline px-1.5 py-1 rounded transition-colors"
          >
            {toast.accion.etiqueta}
          </button>
        )}

        {/* Botón cerrar */}
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          titulo="Cerrar"
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

'use client'

/**
 * useCambiosPendientes — Sistema global de detección de cambios sin guardar.
 *
 * Usado por: cualquier pantalla (página, NO modal) con botón "Guardar" manual.
 *
 * Arquitectura:
 * - ProveedorCambiosPendientes: context provider, va en el layout (flux).
 * - useCambiosSinGuardar(config): hook que cada pantalla usa para declarar su
 *   estado dirty + callbacks Guardar/Descartar. Se limpia al desmontar.
 * - ModalCambiosSinGuardar: modal de confirmación, renderizado por el provider.
 * - useNavegarProtegido: devuelve `navegar(fn)` que respeta el estado dirty.
 *
 * Cómo funciona:
 * 1. Una pantalla con form llama a useCambiosSinGuardar({ dirty, cambios, onGuardar })
 *    mientras tenga cambios locales. Mientras dirty=true, el provider sabe que
 *    hay cambios.
 * 2. El Sidebar (y cualquier navegación programática) llama a intentarNavegar(fn).
 *    Si hay dirty, muestra el modal enumerando los cambios. Si no, ejecuta fn.
 * 3. beforeunload nativo previene cerrar pestaña/recargar si hay cambios.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { AlertTriangle, Save, Trash2, X } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useTema } from '@/hooks/useTema'

/** Descripción legible de un cambio (ej: "Permiso Asignar en Visitas → activado") */
export interface CambioDescrito {
  campo: string
  valor?: string
}

/** Registro activo de una pantalla con cambios sin guardar. */
interface RegistroActivo {
  id: string
  titulo: string
  cambios: CambioDescrito[]
  onGuardar: () => Promise<void>
  onDescartar?: () => void | Promise<void>
}

interface ContextoCambiosPendientes {
  /** ¿Hay alguna pantalla registrada con cambios sin guardar? */
  hayCambios: boolean
  /** Registra o actualiza el estado dirty de una pantalla. */
  registrar: (registro: RegistroActivo) => void
  /** Limpia el registro de una pantalla (al desmontar o al guardar). */
  limpiar: (id: string) => void
  /** Intenta ejecutar una acción de navegación. Si hay cambios, pide confirmación. */
  intentarNavegar: (fn: () => void) => void
}

const ContextoCambios = createContext<ContextoCambiosPendientes | null>(null)

export function ProveedorCambiosPendientes({ children }: { children: ReactNode }) {
  // Map de registros activos (puede haber varios si una pantalla tiene sub-forms)
  const [registros, setRegistros] = useState<Map<string, RegistroActivo>>(new Map())
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // Función pendiente de ejecutar cuando el usuario decide (guardar o descartar)
  const accionPendienteRef = useRef<(() => void) | null>(null)

  const hayCambios = registros.size > 0

  const registrar = useCallback((registro: RegistroActivo) => {
    setRegistros(prev => {
      const nuevo = new Map(prev)
      nuevo.set(registro.id, registro)
      return nuevo
    })
  }, [])

  const limpiar = useCallback((id: string) => {
    setRegistros(prev => {
      if (!prev.has(id)) return prev
      const nuevo = new Map(prev)
      nuevo.delete(id)
      return nuevo
    })
  }, [])

  const intentarNavegar = useCallback((fn: () => void) => {
    if (registros.size === 0) { fn(); return }
    accionPendienteRef.current = fn
    setModalAbierto(true)
  }, [registros.size])

  // beforeunload: previene cerrar pestaña/recargar cuando hay cambios
  useEffect(() => {
    if (!hayCambios) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Navegadores modernos ignoran el mensaje custom pero requieren returnValue
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hayCambios])

  // Cerrar modal sin tomar acción (cancelar)
  const cancelar = useCallback(() => {
    accionPendienteRef.current = null
    setModalAbierto(false)
  }, [])

  // Guardar todo y luego navegar
  const guardarYContinuar = useCallback(async () => {
    const accion = accionPendienteRef.current
    setGuardando(true)
    try {
      for (const reg of registros.values()) {
        await reg.onGuardar()
      }
      // Limpiar todos los registros después de guardar
      setRegistros(new Map())
      setModalAbierto(false)
      accionPendienteRef.current = null
      if (accion) accion()
    } catch {
      // Si guardar falla, no navegar. El caller debe mostrar su propio toast.
    } finally {
      setGuardando(false)
    }
  }, [registros])

  // Descartar cambios y navegar
  const descartarYContinuar = useCallback(async () => {
    const accion = accionPendienteRef.current
    // Ejecutar onDescartar de cada registro si lo tiene
    for (const reg of registros.values()) {
      if (reg.onDescartar) {
        try { await reg.onDescartar() } catch { /* ignorar */ }
      }
    }
    setRegistros(new Map())
    setModalAbierto(false)
    accionPendienteRef.current = null
    if (accion) accion()
  }, [registros])

  const valor: ContextoCambiosPendientes = useMemo(() => ({
    hayCambios, registrar, limpiar, intentarNavegar,
  }), [hayCambios, registrar, limpiar, intentarNavegar])

  return (
    <ContextoCambios.Provider value={valor}>
      {children}
      <ModalCambiosSinGuardar
        abierto={modalAbierto}
        registros={[...registros.values()]}
        guardando={guardando}
        onCancelar={cancelar}
        onGuardar={guardarYContinuar}
        onDescartar={descartarYContinuar}
      />
    </ContextoCambios.Provider>
  )
}

/** Hook para consumir el contexto. Tira si se usa fuera del provider. */
function useContextoCambios(): ContextoCambiosPendientes {
  const ctx = useContext(ContextoCambios)
  if (!ctx) throw new Error('useContextoCambios debe usarse dentro de ProveedorCambiosPendientes')
  return ctx
}

/**
 * Hook que una pantalla con "Guardar" manual usa para declarar su estado dirty.
 * Al montar/actualizar con dirty=true: se registra. Al desmontar o dirty=false: se limpia.
 */
export function useCambiosSinGuardar(config: {
  id: string
  dirty: boolean
  titulo: string
  cambios: CambioDescrito[]
  onGuardar: () => Promise<void>
  onDescartar?: () => void | Promise<void>
}) {
  const { registrar, limpiar } = useContextoCambios()
  const { id, dirty, titulo, cambios, onGuardar, onDescartar } = config

  // Guardar refs a callbacks para no recrear el registro en cada render
  const onGuardarRef = useRef(onGuardar)
  const onDescartarRef = useRef(onDescartar)
  useEffect(() => { onGuardarRef.current = onGuardar }, [onGuardar])
  useEffect(() => { onDescartarRef.current = onDescartar }, [onDescartar])

  useEffect(() => {
    if (dirty) {
      registrar({
        id,
        titulo,
        cambios,
        onGuardar: () => onGuardarRef.current(),
        onDescartar: () => onDescartarRef.current?.(),
      })
    } else {
      limpiar(id)
    }
  }, [id, dirty, titulo, cambios, registrar, limpiar])

  // Limpiar al desmontar
  useEffect(() => {
    return () => { limpiar(id) }
  }, [id, limpiar])
}

/** Hook para ejecutar navegaciones respetando el estado dirty. */
export function useNavegarProtegido() {
  const { intentarNavegar } = useContextoCambios()
  return intentarNavegar
}

// ─────────────────────────────────────────────────────────────
// Modal visual
// ─────────────────────────────────────────────────────────────

interface PropsModal {
  abierto: boolean
  registros: RegistroActivo[]
  guardando: boolean
  onCancelar: () => void
  onGuardar: () => void
  onDescartar: () => void
}

function ModalCambiosSinGuardar({ abierto, registros, guardando, onCancelar, onGuardar, onDescartar }: PropsModal) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'

  // Total de cambios a través de todos los registros
  const totalCambios = registros.reduce((sum, r) => sum + r.cambios.length, 0)

  // Escape cierra el modal
  useEffect(() => {
    if (!abierto) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !guardando) onCancelar() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [abierto, guardando, onCancelar])

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0" style={{ zIndex: 'var(--z-modal)' as unknown as number }}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="absolute inset-0"
            style={{ backgroundColor: esCristal ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)' }}
            onClick={guardando ? undefined : onCancelar}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              role="alertdialog"
              aria-modal="true"
              aria-label="Cambios sin guardar"
              className="rounded-modal shadow-elevada w-full max-w-md flex flex-col pointer-events-auto border border-borde-sutil max-h-[min(85dvh,640px)]"
              style={{
                ...(esCristal ? {
                  backgroundColor: 'var(--superficie-flotante)',
                  backdropFilter: 'blur(32px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
                } : {
                  backgroundColor: 'var(--superficie-elevada)',
                }),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Encabezado */}
              <div className="flex items-start gap-3 px-6 pt-5 pb-3">
                <div className="shrink-0 size-9 rounded-boton bg-insignia-advertencia/15 flex items-center justify-center">
                  <AlertTriangle size={17} className="text-insignia-advertencia" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[15px] font-semibold text-texto-primario">Tenés cambios sin guardar</h2>
                  <p className="text-xs text-texto-terciario mt-0.5">
                    Si salís ahora, {totalCambios === 0 ? 'los cambios' : totalCambios === 1 ? 'el cambio' : `los ${totalCambios} cambios`} se van a perder.
                  </p>
                </div>
                {!guardando && (
                  <button
                    onClick={onCancelar}
                    aria-label="Cerrar"
                    className="shrink-0 flex items-center justify-center size-7 rounded-boton border border-white/[0.08] bg-transparent text-texto-terciario cursor-pointer hover:bg-white/[0.06] hover:text-texto-secundario transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Lista de cambios */}
              <div className="px-6 pb-2 flex-1 overflow-y-auto">
                {registros.map(reg => (
                  <div key={reg.id} className="mb-3 last:mb-0">
                    <div className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
                      {reg.titulo}
                    </div>
                    {reg.cambios.length > 0 ? (
                      <ul className="space-y-1">
                        {reg.cambios.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px] text-texto-secundario">
                            <span className="mt-1.5 size-1 rounded-full bg-insignia-advertencia shrink-0" />
                            <span className="flex-1">
                              <span className="text-texto-primario">{c.campo}</span>
                              {c.valor && <span className="text-texto-terciario"> · {c.valor}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-texto-terciario italic">Hay cambios sin guardar.</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-white/[0.07] shrink-0">
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  icono={<Trash2 size={14} />}
                  onClick={onDescartar}
                  disabled={guardando}
                >
                  Descartar
                </Boton>
                <div className="flex items-center gap-2">
                  <Boton variante="secundario" tamano="sm" onClick={onCancelar} disabled={guardando}>
                    Cancelar
                  </Boton>
                  <Boton
                    variante="primario"
                    tamano="sm"
                    icono={<Save size={14} />}
                    onClick={onGuardar}
                    cargando={guardando}
                  >
                    Guardar y salir
                  </Boton>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

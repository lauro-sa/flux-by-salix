'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pin, PinOff, UserRoundPlus, BellOff, Bell,
  Eye, EyeOff, KanbanSquare, Ban, Trash2, Search, X, Check,
} from 'lucide-react'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useTema } from '@/hooks/useTema'
import type { ConversacionConDetalles } from '@/tipos/inbox'

/**
 * MenuConversacion — Menú contextual para acciones sobre una conversación.
 * Desktop: dropdown posicionado en las coordenadas del click derecho.
 * Mobile (posicion === null): bottom sheet que desliza desde abajo.
 * Se usa en: ListaConversaciones (onContextMenu en desktop, botón 3 puntos en mobile).
 */

interface PropiedadesMenuConversacion {
  conversacion: ConversacionConDetalles
  posicion: { x: number; y: number } | null
  abierto: boolean
  onCerrar: () => void
  onAccion: (accion: string, datos?: unknown) => void
  esAdmin: boolean
  estaFijada: boolean
  estaSilenciada: boolean
}

/** Miembro del equipo para el sub-modal de fijar para usuario */
interface MiembroEquipo {
  id: string
  nombre: string
  apellido: string | null
  avatar_url: string | null
}

// ─── Ítems del menú ───

interface ItemMenu {
  clave: string
  etiqueta: string
  icono: React.ReactNode
  peligro?: boolean
  soloAdmin?: boolean
  separadorAntes?: boolean
}

function obtenerItems(
  conv: ConversacionConDetalles,
  estaFijada: boolean,
  estaSilenciada: boolean,
): ItemMenu[] {
  return [
    {
      clave: 'fijar',
      etiqueta: estaFijada ? 'Desfijar' : 'Fijar para mí',
      icono: estaFijada ? <PinOff size={16} /> : <Pin size={16} />,
    },
    {
      clave: 'fijar_para_usuario',
      etiqueta: 'Fijar para un usuario...',
      icono: <UserRoundPlus size={16} />,
    },
    {
      clave: 'silenciar',
      etiqueta: estaSilenciada ? 'Desilenciar' : 'Silenciar',
      icono: estaSilenciada ? <Bell size={16} /> : <BellOff size={16} />,
    },
    {
      clave: 'marcar_lectura',
      etiqueta: conv.mensajes_sin_leer > 0 ? 'Marcar como leído' : 'Marcar como no leído',
      icono: conv.mensajes_sin_leer > 0 ? <Eye size={16} /> : <EyeOff size={16} />,
    },
    {
      clave: 'pipeline',
      etiqueta: conv.en_pipeline ? 'Quitar del pipeline' : 'Seguir en pipeline',
      icono: <KanbanSquare size={16} />,
    },
    {
      clave: 'bloquear',
      etiqueta: 'Bloquear número',
      icono: <Ban size={16} />,
      peligro: true,
      soloAdmin: true,
      separadorAntes: true,
    },
    {
      clave: 'papelera',
      etiqueta: 'Mover a papelera',
      icono: <Trash2 size={16} />,
      peligro: true,
      soloAdmin: true,
    },
  ]
}

// ─── Componente principal ───

function MenuConversacion({
  conversacion,
  posicion,
  abierto,
  onCerrar,
  onAccion,
  esAdmin,
  estaFijada,
  estaSilenciada,
}: PropiedadesMenuConversacion) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const menuRef = useRef<HTMLDivElement>(null)

  // Sub-modales
  const [modalBloquear, setModalBloquear] = useState(false)
  const [modalPapelera, setModalPapelera] = useState(false)
  const [modalFijarUsuario, setModalFijarUsuario] = useState(false)

  // Miembros para sub-modal
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([])
  const [miembrosCargando, setMiembrosCargando] = useState(false)
  const [busquedaMiembros, setBusquedaMiembros] = useState('')
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState<Set<string>>(new Set())

  const items = obtenerItems(conversacion, estaFijada, estaSilenciada)

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [abierto, onCerrar])

  // Cerrar al hacer click fuera (desktop)
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCerrar()
      }
    }
    // Timeout para evitar que el mismo click derecho lo cierre
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [abierto, onCerrar])

  // Cargar miembros cuando se abre el sub-modal
  const cargarMiembros = useCallback(async () => {
    setMiembrosCargando(true)
    try {
      const res = await fetch('/api/miembros')
      if (res.ok) {
        const datos = await res.json()
        setMiembros(datos.miembros || datos || [])
      }
    } catch {
      // Silenciar error
    } finally {
      setMiembrosCargando(false)
    }
  }, [])

  const manejarClick = useCallback((clave: string) => {
    switch (clave) {
      case 'bloquear':
        setModalBloquear(true)
        return
      case 'papelera':
        setModalPapelera(true)
        return
      case 'fijar_para_usuario':
        setModalFijarUsuario(true)
        cargarMiembros()
        return
      default:
        onAccion(clave)
        onCerrar()
    }
  }, [onAccion, onCerrar, cargarMiembros])

  const confirmarBloquear = useCallback(() => {
    onAccion('bloquear')
    setModalBloquear(false)
    onCerrar()
  }, [onAccion, onCerrar])

  const confirmarPapelera = useCallback(() => {
    onAccion('papelera')
    setModalPapelera(false)
    onCerrar()
  }, [onAccion, onCerrar])

  const confirmarFijarUsuario = useCallback(() => {
    onAccion('fijar_para_usuario', { usuario_ids: [...miembrosSeleccionados] })
    setModalFijarUsuario(false)
    setMiembrosSeleccionados(new Set())
    setBusquedaMiembros('')
    onCerrar()
  }, [onAccion, onCerrar, miembrosSeleccionados])

  const toggleMiembro = useCallback((id: string) => {
    setMiembrosSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Filtrar miembros por búsqueda
  const miembrosFiltrados = miembros.filter(m => {
    if (!busquedaMiembros) return true
    const texto = `${m.nombre} ${m.apellido || ''}`.toLowerCase()
    return texto.includes(busquedaMiembros.toLowerCase())
  })

  // Estilos del panel
  const estiloPanel: React.CSSProperties = esCristal ? {
    backgroundColor: 'var(--superficie-flotante)',
    backdropFilter: 'blur(32px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
  } : {
    backgroundColor: 'var(--superficie-elevada)',
  }

  // Calcular posición del dropdown (desktop) para no salir del viewport
  const calcularPosicionDesktop = (): React.CSSProperties => {
    if (!posicion) return {}
    const anchoMenu = 220
    const altoEstimado = 320
    const margen = 8

    let left = posicion.x
    let top = posicion.y

    // Ajustar si se sale por la derecha
    if (left + anchoMenu > window.innerWidth - margen) {
      left = window.innerWidth - anchoMenu - margen
    }
    // Ajustar si se sale por abajo
    if (top + altoEstimado > window.innerHeight - margen) {
      top = window.innerHeight - altoEstimado - margen
    }
    // No salir por arriba ni izquierda
    if (left < margen) left = margen
    if (top < margen) top = margen

    return {
      position: 'fixed',
      left,
      top,
      zIndex: 'var(--z-popover, 50)' as unknown as number,
    }
  }

  if (typeof window === 'undefined') return null

  const esMobile = posicion === null

  // ─── Renderizado del menú ───

  const contenidoMenu = (
    <>
      {items
        .filter(item => !item.soloAdmin || esAdmin)
        .map((item) => (
          <div key={item.clave}>
            {item.separadorAntes && (
              <div className="my-1" style={{ borderTop: '1px solid var(--borde-sutil)' }} />
            )}
            <button
              onClick={() => manejarClick(item.clave)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors rounded-card hover:bg-[var(--superficie-hover)] cursor-pointer"
              style={{
                color: item.peligro ? 'var(--insignia-peligro)' : 'var(--texto-primario)',
                background: 'transparent',
                border: 'none',
                minHeight: 40,
              }}
            >
              <span className="flex-shrink-0" style={{ opacity: 0.8 }}>
                {item.icono}
              </span>
              <span className="truncate">{item.etiqueta}</span>
            </button>
          </div>
        ))
      }
    </>
  )

  return createPortal(
    <>
      <AnimatePresence>
        {abierto && (
          <>
            {/* ── Desktop: dropdown posicionado ── */}
            {!esMobile && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="rounded-card border border-borde-sutil shadow-elevada overflow-hidden p-1"
                style={{
                  ...calcularPosicionDesktop(),
                  ...estiloPanel,
                  width: 220,
                }}
              >
                {contenidoMenu}
              </motion.div>
            )}

            {/* ── Mobile: bottom sheet ── */}
            {esMobile && (
              <>
                {/* Overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.25)',
                    zIndex: 'var(--z-modal, 60)' as unknown as number,
                  }}
                  onClick={onCerrar}
                />
                {/* Sheet */}
                <motion.div
                  ref={menuRef}
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="fixed bottom-0 left-0 right-0 rounded-t-2xl border-t border-borde-sutil shadow-elevada p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
                  style={{
                    ...estiloPanel,
                    zIndex: 'var(--z-modal, 60)' as unknown as number,
                  }}
                >
                  {/* Handle */}
                  <div className="flex justify-center py-2 mb-1">
                    <div
                      className="w-8 h-1 rounded-full"
                      style={{ background: 'var(--borde-fuerte)' }}
                    />
                  </div>
                  {/* Info de la conversación */}
                  <div className="flex items-center gap-2 px-3 pb-2 mb-1" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
                    <Avatar
                      nombre={conversacion.contacto_nombre || conversacion.identificador_externo || '?'}
                      tamano="sm"
                    />
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                      {conversacion.contacto_nombre || conversacion.identificador_externo || 'Desconocido'}
                    </span>
                  </div>
                  {contenidoMenu}
                </motion.div>
              </>
            )}
          </>
        )}
      </AnimatePresence>

      {/* ── Modales de confirmación ── */}
      <ModalConfirmacion
        abierto={modalBloquear}
        onCerrar={() => setModalBloquear(false)}
        onConfirmar={confirmarBloquear}
        titulo="Bloquear número"
        descripcion={`Se bloqueará el número ${conversacion.identificador_externo || ''}. No se recibirán más mensajes de este contacto.`}
        tipo="peligro"
        etiquetaConfirmar="Bloquear"
      />

      <ModalConfirmacion
        abierto={modalPapelera}
        onCerrar={() => setModalPapelera(false)}
        onConfirmar={confirmarPapelera}
        titulo="Mover a papelera"
        descripcion="La conversación se moverá a la papelera. Podrás recuperarla durante los próximos 15 días."
        tipo="peligro"
        etiquetaConfirmar="Mover a papelera"
      />

      {/* ── Sub-modal: Fijar para un usuario ── */}
      <AnimatePresence>
        {modalFijarUsuario && createPortal(
          <div className="fixed inset-0" style={{ zIndex: 'var(--z-modal, 60)' as unknown as number }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
              onClick={() => { setModalFijarUsuario(false); setBusquedaMiembros(''); setMiembrosSeleccionados(new Set()) }}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.18 }}
                className="rounded-card border border-borde-sutil shadow-elevada w-full max-w-[380px] flex flex-col pointer-events-auto"
                style={{ ...estiloPanel, maxHeight: '70dvh' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil shrink-0">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                    Fijar para un usuario
                  </h3>
                  <button
                    onClick={() => { setModalFijarUsuario(false); setBusquedaMiembros(''); setMiembrosSeleccionados(new Set()) }}
                    className="flex items-center justify-center size-7 rounded-card hover:bg-[var(--superficie-hover)] transition-colors cursor-pointer"
                    style={{ color: 'var(--texto-terciario)', background: 'transparent', border: 'none' }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Buscador */}
                <div className="px-3 py-2 shrink-0">
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-card"
                    style={{ background: 'var(--superficie-hover)', border: '1px solid var(--borde-sutil)' }}
                  >
                    <Search size={14} style={{ color: 'var(--texto-terciario)' }} />
                    <input
                      type="text"
                      value={busquedaMiembros}
                      onChange={e => setBusquedaMiembros(e.target.value)}
                      placeholder="Buscar miembro..."
                      className="flex-1 text-sm bg-transparent border-none outline-none"
                      style={{ color: 'var(--texto-primario)' }}
                    />
                  </div>
                </div>

                {/* Lista de miembros */}
                <div className="flex-1 overflow-y-auto px-2 py-1" style={{ maxHeight: '40dvh' }}>
                  {miembrosCargando ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Cargando...</span>
                    </div>
                  ) : miembrosFiltrados.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                        {busquedaMiembros ? 'Sin resultados' : 'Sin miembros'}
                      </span>
                    </div>
                  ) : (
                    miembrosFiltrados.map(m => {
                      const seleccionado = miembrosSeleccionados.has(m.id)
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleMiembro(m.id)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-card transition-colors hover:bg-[var(--superficie-hover)] cursor-pointer"
                          style={{
                            background: seleccionado ? 'var(--superficie-seleccionada)' : 'transparent',
                            border: 'none',
                          }}
                        >
                          <Avatar nombre={`${m.nombre} ${m.apellido || ''}`} tamano="xs" />
                          <span className="flex-1 text-sm text-left truncate" style={{ color: 'var(--texto-primario)' }}>
                            {m.nombre} {m.apellido || ''}
                          </span>
                          {seleccionado && (
                            <Check size={14} style={{ color: 'var(--texto-marca)' }} />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>

                {/* Footer con acciones */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-borde-sutil shrink-0">
                  <Boton
                    variante="secundario"
                    tamano="sm"
                    onClick={() => { setModalFijarUsuario(false); setBusquedaMiembros(''); setMiembrosSeleccionados(new Set()) }}
                  >
                    Cancelar
                  </Boton>
                  <Boton
                    variante="primario"
                    tamano="sm"
                    onClick={confirmarFijarUsuario}
                    disabled={miembrosSeleccionados.size === 0}
                  >
                    Fijar ({miembrosSeleccionados.size})
                  </Boton>
                </div>
              </motion.div>
            </div>
          </div>,
          document.body,
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}

export { MenuConversacion, type PropiedadesMenuConversacion }

'use client'

/**
 * Sidebar — Barra lateral completa de Flux.
 * Shell que maneja los layouts (normal, auto-ocultar, movil drawer).
 * Delega todo el contenido interno a SidebarContenido.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useSwipe } from '@/hooks/useSwipe'
import type { PropiedadesSidebar } from './tipos'
import { SidebarContenido } from './SidebarContenido'

function Sidebar({
  colapsado,
  onToggle,
  mobilAbierto,
  onCerrarMobil,
  autoOcultar,
  hoverExpandido,
  onMouseEnter,
  onMouseLeave,
  onMenuActivoChange,
}: PropiedadesSidebar) {
  // Swipe para cerrar el drawer en movil
  const swipeProps = useSwipe({ onSwipeIzquierda: onCerrarMobil })

  const contenido = (
    <SidebarContenido
      colapsado={colapsado}
      onToggle={onToggle}
      onCerrarMobil={onCerrarMobil}
      onMenuActivoChange={onMenuActivoChange}
    />
  )

  return (
    <>
      {/* Modo normal (sin auto-ocultar) */}
      {!autoOcultar && (
        <aside
          className="hidden md:block fixed top-0 left-0 h-dvh border-r border-borde-sutil bg-superficie-sidebar z-30 transition-[width] duration-200 cristal-panel overflow-hidden sidebar-scroll"
          style={{ width: colapsado ? 'var(--sidebar-ancho-colapsado)' : 'var(--sidebar-ancho)' }}
          aria-label="Barra lateral"
        >
          {contenido}
        </aside>
      )}

      {/* Modo auto-ocultar: barra minimizada + expansion al hover/foco.
          onFocus/Blur (capture) permite que la sidebar se mantenga abierta
          cuando el usuario navega con teclado (Tab). */}
      {autoOcultar && (
        <aside
          className="hidden md:flex fixed top-0 left-0 h-dvh bg-superficie-sidebar z-50 cristal-panel overflow-hidden sidebar-scroll border-r border-borde-sutil"
          style={{
            width: hoverExpandido ? 'var(--sidebar-ancho)' : 'var(--sidebar-ancho-colapsado)',
            // Shadow nunca pasa a 'none' bruscamente — siempre interpola desde un shadow transparente
            boxShadow: hoverExpandido ? '4px 0 24px rgba(0,0,0,0.25)' : '0 0 0 rgba(0,0,0,0)',
            transition: hoverExpandido
              ? 'width 400ms cubic-bezier(0.4,0,0.2,1), box-shadow 400ms cubic-bezier(0.4,0,0.2,1)'
              : 'width 150ms cubic-bezier(0.4,0,0.2,1), box-shadow 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocusCapture={onMouseEnter}
          onBlurCapture={(e) => {
            // Solo cerrar si el foco se va fuera del aside
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              onMouseLeave?.()
            }
          }}
          aria-label="Barra lateral"
        >
          {contenido}
        </aside>
      )}

      {/* Drawer movil */}
      <AnimatePresence>
        {mobilAbierto && (<>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrarMobil} className="fixed inset-0 bg-black/40" style={{ zIndex: 'var(--z-modal)' as unknown as number }} />
          <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed top-0 left-0 h-dvh w-[80vw] max-w-[320px] bg-superficie-sidebar border-r border-borde-sutil cristal-panel" style={{ zIndex: 'calc(var(--z-modal) + 1)' as unknown as number, paddingTop: 'var(--safe-area-top)' }} {...swipeProps}>
            <SidebarContenido
              colapsado={false}
              onToggle={onToggle}
              onCerrarMobil={onCerrarMobil}
            />
          </motion.aside>
        </>)}
      </AnimatePresence>
    </>
  )
}

export { Sidebar }
export type { PropiedadesSidebar }

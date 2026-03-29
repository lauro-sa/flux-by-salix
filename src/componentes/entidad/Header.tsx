'use client'

import { useState, useRef, useEffect } from 'react'
import { useTema } from '@/hooks/useTema'
import { useTraduccion } from '@/lib/i18n'
import { Migajas } from './Migajas'
import { PanelLeft, PanelLeftClose, Moon, Sun, Monitor, Check, Globe, ChevronsLeft, ChevronsRight, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import type { Migaja } from '@/hooks/useNavegacion'

const BANDERAS: Record<string, string> = {
  es: '🇪🇸',
  en: '🇺🇸',
  pt: '🇧🇷',
}

/**
 * Header — Barra superior compacta estilo Linear.
 * Desktop: botón sidebar + migajas + acciones.
 * Mobile: botón drawer + título + acciones.
 */

interface PropiedadesHeader {
  onAbrirMenuMobil: () => void
  onToggleSidebar: () => void
  sidebarColapsado: boolean
  seccionActual: string
  tienePreferenciaSeccion: boolean
  onAplicarATodas: (colapsado: boolean) => void
  onLimpiarSeccion: () => void
  migajasExtras?: Migaja[]
}

function Header({
  onAbrirMenuMobil,
  onToggleSidebar,
  sidebarColapsado,
  seccionActual,
  tienePreferenciaSeccion,
  onAplicarATodas,
  onLimpiarSeccion,
  migajasExtras,
}: PropiedadesHeader) {
  const { tema, temaActivo, efecto, cambiarTema } = useTema()
  const { t, idioma, cambiarIdioma, idiomasDisponibles } = useTraduccion()
  const { usuario } = useAuth()

  const nombreUsuario = usuario?.user_metadata?.nombre && usuario?.user_metadata?.apellido
    ? `${usuario.user_metadata.nombre} ${usuario.user_metadata.apellido}`
    : usuario?.email?.split('@')[0] || 'U'

  const [idiomaAbierto, setIdiomaAbierto] = useState(false)
  const [sidebarMenuAbierto, setSidebarMenuAbierto] = useState(false)
  const idiomaRef = useRef<HTMLDivElement>(null)
  const sidebarMenuRef = useRef<HTMLDivElement>(null)
  const esCristal = efecto !== 'solido'

  // Cerrar dropdowns al click fuera
  useEffect(() => {
    if (!idiomaAbierto && !sidebarMenuAbierto) return
    const handler = (e: MouseEvent) => {
      if (idiomaAbierto && idiomaRef.current && !idiomaRef.current.contains(e.target as Node)) setIdiomaAbierto(false)
      if (sidebarMenuAbierto && sidebarMenuRef.current && !sidebarMenuRef.current.contains(e.target as Node)) setSidebarMenuAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [idiomaAbierto, sidebarMenuAbierto])

  const nombreSeccion = seccionActual.replace('/', '') || 'inicio'

  const estiloPopover = esCristal ? {
    backgroundColor: 'var(--superficie-flotante)',
    backdropFilter: 'blur(32px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
  } : {
    backgroundColor: 'var(--superficie-elevada)',
  }

  return (
    <header className="h-[var(--header-alto)] flex items-center justify-between px-4 bg-superficie-app md:bg-superficie-tarjeta/80 md:backdrop-blur-sm border-b-0 md:border-b md:border-borde-sutil sticky top-0 z-40 gap-4 md:cristal-panel" style={{ paddingTop: 'var(--safe-area-top)' }}>
      {/* Izquierda */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Mobile: abrir drawer */}
        <button
          onClick={onAbrirMenuMobil}
          className="md:hidden flex items-center justify-center size-10 rounded-lg bg-transparent border-none text-texto-secundario cursor-pointer hover:bg-superficie-hover shrink-0"
        >
          <PanelLeft size={22} />
        </button>

        {/* Desktop: toggle sidebar con popover */}
        <div ref={sidebarMenuRef} className="hidden md:block relative">
          <button
            onClick={onToggleSidebar}
            onContextMenu={(e) => { e.preventDefault(); setSidebarMenuAbierto(!sidebarMenuAbierto) }}
            className="flex items-center justify-center size-9 rounded-lg bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover hover:text-texto-secundario transition-colors shrink-0"
            title={sidebarColapsado ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          >
            {sidebarColapsado ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>

          {/* Popover de opciones del sidebar */}
          <AnimatePresence>
            {sidebarMenuAbierto && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 top-full mt-1.5 border border-borde-sutil rounded-xl shadow-lg overflow-hidden min-w-[220px] py-1 z-50"
                style={estiloPopover}
              >
                {/* Estado actual */}
                <div className="px-3 py-2 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">
                  Menú lateral
                </div>

                {/* Toggle esta sección */}
                <button
                  onClick={() => { onToggleSidebar(); setSidebarMenuAbierto(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm border-none cursor-pointer transition-colors bg-transparent text-texto-primario hover:bg-superficie-hover text-left"
                >
                  {sidebarColapsado ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
                  <span>{sidebarColapsado ? 'Expandir' : 'Colapsar'} en <strong className="capitalize">{nombreSeccion}</strong></span>
                </button>

                <div className="h-px bg-borde-sutil my-1 mx-2" />

                {/* Aplicar a todas */}
                <button
                  onClick={() => { onAplicarATodas(true); setSidebarMenuAbierto(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm border-none cursor-pointer transition-colors bg-transparent text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario text-left"
                >
                  <ChevronsLeft size={15} />
                  <span>Colapsar en todas</span>
                </button>
                <button
                  onClick={() => { onAplicarATodas(false); setSidebarMenuAbierto(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm border-none cursor-pointer transition-colors bg-transparent text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario text-left"
                >
                  <ChevronsRight size={15} />
                  <span>Expandir en todas</span>
                </button>

                {/* Limpiar preferencia de esta sección */}
                {tienePreferenciaSeccion && (
                  <>
                    <div className="h-px bg-borde-sutil my-1 mx-2" />
                    <button
                      onClick={() => { onLimpiarSeccion(); setSidebarMenuAbierto(false) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm border-none cursor-pointer transition-colors bg-transparent text-texto-terciario hover:bg-superficie-hover hover:text-texto-secundario text-left"
                    >
                      <RotateCcw size={14} />
                      <span>Restablecer <strong className="capitalize">{nombreSeccion}</strong> al global</span>
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Migajas extras={migajasExtras} />
      </div>

      {/* Derecha */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Selector de idioma */}
        <div ref={idiomaRef} className="relative">
          <button
            onClick={() => setIdiomaAbierto(!idiomaAbierto)}
            className="flex items-center justify-center size-10 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover transition-colors duration-100"
            title="Cambiar idioma"
          >
            <Globe size={18} />
          </button>
          <AnimatePresence>
            {idiomaAbierto && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1.5 border border-borde-sutil rounded-lg shadow-lg overflow-hidden min-w-[160px]"
                style={estiloPopover}
              >
                {idiomasDisponibles.map((i) => (
                  <button
                    key={i.codigo}
                    onClick={() => { cambiarIdioma(i.codigo as 'es' | 'en' | 'pt'); setIdiomaAbierto(false) }}
                    className={[
                      'flex items-center gap-2.5 w-full px-3 py-2 text-sm border-none cursor-pointer transition-colors duration-100',
                      idioma === i.codigo
                        ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                        : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                    ].join(' ')}
                  >
                    <span className="text-base leading-none">{BANDERAS[i.codigo]}</span>
                    <span className="flex-1 text-left">{i.nombre}</span>
                    {idioma === i.codigo && <Check size={14} className="text-texto-marca shrink-0" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tema: click rota sistema → claro → oscuro → sistema... */}
        <button
          onClick={() => {
            const orden = ['sistema', 'claro', 'oscuro'] as const
            const siguiente = orden[(orden.indexOf(tema as typeof orden[number]) + 1) % orden.length]
            cambiarTema(siguiente)
          }}
          title={tema === 'sistema' ? 'Sistema' : tema === 'claro' ? 'Claro' : 'Oscuro'}
          className="flex items-center justify-center size-10 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover transition-colors duration-100"
        >
          {tema === 'sistema' ? <Monitor size={18} /> : tema === 'claro' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Avatar */}
        <div className="ml-1">
          <Avatar nombre={nombreUsuario} tamano="sm" />
        </div>
      </div>
    </header>
  )
}

export { Header }

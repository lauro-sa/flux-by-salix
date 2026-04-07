'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTema } from '@/hooks/useTema'
import { useTraduccion } from '@/lib/i18n'
import { Migajas } from './Migajas'
import {
  PanelLeft, PanelLeftClose, Moon, Sun, Monitor, Check, Globe,
  ChevronsLeft, ChevronsRight, RotateCcw, Headphones, Settings,
  ChevronRight, BellOff, BellRing, PanelLeftDashed,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { IconoSalix } from '@/componentes/marca'
import { Boton } from '@/componentes/ui/Boton'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { NotificacionesHeader } from './NotificacionesHeader'
import { useModoConcentracion } from '@/hooks/useModoConcentracion'
import type { Migaja } from '@/hooks/useNavegacion'

const BANDERAS: Record<string, string> = {
  es: '🇪🇸',
  en: '🇺🇸',
  pt: '🇧🇷',
}

const TEMAS = [
  { clave: 'sistema', icono: Monitor, etiqueta: 'Sistema' },
  { clave: 'claro', icono: Sun, etiqueta: 'Claro' },
  { clave: 'oscuro', icono: Moon, etiqueta: 'Oscuro' },
] as const

/**
 * Header — Barra superior compacta estilo Linear.
 * Desktop: botón sidebar + migajas + logo Salix (abre menú central).
 * Mobile: botón drawer + título + logo Salix.
 */

interface PropiedadesHeader {
  onAbrirMenuMobil: () => void
  onToggleSidebar: () => void
  sidebarColapsado: boolean
  seccionActual: string
  tienePreferenciaSeccion: boolean
  onAplicarATodas: (colapsado: boolean) => void
  onLimpiarSeccion: () => void
  autoOcultar: boolean
  onToggleAutoOcultar: () => void
  migajasExtras?: Migaja[]
  /** Header oculto al scrollear hacia abajo (mobile) */
  oculto?: boolean
}

function Header({
  onAbrirMenuMobil,
  onToggleSidebar,
  sidebarColapsado,
  seccionActual,
  tienePreferenciaSeccion,
  onAplicarATodas,
  onLimpiarSeccion,
  autoOcultar,
  onToggleAutoOcultar,
  migajasExtras,
  oculto = false,
}: PropiedadesHeader) {
  const { tema, temaActivo, efecto, cambiarTema } = useTema()
  const { t, idioma, cambiarIdioma, idiomasDisponibles } = useTraduccion()
  const { usuario } = useAuth()
  const modoConcentracion = useModoConcentracion()

  const nombreUsuario = usuario?.user_metadata?.nombre && usuario?.user_metadata?.apellido
    ? `${usuario.user_metadata.nombre} ${usuario.user_metadata.apellido}`
    : usuario?.email?.split('@')[0] || 'Usuario'

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [sidebarMenuAbierto, setSidebarMenuAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const sidebarMenuRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const esCristal = efecto !== 'solido'

  /* Cerrar dropdowns al click fuera */
  useEffect(() => {
    if (!menuAbierto && !sidebarMenuAbierto) return
    const handler = (e: MouseEvent) => {
      if (menuAbierto && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false)
      if (sidebarMenuAbierto && sidebarMenuRef.current && !sidebarMenuRef.current.contains(e.target as Node)) setSidebarMenuAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuAbierto, sidebarMenuAbierto])

  const nombreSeccion = seccionActual.replace('/', '') || 'inicio'

  const estiloPopover = esCristal ? {
    backgroundColor: 'var(--superficie-flotante)',
    backdropFilter: 'blur(32px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
  } : {
    backgroundColor: 'var(--superficie-elevada)',
  }

  return (
    <header
      className={[
        'h-14 sm:h-[var(--header-alto)] flex items-center justify-between px-3 sm:px-4 bg-superficie-app md:bg-superficie-tarjeta/80 md:backdrop-blur-sm border-b-0 md:border-b md:border-borde-sutil sticky top-0 z-40 gap-3 sm:gap-4 md:cristal-panel shrink-0',
        'transition-transform duration-300 ease-out md:!translate-y-0',
        oculto ? '-translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      {/* Izquierda */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Mobile: abrir menú fullscreen */}
        <button type="button" onClick={onAbrirMenuMobil} className="md:hidden shrink-0 size-10 inline-flex items-center justify-center rounded-lg text-texto-secundario hover:bg-superficie-hover transition-colors cursor-pointer border-none bg-transparent">
          <PanelLeft size={26} />
        </button>

        {/* Desktop: toggle sidebar con popover (clic derecho / long press abre opciones) */}
        <div ref={sidebarMenuRef} className="hidden md:block relative">
          <div
            onContextMenu={(e) => {
              e.preventDefault()
              setSidebarMenuAbierto(v => !v)
            }}
            onTouchStart={() => {
              longPressTimerRef.current = setTimeout(() => {
                longPressFired.current = true
                setSidebarMenuAbierto(v => !v)
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(15)
              }, 600)
            }}
            onTouchEnd={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null } }}
            onTouchMove={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null } }}
          >
            <Boton
              variante="fantasma"
              tamano="sm"
              soloIcono
              icono={sidebarColapsado ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
              onClick={(e) => {
                if (longPressFired.current) { longPressFired.current = false; return }
                onToggleSidebar()
              }}
              titulo={sidebarColapsado ? 'Expandir menú\nClic derecho: más opciones' : 'Colapsar menú\nClic derecho: más opciones'}
              className="shrink-0"
            />
          </div>

          {/* Popover de opciones del sidebar */}
          <AnimatePresence>
            {sidebarMenuAbierto && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 top-full mt-1.5 border border-borde-sutil rounded-xl shadow-lg overflow-hidden min-w-[220px] max-w-[calc(100vw-2rem)] py-1 z-50"
                style={estiloPopover}
              >
                <div className="px-3 py-2 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">
                  Menú lateral
                </div>

                {/* Auto-ocultar */}
                <OpcionMenu
                  icono={<PanelLeftDashed size={15} />}
                  activo={autoOcultar}
                  derecha={autoOcultar ? <Check size={14} className="text-texto-marca" /> : undefined}
                  onClick={() => { onToggleAutoOcultar(); setSidebarMenuAbierto(false) }}
                >
                  Auto-ocultar
                </OpcionMenu>

                <div className="h-px bg-borde-sutil my-1 mx-2" />

                {!autoOcultar && (
                  <OpcionMenu
                    icono={sidebarColapsado ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
                    onClick={() => { onToggleSidebar(); setSidebarMenuAbierto(false) }}
                  >
                    {sidebarColapsado ? 'Expandir' : 'Colapsar'} en <strong className="capitalize">{nombreSeccion}</strong>
                  </OpcionMenu>
                )}

                <OpcionMenu
                  icono={<ChevronsLeft size={15} />}
                  onClick={() => { onAplicarATodas(true); setSidebarMenuAbierto(false) }}
                >
                  Colapsar en todas
                </OpcionMenu>
                <OpcionMenu
                  icono={<ChevronsRight size={15} />}
                  onClick={() => { onAplicarATodas(false); setSidebarMenuAbierto(false) }}
                >
                  Expandir en todas
                </OpcionMenu>

                {tienePreferenciaSeccion && !autoOcultar && (
                  <>
                    <div className="h-px bg-borde-sutil my-1 mx-2" />
                    <OpcionMenu
                      icono={<RotateCcw size={14} />}
                      onClick={() => { onLimpiarSeccion(); setSidebarMenuAbierto(false) }}
                    >
                      Restablecer <strong className="capitalize">{nombreSeccion}</strong> al global
                    </OpcionMenu>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Migajas extras={migajasExtras} />
      </div>

      {/* Centro-derecha — Notificaciones (3 íconos) */}
      <NotificacionesHeader />

      {/* Derecha — Logo Salix que abre menú central */}
      <div ref={menuRef} className="relative shrink-0">
        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="rounded-xl !size-10 sm:!w-auto sm:!h-auto sm:!px-3 sm:!py-1.5"
          icono={<IconoSalix tamano={26} hover tap />}
        >
          <span className="hidden sm:inline text-sm font-medium text-current">Flux</span>
        </Boton>

        {/* ── Menú Salix ── */}
        <AnimatePresence>
          {menuAbierto && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 border border-borde-sutil rounded-2xl shadow-elevada overflow-hidden w-[280px] max-w-[calc(100vw-2rem)] z-50"
              style={estiloPopover}
            >
              {/* Cabecera del menú — Logo + info */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <div className="size-11 rounded-lg bg-superficie-hover flex items-center justify-center shrink-0">
                  <IconoSalix tamano={26} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-texto-primario">Flux <span className="font-normal text-texto-terciario">by Salix</span></span>
                  <span className="text-xxs text-texto-terciario truncate">Gestión de clientes y equipos</span>
                </div>
              </div>

              {/* Info de versión y soporte */}
              <div className="px-4 pb-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xxs text-texto-terciario">
                  <Settings size={13} className="shrink-0" />
                  <span>Versión 1.0 — En desarrollo activo</span>
                </div>
                <div className="flex items-center gap-2 text-xxs text-texto-terciario">
                  <Headphones size={13} className="shrink-0" />
                  <span>Soporte disponible de Lunes a Viernes</span>
                </div>
              </div>

              {/* Botón contactar soporte */}
              <div className="px-4 pb-3">
                <Boton variante="primario" anchoCompleto icono={<Headphones size={16} />} onClick={() => { setMenuAbierto(false); window.open('https://wa.me/5493515555555', '_blank') }}>
                  Contactar soporte
                </Boton>
              </div>

              <div className="h-px bg-borde-sutil" />

              {/* Modo concentración — cicla: 30min → 1h → 4h → mañana → off */}
              <div className="px-4 py-3">
                <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Notificaciones</span>
                <button
                  onClick={() => modoConcentracion.ciclar()}
                  className={[
                    'flex items-center gap-2.5 w-full mt-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-left focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                    modoConcentracion.activo
                      ? 'bg-insignia-advertencia-fondo/50 border-insignia-advertencia-texto/20 text-insignia-advertencia-texto'
                      : 'bg-superficie-hover border-borde-sutil text-texto-secundario hover:text-texto-primario hover:border-borde-fuerte',
                  ].join(' ')}
                >
                  {modoConcentracion.activo ? <BellOff size={16} /> : <BellRing size={16} />}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-medium">
                      {modoConcentracion.activo ? modoConcentracion.textoEstado() : 'Silenciar notificaciones'}
                    </span>
                    <span className="text-xxs opacity-70">
                      {modoConcentracion.textoSiguiente()}
                    </span>
                  </div>
                </button>
              </div>

              <div className="h-px bg-borde-sutil" />

              {/* Apariencia — tema */}
              <div className="px-4 py-3">
                <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Apariencia</span>
                <div className="flex items-center gap-1 mt-2 p-1 rounded-lg" style={{ backgroundColor: 'var(--superficie-hover)' }}>
                  {TEMAS.map(({ clave, icono: Icono, etiqueta }) => (
                    <button
                      key={clave}
                      onClick={() => cambiarTema(clave)}
                      className={[
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md border-none cursor-pointer text-xs font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                        tema === clave
                          ? 'bg-superficie-tarjeta text-texto-primario shadow-sm'
                          : 'bg-transparent text-texto-terciario hover:text-texto-secundario',
                      ].join(' ')}
                    >
                      <Icono size={14} />
                      <span className="hidden xs:inline">{etiqueta}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-borde-sutil" />

              {/* Idioma — compacto tipo pill igual que tema */}
              <div className="px-4 py-3">
                <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Idioma</span>
                <div className="flex items-center gap-1 mt-2 p-1 rounded-lg" style={{ backgroundColor: 'var(--superficie-hover)' }}>
                  {idiomasDisponibles.map((i) => (
                    <button
                      key={i.codigo}
                      onClick={() => { cambiarIdioma(i.codigo as 'es' | 'en' | 'pt') }}
                      className={[
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md border-none cursor-pointer text-xs font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                        idioma === i.codigo
                          ? 'bg-superficie-tarjeta text-texto-primario shadow-sm'
                          : 'bg-transparent text-texto-terciario hover:text-texto-secundario',
                      ].join(' ')}
                    >
                      <span className="text-sm leading-none">{BANDERAS[i.codigo]}</span>
                      <span>{i.codigo.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Links secundarios */}
              <div className="h-px bg-borde-sutil" />
              <div className="px-4 py-2.5 flex items-center gap-4">
                <Link href="/documentacion" onClick={() => setMenuAbierto(false)} className="text-xs text-texto-terciario hover:text-texto-secundario no-underline transition-colors">{t('navegacion.documentacion')}</Link>
                <Link href="/vitrina" onClick={() => setMenuAbierto(false)} className="text-xs text-texto-terciario hover:text-texto-secundario no-underline transition-colors">{t('navegacion.vitrina')}</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

export { Header }

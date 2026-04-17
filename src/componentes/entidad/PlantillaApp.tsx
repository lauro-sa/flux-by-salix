'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MenuMovil } from './MenuMovil'
import { ToastNotificacion } from '@/componentes/feedback/ToastNotificacion'
import { BannerInstalacion } from '@/componentes/pwa/BannerInstalacion'
import { BotonFlotanteSalixIA } from '@/componentes/entidad/SalixIA/BotonFlotante'
import { BotonFlotanteNotas } from '@/componentes/entidad/NotasRapidas/BotonFlotanteNotas'
import IconoSalix from '@/componentes/marca/IconoSalix'
import { Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelNotas } from '@/componentes/entidad/NotasRapidas/PanelNotas'
import { PanelChat } from '@/componentes/entidad/SalixIA/PanelChat'
import { useAuth } from '@/hooks/useAuth'
import { useNotasRapidas } from '@/hooks/useNotasRapidas'
import { useTema } from '@/hooks/useTema'
import { usePreferencias } from '@/hooks/usePreferencias'
import { useHeaderAutoOculto } from '@/hooks/useHeaderAutoOculto'
import { useHeartbeatAsistencia } from '@/hooks/useHeartbeatAsistencia'
import { useSyncCorreoBackground } from '@/hooks/useSyncCorreoBackground'
import type { Migaja } from '@/hooks/useNavegacion'
import type { ReactNode } from 'react'

/**
 * PlantillaApp — Layout principal de Flux.
 * Estructura: Sidebar (izquierda) + Header (arriba) + Main (contenido).
 * Se usa como wrapper de todas las páginas autenticadas.
 *
 * El estado del sidebar (colapsado/expandido) se resuelve así:
 * 1. Si sidebar_auto_ocultar está activo → siempre colapsado (se expande al hover)
 * 2. Si hay preferencia para la sección actual → se usa esa
 * 3. Si no → se usa la preferencia global (sidebar_colapsado)
 */

interface PropiedadesPlantilla {
  children: ReactNode
  migajasExtras?: Migaja[]
}

/** Extrae la sección raíz del pathname: /inbox/configuracion → /inbox */
function obtenerSeccion(pathname: string): string {
  const partes = pathname.split('/').filter(Boolean)
  return partes.length > 0 ? `/${partes[0]}` : '/'
}

/** Detecta si la ruta actual tiene un menú lateral secundario (PlantillaConfiguracion) */
function tieneMenuSecundario(pathname: string): boolean {
  return pathname.includes('/configuracion') || pathname === '/mi-cuenta' || pathname === '/marketing'
}

function PlantillaApp({ children, migajasExtras }: PropiedadesPlantilla) {
  const pathname = usePathname()
  const { efecto } = useTema()
  const { preferencias, guardar } = usePreferencias()
  const headerOculto = useHeaderAutoOculto()
  useHeartbeatAsistencia()
  useSyncCorreoBackground()

  // iOS Safari miente con 100dvh hasta que hacés scroll.
  // window.innerHeight siempre devuelve el alto visible real.
  useEffect(() => {
    const actualizarAltura = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }
    actualizarAltura()
    window.addEventListener('resize', actualizarAltura)
    window.visualViewport?.addEventListener('resize', actualizarAltura)
    return () => {
      window.removeEventListener('resize', actualizarAltura)
      window.visualViewport?.removeEventListener('resize', actualizarAltura)
    }
  }, [])
  // Ya no se usa drawer lateral — NavegacionMovil maneja la nav en teléfonos
  const [mobilMenuAbierto, setMobilMenuAbierto] = useState(false)

  // Botones flotantes: se esconden a la derecha, aparecen al acercar el mouse
  const [botonesVisibles, setBotonesVisibles] = useState(true)
  const [botonesMontados, setBotonesMontados] = useState(false)
  const timerBotonesRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notasRapidas = useNotasRapidas()
  const tieneAlertasNotas = notasRapidas.tiene_cambios_sin_leer

  // Montar solo en cliente para evitar hydration mismatch + ocultar después de unos segundos
  useEffect(() => {
    setBotonesMontados(true)
    const timerOcultar = setTimeout(() => setBotonesVisibles(false), 4000)
    return () => { clearTimeout(timerOcultar) }
  }, [])


  const seccion = obtenerSeccion(pathname)

  /* Modo auto-ocultar: sidebar colapsado por defecto, se expande al hover */
  const autoOcultar = preferencias.sidebar_auto_ocultar
  const autoColapsarConfig = preferencias.sidebar_auto_colapsar_config
  const esRutaConMenuSecundario = tieneMenuSecundario(pathname)
  /** Auto-ocultar activo: por config global O por estar en ruta con menú secundario */
  const autoOcultarEfectivo = autoOcultar || (autoColapsarConfig && esRutaConMenuSecundario)
  const [hoverExpandido, setHoverExpandido] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onSidebarMouseEnter = useCallback(() => {
    if (!autoOcultarEfectivo) return
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setHoverExpandido(true)
  }, [autoOcultarEfectivo])

  const onSidebarMouseLeave = useCallback(() => {
    if (!autoOcultarEfectivo) return
    // Delay breve para evitar parpadeo al mover entre sidebar y contenido
    hoverTimeoutRef.current = setTimeout(() => setHoverExpandido(false), 300)
  }, [autoOcultarEfectivo])

  /* Resolver si el sidebar está colapsado para la sección actual */
  const sidebarColapsado = useMemo(() => {
    // Auto-ocultar (global o por menú secundario) anula todo: colapsado salvo hover
    if (autoOcultarEfectivo) return !hoverExpandido
    const porSeccion = preferencias.sidebar_secciones?.[seccion]
    if (porSeccion !== undefined) return porSeccion
    return preferencias.sidebar_colapsado
  }, [autoOcultarEfectivo, hoverExpandido, preferencias.sidebar_secciones, preferencias.sidebar_colapsado, seccion])

  /* Toggle sidebar: guarda como preferencia de la sección actual */
  const toggleSidebar = useCallback(() => {
    // Si estamos en auto-ocultar, el toggle lo desactiva
    if (autoOcultar) {
      guardar({ sidebar_auto_ocultar: false })
      setHoverExpandido(false)
      return
    }
    const nuevo = !sidebarColapsado
    guardar({
      sidebar_secciones: {
        ...preferencias.sidebar_secciones,
        [seccion]: nuevo,
      },
    })
  }, [autoOcultar, sidebarColapsado, seccion, preferencias.sidebar_secciones, guardar])

  /* Activar/desactivar auto-ocultar */
  const toggleAutoOcultar = useCallback(() => {
    const nuevo = !autoOcultar
    guardar({ sidebar_auto_ocultar: nuevo })
    if (nuevo) setHoverExpandido(false)
  }, [autoOcultar, guardar])

  /* Activar/desactivar auto-colapsar en páginas con menú secundario */
  const toggleAutoColapsarConfig = useCallback(() => {
    guardar({ sidebar_auto_colapsar_config: !autoColapsarConfig })
  }, [autoColapsarConfig, guardar])

  /* Colapsar/expandir todas las secciones */
  const aplicarATodas = useCallback((colapsado: boolean) => {
    guardar({
      sidebar_colapsado: colapsado,
      sidebar_secciones: {},
      sidebar_auto_ocultar: false,
    })
  }, [guardar])

  /* Limpiar preferencia de esta sección (vuelve al global) */
  const limpiarSeccion = useCallback(() => {
    const nuevas = { ...preferencias.sidebar_secciones }
    delete nuevas[seccion]
    guardar({ sidebar_secciones: nuevas })
  }, [seccion, preferencias.sidebar_secciones, guardar])

  /* Fijar sidebar en un estado específico para la sección actual (desactiva auto-ocultar si estaba activo) */
  const fijarSeccion = useCallback((colapsado: boolean) => {
    guardar({
      sidebar_auto_ocultar: false,
      sidebar_secciones: {
        ...preferencias.sidebar_secciones,
        [seccion]: colapsado,
      },
    })
    setHoverExpandido(false)
  }, [seccion, preferencias.sidebar_secciones, guardar])

  const tienePreferenciaSeccion = preferencias.sidebar_secciones?.[seccion] !== undefined

  /* En auto-ocultar: margen fijo para la barra minimizada (mismo ancho colapsado) */
  const anchoSidebarReal = autoOcultarEfectivo
    ? 'var(--sidebar-ancho-colapsado)'
    : (sidebarColapsado ? 'var(--sidebar-ancho-colapsado)' : 'var(--sidebar-ancho)')
  const fondoWrapper = efecto !== 'solido' ? 'transparent' : 'var(--superficie-app)'

  // Rutas que se renderizan a pantalla completa (sin sidebar ni header)
  const esPantallaCompleta = pathname === '/aplicaciones' || pathname === '/prueba-pantalla'

  // Rutas que necesitan layout fijo (height fijo, overflow: hidden) incluso en móvil.
  // Paneles con scroll interno que no deben scrollear el documento.
  const necesitaLayoutFijo = pathname.startsWith('/inbox') || pathname.startsWith('/calendario') || pathname.startsWith('/recorrido')

  if (esPantallaCompleta) {
    return (
      <div className="layout-app layout-app--fijo flex flex-col" suppressHydrationWarning>
        <main className="flex-1 flex flex-col w-full bg-superficie-app min-h-0" suppressHydrationWarning>
          {children}
        </main>
      </div>
    )
  }

  /* Layout se resuelve por CSS:
     - Desktop (md+) y PWA standalone: height:100dvh + overflow:hidden (layout fijo)
     - Mobile browser: min-height:100dvh (documento scrollea → Safari compacta toolbar)
     - Rutas con paneles (inbox, calendario): siempre fijo via layout-app--fijo */

  return (
    <div className={`layout-app${necesitaLayoutFijo ? ' layout-app--fijo safe-area-top' : ' safe-area'}`}>
      <Sidebar
        colapsado={sidebarColapsado}
        onToggle={toggleSidebar}
        mobilAbierto={false}
        onCerrarMobil={() => {}}
        autoOcultar={autoOcultarEfectivo}
        hoverExpandido={hoverExpandido}
        onMouseEnter={onSidebarMouseEnter}
        onMouseLeave={onSidebarMouseLeave}
      />

      <div className="contenido-principal contenido-principal-layout flex flex-col">
        <Header
          onAbrirMenuMobil={() => setMobilMenuAbierto(true)}
          onToggleSidebar={toggleSidebar}
          sidebarColapsado={sidebarColapsado}
          seccionActual={seccion}
          tienePreferenciaSeccion={tienePreferenciaSeccion}
          onAplicarATodas={aplicarATodas}
          onFijarSeccion={fijarSeccion}
          onLimpiarSeccion={limpiarSeccion}
          autoOcultar={autoOcultar}
          onToggleAutoOcultar={toggleAutoOcultar}
          autoColapsarConfig={autoColapsarConfig}
          esRutaConMenuSecundario={esRutaConMenuSecundario}
          onToggleAutoColapsarConfig={toggleAutoColapsarConfig}
          migajasExtras={migajasExtras}
          oculto={necesitaLayoutFijo ? false : headerOculto}
        />

        <ToastNotificacion />

        <main
          className="scrollbar-auto-oculto flex-1 flex flex-col w-full bg-superficie-app main-layout"
        >
          {children}
        </main>
      </div>

      {/* Menú fullscreen móvil */}
      <MenuMovil
        abierto={mobilMenuAbierto}
        onCerrar={() => setMobilMenuAbierto(false)}
      />

      {/* Banner de instalación PWA (solo si no está instalada) */}
      <BannerInstalacion />

      {/* Botones flotantes — se montan solo en cliente para evitar hydration mismatch */}
      {botonesMontados && (
        <>
          {/* ── Desktop: zona de detección + botones individuales ── */}
          <div
            className="fixed right-0 bottom-0 w-[30px] h-40 z-[69] hidden md:block"
            onMouseEnter={() => {
              setBotonesVisibles(true)
              if (timerBotonesRef.current) clearTimeout(timerBotonesRef.current)
            }}
          />
          <div
            className="fixed right-4 bottom-6 z-[70] hidden md:flex flex-col items-center gap-1 transition-all duration-300 ease-in-out"
            style={{
              transform: (botonesVisibles || tieneAlertasNotas) ? 'translateX(0)' : 'translateX(calc(100% + 2rem))',
              opacity: (botonesVisibles || tieneAlertasNotas) ? 1 : 0,
            }}
            onMouseEnter={() => {
              setBotonesVisibles(true)
              if (timerBotonesRef.current) clearTimeout(timerBotonesRef.current)
            }}
            onMouseLeave={() => {
              if (!tieneAlertasNotas) {
                timerBotonesRef.current = setTimeout(() => setBotonesVisibles(false), 3000)
              }
            }}
          >
            <BotonFlotanteNotas notasRapidas={notasRapidas} />
            <BotonFlotanteSalixIA />
          </div>

          {/* ── Móvil: botón Flux unificado que expande notas + IA ── */}
          <BotonesFlotantesMovil notasRapidas={notasRapidas} />
        </>
      )}

      <style suppressHydrationWarning>{`
        @media (min-width: 768px) {
          .contenido-principal {
            margin-left: ${anchoSidebarReal} !important;
            transition: margin-left 200ms ease !important;
          }
        }
      `}</style>
    </div>
  )
}

/* ════════════════════════════════════════════
   BotonesFlotantesMovil — Botón Flux unificado para móvil.
   Un solo botón con el logo Flux. Al tocar, se expanden Notas e IA hacia arriba.
   Si hay alertas de notas, muestra badge pulsante sobre el botón principal.
   Solo se renderiza en < md (mobile).
   ════════════════════════════════════════════ */

function BotonesFlotantesMovil({ notasRapidas }: { notasRapidas: ReturnType<typeof useNotasRapidas> }) {
  const [expandido, setExpandido] = useState(false)
  const [panelNotas, setPanelNotas] = useState(false)
  const [panelIA, setPanelIA] = useState(false)
  const [iaHabilitado, setIaHabilitado] = useState(false)
  const { usuario, cargando } = useAuth()
  const { temaActivo } = useTema()

  const fondoCristal = temaActivo === 'claro'
    ? 'rgba(255, 255, 255, 0.4)'
    : 'rgba(30, 30, 30, 0.35)'

  const cantidadSinLeer = notasRapidas.compartidas.filter((n) => n._tiene_cambios).length

  // Verificar si Salix IA está habilitado
  useEffect(() => {
    if (cargando || !usuario) return
    const verificar = async () => {
      try {
        const res = await fetch('/api/salix-ia/estado')
        if (res.ok) {
          const data = await res.json()
          setIaHabilitado(data.habilitado)
        }
      } catch { /* no mostrar */ }
    }
    verificar()
  }, [usuario, cargando])

  // Cerrar el menú expandido cuando se abre un panel
  useEffect(() => {
    if (panelNotas || panelIA) setExpandido(false)
  }, [panelNotas, panelIA])

  // Cerrar al tocar fuera
  useEffect(() => {
    if (!expandido) return
    const cerrar = () => setExpandido(false)
    // Timeout para no cerrar por el mismo tap que abrió
    const timer = setTimeout(() => document.addEventListener('click', cerrar), 10)
    return () => { clearTimeout(timer); document.removeEventListener('click', cerrar) }
  }, [expandido])

  return (
    <div className="fixed right-4 z-[70] flex flex-col-reverse items-center gap-2 md:hidden"
      style={{ bottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 76px), 76px)' }}
    >
      {/* Botón principal — logo Flux */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={(e) => { e.stopPropagation(); setExpandido(!expandido) }}
        className="size-12 rounded-full flex items-center justify-center text-texto-marca relative cursor-pointer"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--superficie-elevada) 65%, transparent)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          border: '1px solid var(--borde-sutil)',
          boxShadow: 'var(--sombra-md)',
        }}
      >
        <motion.div
          animate={{ rotate: expandido ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <IconoSalix tamano={24} variante="estatico" />
        </motion.div>

        {/* Badge de alertas de notas */}
        {cantidadSinLeer > 0 && !expandido && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [1, 0.85, 1],
            }}
            transition={{
              scale: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
              opacity: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
            }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-insignia-peligro border-2 border-superficie-app flex items-center justify-center px-1 shadow-md shadow-insignia-peligro/40"
          >
            <span className="text-[10px] font-bold text-white leading-none">
              {cantidadSinLeer > 9 ? '9+' : cantidadSinLeer}
            </span>
          </motion.span>
        )}
      </motion.button>

      {/* Botones expandidos — Notas e IA */}
      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="flex flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón Notas */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setPanelNotas(true)}
              className="size-11 rounded-full flex items-center justify-center text-amber-400/70 relative cursor-pointer"
              style={{
                backgroundColor: fondoCristal,
                backdropFilter: 'blur(24px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                border: '1px solid var(--borde-sutil)',
                boxShadow: 'var(--sombra-sm)',
              }}
              title="Notas rápidas"
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8l6-6V5a2 2 0 0 0-2-2H6z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M14 21v-4a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {cantidadSinLeer > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-insignia-peligro border-2 border-superficie-app flex items-center justify-center px-0.5">
                  <span className="text-[9px] font-bold text-white leading-none">
                    {cantidadSinLeer > 9 ? '9+' : cantidadSinLeer}
                  </span>
                </span>
              )}
            </motion.button>

            {/* Botón Salix IA */}
            {iaHabilitado && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setPanelIA(true)}
                className="size-11 rounded-full flex items-center justify-center text-violet-400 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(79,70,229,0.2))',
                  backdropFilter: 'blur(16px) saturate(1.4)',
                  WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                  border: '1px solid var(--borde-sutil)',
                  boxShadow: 'var(--sombra-sm)',
                }}
                title="Salix IA"
              >
                <Sparkles className="size-5" />
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paneles — se abren desde los botones expandidos */}
      <PanelNotas
        abierto={panelNotas}
        onCerrar={() => setPanelNotas(false)}
        notas={notasRapidas}
      />
      <PanelChat
        abierto={panelIA}
        onCerrar={() => setPanelIA(false)}
      />
    </div>
  )
}


export { PlantillaApp }

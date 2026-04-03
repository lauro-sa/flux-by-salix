'use client'

import { useState, useCallback, useMemo, useRef } from 'react'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MenuMovil } from './MenuMovil'
import { ToastNotificacion } from '@/componentes/feedback/ToastNotificacion'
import { BannerInstalacion } from '@/componentes/pwa/BannerInstalacion'
import { useTema } from '@/hooks/useTema'
import { usePreferencias } from '@/hooks/usePreferencias'
import { useEsMovil } from '@/hooks/useEsMovil'
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

function PlantillaApp({ children, migajasExtras }: PropiedadesPlantilla) {
  const pathname = usePathname()
  const { efecto } = useTema()
  const { preferencias, guardar } = usePreferencias()
  const esMovil = useEsMovil()
  // Ya no se usa drawer lateral — NavegacionMovil maneja la nav en teléfonos
  const [mobilMenuAbierto, setMobilMenuAbierto] = useState(false)

  const seccion = obtenerSeccion(pathname)

  /* Modo auto-ocultar: sidebar colapsado por defecto, se expande al hover */
  const autoOcultar = preferencias.sidebar_auto_ocultar
  const [hoverExpandido, setHoverExpandido] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onSidebarMouseEnter = useCallback(() => {
    if (!autoOcultar) return
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setHoverExpandido(true)
  }, [autoOcultar])

  const onSidebarMouseLeave = useCallback(() => {
    if (!autoOcultar) return
    // Delay breve para evitar parpadeo al mover entre sidebar y contenido
    hoverTimeoutRef.current = setTimeout(() => setHoverExpandido(false), 300)
  }, [autoOcultar])

  /* Resolver si el sidebar está colapsado para la sección actual */
  const sidebarColapsado = useMemo(() => {
    // Auto-ocultar anula todo: colapsado salvo hover
    if (autoOcultar) return !hoverExpandido
    const porSeccion = preferencias.sidebar_secciones?.[seccion]
    if (porSeccion !== undefined) return porSeccion
    return preferencias.sidebar_colapsado
  }, [autoOcultar, hoverExpandido, preferencias.sidebar_secciones, preferencias.sidebar_colapsado, seccion])

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

  const tienePreferenciaSeccion = preferencias.sidebar_secciones?.[seccion] !== undefined

  /* En auto-ocultar: margen fijo para la barra minimizada (mismo ancho colapsado) */
  const anchoSidebarReal = autoOcultar
    ? 'var(--sidebar-ancho-colapsado)'
    : (sidebarColapsado ? 'var(--sidebar-ancho-colapsado)' : 'var(--sidebar-ancho)')
  const fondoWrapper = efecto !== 'solido' ? 'transparent' : 'var(--superficie-app)'

  // Rutas que se renderizan a pantalla completa (sin sidebar ni header)
  const esPantallaCompleta = pathname === '/aplicaciones'

  // Rutas que necesitan layout fijo (height: 100dvh, overflow: hidden) incluso en móvil.
  // Inbox y calendario usan paneles con scroll interno que no deben scrollear el documento.
  const necesitaLayoutFijo = pathname.startsWith('/inbox') || pathname.startsWith('/calendario')

  if (esPantallaCompleta) {
    return (
      <div style={{ height: '100dvh', backgroundColor: fondoWrapper, overflow: 'hidden' }}>
        <main
          className="scrollbar-auto-oculto"
          style={{
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            overflowY: 'auto',
            backgroundColor: 'var(--superficie-app)',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {children}
        </main>
      </div>
    )
  }

  /* En móvil (salvo inbox/calendario): el documento scrollea → Safari compacta la toolbar.
     En desktop o rutas con paneles fijos: height:100dvh + overflow:hidden → scroll interno. */
  const layoutFijo = !esMovil || necesitaLayoutFijo

  /* Detectar PWA standalone — solo ahí necesitamos padding de safe-areas
     porque Safari browser maneja sus propias barras (y las queremos transparentes). */
  const esPWA = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )

  return (
    <div
      style={{
        ...(layoutFijo
          ? { height: '100dvh', overflow: 'hidden' }
          : { minHeight: '100dvh' }
        ),
        backgroundColor: 'var(--superficie-app)',
        /* Solo PWA standalone: padding para notch + home indicator.
           En Safari browser: sin padding — el contenido fluye detrás de las barras transparentes. */
        ...(esPWA ? {
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        } : {}),
      }}
    >
      <Sidebar
        colapsado={sidebarColapsado}
        onToggle={toggleSidebar}
        mobilAbierto={false}
        onCerrarMobil={() => {}}
        autoOcultar={autoOcultar}
        hoverExpandido={hoverExpandido}
        onMouseEnter={onSidebarMouseEnter}
        onMouseLeave={onSidebarMouseLeave}
      />

      <div
        className="contenido-principal"
        style={{
          ...(layoutFijo
            ? { height: '100%', overflow: 'hidden' }
            : { minHeight: '100%' }
          ),
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header
          onAbrirMenuMobil={() => setMobilMenuAbierto(true)}
          onToggleSidebar={toggleSidebar}
          sidebarColapsado={sidebarColapsado}
          seccionActual={seccion}
          tienePreferenciaSeccion={tienePreferenciaSeccion}
          onAplicarATodas={aplicarATodas}
          onLimpiarSeccion={limpiarSeccion}
          autoOcultar={autoOcultar}
          onToggleAutoOcultar={toggleAutoOcultar}
          migajasExtras={migajasExtras}
        />

        <ToastNotificacion />

        <main
          className={[
            'scrollbar-auto-oculto flex-1 flex flex-col w-full bg-superficie-app',
            layoutFijo ? 'min-h-0 overflow-y-auto' : 'pb-36 md:pb-6',
          ].join(' ')}
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

export { PlantillaApp }

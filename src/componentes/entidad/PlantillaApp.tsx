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
import { useNotasRapidas } from '@/hooks/useNotasRapidas'
import { useTema } from '@/hooks/useTema'
import { usePreferencias } from '@/hooks/usePreferencias'
import { useHeaderAutoOculto } from '@/hooks/useHeaderAutoOculto'
import { useHeartbeatAsistencia } from '@/hooks/useHeartbeatAsistencia'
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
          {/* Zona de detección invisible — borde derecho inferior */}
          <div
            className="fixed right-0 bottom-0 w-[30px] h-40 z-[69] hidden md:block"
            onMouseEnter={() => {
              setBotonesVisibles(true)
              if (timerBotonesRef.current) clearTimeout(timerBotonesRef.current)
            }}
          />

          {/* Botones: notas arriba, IA abajo — se esconden a la derecha (salvo con alertas) */}
          <div
            className="fixed right-4 bottom-20 md:bottom-6 z-[70] flex flex-col items-center gap-1 transition-all duration-300 ease-in-out"
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

export { PlantillaApp }

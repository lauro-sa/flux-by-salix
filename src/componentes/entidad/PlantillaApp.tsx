'use client'

import { useState, useCallback, useMemo } from 'react'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ToastNotificacion } from '@/componentes/feedback/ToastNotificacion'
import { useTema } from '@/hooks/useTema'
import { usePreferencias } from '@/hooks/usePreferencias'
import type { Migaja } from '@/hooks/useNavegacion'
import type { ReactNode } from 'react'

/**
 * PlantillaApp — Layout principal de Flux.
 * Estructura: Sidebar (izquierda) + Header (arriba) + Main (contenido).
 * Se usa como wrapper de todas las páginas autenticadas.
 *
 * El estado del sidebar (colapsado/expandido) se resuelve así:
 * 1. Si hay preferencia para la sección actual → se usa esa
 * 2. Si no → se usa la preferencia global (sidebar_colapsado)
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
  const [mobilMenuAbierto, setMobilMenuAbierto] = useState(false)

  const seccion = obtenerSeccion(pathname)

  /* Resolver si el sidebar está colapsado para la sección actual */
  const sidebarColapsado = useMemo(() => {
    const porSeccion = preferencias.sidebar_secciones?.[seccion]
    if (porSeccion !== undefined) return porSeccion
    return preferencias.sidebar_colapsado
  }, [preferencias.sidebar_secciones, preferencias.sidebar_colapsado, seccion])

  /* Toggle sidebar: guarda como preferencia de la sección actual */
  const toggleSidebar = useCallback(() => {
    const nuevo = !sidebarColapsado
    guardar({
      sidebar_secciones: {
        ...preferencias.sidebar_secciones,
        [seccion]: nuevo,
      },
    })
  }, [sidebarColapsado, seccion, preferencias.sidebar_secciones, guardar])

  /* Colapsar/expandir todas las secciones */
  const aplicarATodas = useCallback((colapsado: boolean) => {
    guardar({
      sidebar_colapsado: colapsado,
      sidebar_secciones: {},
    })
  }, [guardar])

  /* Limpiar preferencia de esta sección (vuelve al global) */
  const limpiarSeccion = useCallback(() => {
    const nuevas = { ...preferencias.sidebar_secciones }
    delete nuevas[seccion]
    guardar({ sidebar_secciones: nuevas })
  }, [seccion, preferencias.sidebar_secciones, guardar])

  const tienePreferenciaSeccion = preferencias.sidebar_secciones?.[seccion] !== undefined

  const anchoSidebar = sidebarColapsado ? 'var(--sidebar-ancho-colapsado)' : 'var(--sidebar-ancho)'
  const fondoWrapper = efecto !== 'solido' ? 'transparent' : 'var(--superficie-app)'

  // Rutas que se renderizan a pantalla completa (sin sidebar ni header)
  const esPantallaCompleta = pathname === '/aplicaciones'

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
          }}
        >
          {children}
        </main>
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', backgroundColor: fondoWrapper, overflow: 'hidden' }}>
      <Sidebar
        colapsado={sidebarColapsado}
        onToggle={toggleSidebar}
        mobilAbierto={mobilMenuAbierto}
        onCerrarMobil={() => setMobilMenuAbierto(false)}
      />

      <div
        className="contenido-principal"
        style={{
          marginLeft: 0,
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
          migajasExtras={migajasExtras}
        />

        <ToastNotificacion />

        <main
          className="scrollbar-auto-oculto"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            overflowY: 'auto',
            backgroundColor: 'var(--superficie-app)',
          }}
        >
          {children}
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .contenido-principal {
            margin-left: ${anchoSidebar} !important;
          }
        }
      `}</style>
    </div>
  )
}

export { PlantillaApp }

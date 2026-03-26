'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useTema } from '@/hooks/useTema'
import type { Migaja } from '@/hooks/useNavegacion'
import type { ReactNode } from 'react'

/**
 * PlantillaApp — Layout principal de Flux.
 * Estructura: Sidebar (izquierda) + Header (arriba) + Main (contenido).
 * Se usa como wrapper de todas las páginas autenticadas.
 *
 * Responsive:
 * - Desktop: sidebar fija + contenido con margen izquierdo
 * - Mobile: sidebar oculta (hamburger) + contenido full width
 */

interface PropiedadesPlantilla {
  children: ReactNode
  migajasExtras?: Migaja[] // Para páginas con migajas dinámicas
}

function PlantillaApp({ children, migajasExtras }: PropiedadesPlantilla) {
  const [sidebarColapsado, setSidebarColapsado] = useState(false)
  const [mobilMenuAbierto, setMobilMenuAbierto] = useState(false)
  const { efecto } = useTema()

  const anchoSidebar = sidebarColapsado ? 'var(--sidebar-ancho-colapsado)' : 'var(--sidebar-ancho)'

  /* En modo cristal/semi-cristal, el wrapper es transparente para dejar ver el fondo del body */
  const fondoWrapper = efecto !== 'solido' ? 'transparent' : 'var(--superficie-app)'

  return (
    <div style={{ height: '100dvh', backgroundColor: fondoWrapper, overflow: 'hidden' }}>
      <Sidebar
        colapsado={sidebarColapsado}
        onToggle={() => setSidebarColapsado(!sidebarColapsado)}
        mobilAbierto={mobilMenuAbierto}
        onCerrarMobil={() => setMobilMenuAbierto(false)}
      />

      {/* Contenido principal — se desplaza según el sidebar */}
      <div
        className="contenido-principal"
        style={{
          marginLeft: 0,
          transition: `margin-left var(--transicion-normal)`,
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Header
          onAbrirMenuMobil={() => setMobilMenuAbierto(true)}
          migajasExtras={migajasExtras}
        />

        <main
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            overflowY: 'auto',
          }}
        >
          {children}
        </main>
      </div>

      {/* CSS responsive para el margen del sidebar */}
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

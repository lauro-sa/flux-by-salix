'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useIsFetching } from '@tanstack/react-query'
import { useCargaGlobal } from '@/hooks/useCargaGlobal'

/**
 * BarraProgresoGlobal — Barra de progreso fina que aparece en el borde
 * inferior del Header (sobre el contenido del módulo) cuando hay actividad
 * de carga.
 *
 * Se activa por tres disparadores:
 * 1. Navegación entre rutas: usePathname cambia (no searchParams para evitar
 *    activaciones espurias por query params como ?conv=xxx).
 * 2. React Query fetcheando por más de 250 ms: useIsFetching() > 0.
 *    El umbral evita parpadeos en fetches rapidísimos (típicos cuando todo
 *    está cacheado y el refetch silencioso termina en < 100 ms).
 * 3. Cargas externas reportadas vía `useReportarCarga` (módulos que no usan
 *    React Query — WhatsApp, Inbox, etc. con fetch directo y polling).
 *
 * Es un elemento de altura cero en el flujo normal: la barra se pinta como
 * absolute dentro del wrapper, así no empuja el contenido al activarse.
 *
 * Vive en PlantillaApp justo después del Header — su ancho respeta el del
 * contenedor padre (`contenido-principal`), que ya excluye el sidebar.
 */
export function BarraProgresoGlobal() {
  const pathname = usePathname()
  const fetching = useIsFetching()
  const { activos: cargasExternas } = useCargaGlobal()

  // Navegación: cuando cambia el pathname mostramos la barra ~400 ms para
  // dar feedback inmediato al click aunque React Query no haya empezado todavía.
  const [navegando, setNavegando] = useState(false)
  const pathAnteriorRef = useRef(pathname)
  useEffect(() => {
    if (pathAnteriorRef.current === pathname) return
    pathAnteriorRef.current = pathname
    setNavegando(true)
    const t = setTimeout(() => setNavegando(false), 400)
    return () => clearTimeout(t)
  }, [pathname])

  // Fetch con debounce: solo mostrar si dura > 250 ms. Sin esto, queries
  // simultáneas de hooks globales (notificaciones, permisos, módulos, etc.)
  // dejan `useIsFetching() > 0` en ráfagas continuas — la barra se quedaría
  // visible casi siempre. Con el umbral, solo se ve cuando hay carga real.
  const [fetchProlongado, setFetchProlongado] = useState(false)
  useEffect(() => {
    if (fetching > 0) {
      const t = setTimeout(() => setFetchProlongado(true), 250)
      return () => clearTimeout(t)
    }
    setFetchProlongado(false)
  }, [fetching])

  const visible = navegando || fetchProlongado || cargasExternas > 0

  return (
    <div className="relative h-0 w-full" aria-hidden>
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 z-40 h-0.5 overflow-hidden transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {/* Franja angosta del 20 % del ancho que cruza de izquierda a
            derecha. El timing `cubic-bezier(0.4, 0, 0.2, 1)` (Material
            standard) le da una desaceleración sutil al final sin generar
            "salto" al reiniciar el loop: arranque casi natural, frenado
            apenas perceptible cuando sale por la derecha. */}
        <div
          className="h-full w-1/3 rounded-full bg-texto-marca/80"
          style={{ animation: 'flux-barra-progreso 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
        />
      </div>
    </div>
  )
}

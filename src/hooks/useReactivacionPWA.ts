'use client'

import { useEffect } from 'react'

/**
 * Nombre del evento global que se dispara cuando la PWA vuelve al primer plano
 * tras una restauración real desde bfcache (iOS Safari: volver de Google Maps,
 * WhatsApp, tel:, etc.). Los hooks/componentes con suscripciones Realtime
 * pueden escucharlo (vía `useEscucharReactivacion`) para re-suscribirse.
 *
 * NO se dispara en cambios de pestaña comunes (Cmd+Tab, abrir otra app en
 * móvil y volver). Para refrescar datos en esos casos, TanStack Query tiene
 * `refetchOnWindowFocus: true` configurado por defecto y lo maneja respetando
 * el `staleTime` de cada query.
 */
export const EVENTO_REACTIVACION = 'flux:reactivada'

/**
 * useReactivacionPWA — maneja el "despertar" de la PWA al volver de un link
 * externo en iOS Safari (bfcache).
 *
 * En iOS Safari, cuando el usuario sale de la PWA y vuelve, el DOM se restaura
 * desde el bfcache pero:
 *   - `--vh` puede quedar con un valor antiguo (no siempre se dispara `resize`)
 *   - Los canales Realtime de Supabase pueden haber perdido la conexión
 *
 * Este hook:
 *   - Recalcula `--vh` en cada `visibilitychange` → visible (barato y necesario
 *     para que el layout no quede roto en iOS).
 *   - Dispara el evento `flux:reactivada` SOLO en `pageshow` con
 *     `event.persisted === true`, que es la señal específica de bfcache.
 *
 * NO invalida queries manualmente: TanStack Query ya refresca al volver a la
 * pestaña vía `refetchOnWindowFocus` (configurado en ProveedorQuery), con
 * respeto al `staleTime` de cada query. Invalidar todo en cada cambio de
 * visibilidad causaba tormentas de re-renders y sensación de "refresh".
 *
 * Se monta una sola vez en PlantillaApp.
 */
export function useReactivacionPWA() {
  useEffect(() => {
    // Recalcula la altura real del viewport para iOS Safari (hack --vh).
    const actualizarAltura = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    // Workaround para iOS standalone: al volver de una app externa
    // (Maps, WhatsApp, tel:), el WebView a veces queda pintado en blanco.
    // Un nudge de opacidad sobre el body fuerza un repaint sin afectar
    // el layout ni provocar parpadeo perceptible.
    const forzarRepaint = () => {
      const body = document.body
      if (!body) return
      body.style.opacity = '0.999'
      requestAnimationFrame(() => {
        body.style.opacity = ''
      })
    }

    const onVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        actualizarAltura()
        forzarRepaint()
      }
    }

    // `pageshow` con `persisted=true` indica restauración desde bfcache (iOS Safari).
    // Solo en ese caso emitimos el evento de reactivación para que los
    // componentes con Realtime se re-suscriban.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        actualizarAltura()
        forzarRepaint()
        window.dispatchEvent(new CustomEvent(EVENTO_REACTIVACION))
      }
    }

    // Altura inicial + listeners estándar de resize.
    actualizarAltura()
    window.addEventListener('resize', actualizarAltura)
    window.visualViewport?.addEventListener('resize', actualizarAltura)
    document.addEventListener('visibilitychange', onVisibilidad)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      window.removeEventListener('resize', actualizarAltura)
      window.visualViewport?.removeEventListener('resize', actualizarAltura)
      document.removeEventListener('visibilitychange', onVisibilidad)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])
}

/**
 * useEscucharReactivacion — suscribe un callback al evento de reactivación.
 * Úsalo en hooks/componentes con suscripciones Realtime para volver a conectarse
 * o refrescar datos cuando la PWA vuelve del background.
 */
export function useEscucharReactivacion(callback: () => void) {
  useEffect(() => {
    const handler = () => callback()
    window.addEventListener(EVENTO_REACTIVACION, handler)
    return () => window.removeEventListener(EVENTO_REACTIVACION, handler)
  }, [callback])
}

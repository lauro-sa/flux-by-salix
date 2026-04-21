'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Nombre del evento global que se dispara cuando la PWA vuelve al primer plano.
 * Los hooks/componentes que mantienen suscripciones Realtime pueden escucharlo
 * (vía `useEscucharReactivacion`) para re-suscribirse y refrescar datos.
 */
export const EVENTO_REACTIVACION = 'flux:reactivada'

/**
 * useReactivacionPWA — maneja el "despertar" de la PWA al volver de un link externo.
 *
 * En iOS Safari, cuando el usuario sale de la PWA (Google Maps, WhatsApp, tel:, etc.)
 * y vuelve, el DOM se restaura desde el bfcache pero:
 *   - `--vh` puede quedar con un valor antiguo (no siempre se dispara `resize`)
 *   - Los canales Realtime de Supabase pueden haber perdido la conexión
 *   - Los datos en cache pueden estar desactualizados
 *
 * Este hook escucha `visibilitychange` y `pageshow` y al detectar el regreso al
 * primer plano dispara la reactivación: recalcula `--vh`, invalida las queries y
 * emite el evento global para que los componentes con Realtime se re-suscriban.
 *
 * Se monta una sola vez en PlantillaApp.
 */
export function useReactivacionPWA() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Recalcula la altura real del viewport para iOS Safari (hack --vh).
    const actualizarAltura = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    const reactivar = () => {
      actualizarAltura()
      // Invalida queries: TanStack Query refetcheará las que estén montadas.
      queryClient.invalidateQueries()
      // Avisa a componentes con Realtime / estado propio que deben refrescar.
      window.dispatchEvent(new CustomEvent(EVENTO_REACTIVACION))
    }

    const onVisibilidad = () => {
      if (document.visibilityState === 'visible') reactivar()
    }

    // `pageshow` con `persisted=true` indica restauración desde bfcache (iOS Safari).
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reactivar()
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
  }, [queryClient])
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

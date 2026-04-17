'use client'

import { useEffect, useRef } from 'react'
import { INTERVALO_SYNC_CORREO_BACKGROUND } from '@/lib/constantes/timeouts'

/**
 * useSyncCorreoBackground — Sincroniza correos en background desde cualquier página.
 *
 * Problema que resuelve: sin Google Pub/Sub configurado y con crons de Vercel Hobby
 * poco fiables, los correos solo se sincronizaban al entrar manualmente al inbox.
 * Este hook corre en PlantillaApp y sincroniza cada 3 minutos desde cualquier página,
 * generando notificaciones si hay correos nuevos.
 *
 * No sincroniza si:
 * - La pestaña está oculta (document.hidden)
 * - Ya hay una sincronización en curso
 * - El usuario está en /inbox (ahí ya corre su propio sync más frecuente)
 */
export function useSyncCorreoBackground() {
  const sincronizandoRef = useRef(false)

  useEffect(() => {
    // Sync inicial con delay para no competir con la carga de la página
    const timeoutInicial = setTimeout(() => {
      sincronizar()
    }, 10000)

    const intervalo = setInterval(sincronizar, INTERVALO_SYNC_CORREO_BACKGROUND)

    return () => {
      clearTimeout(timeoutInicial)
      clearInterval(intervalo)
    }
  }, [])

  function sincronizar() {
    // No sincronizar si la pestaña está oculta
    if (document.hidden) return

    // No sincronizar si ya hay una en curso
    if (sincronizandoRef.current) return

    // No sincronizar si el usuario está en inbox (ahí tiene su propio sync)
    if (window.location.pathname.startsWith('/inbox')) return

    sincronizandoRef.current = true

    fetch('/api/inbox/correo/sincronizar', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        sincronizandoRef.current = false
      })
  }
}

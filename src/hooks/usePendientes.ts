'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * usePendientes — Items pendientes del usuario con detalle.
 * Fetch a /api/pendientes con polling cada 5 minutos + refresh al volver a la pestaña.
 * Se usa en: sidebar (dots), header (popover actividades con lista real).
 */

export interface ActividadPendiente {
  id: string
  titulo: string
  fecha_vencimiento: string
  estado_clave: string
  tipo_clave: string | null
  prioridad: string
}

export interface Pendientes {
  actividades_hoy: number
  actividades_hoy_items: ActividadPendiente[]
  actividades_vencidas: number
  actividades_vencidas_items: ActividadPendiente[]
  visitas_hoy: number
}

const PENDIENTES_VACIO: Pendientes = {
  actividades_hoy: 0,
  actividades_hoy_items: [],
  actividades_vencidas: 0,
  actividades_vencidas_items: [],
  visitas_hoy: 0,
}

const INTERVALO_POLLING = 5 * 60 * 1000 // 5 minutos

function usePendientes() {
  const [pendientes, setPendientes] = useState<Pendientes>(PENDIENTES_VACIO)
  const [cargando, setCargando] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPendientes = useCallback(async () => {
    try {
      const res = await fetch('/api/pendientes')
      if (!res.ok) return
      const data = await res.json()
      setPendientes(data)
    } catch {
      // Silencioso — no bloquear UI
    } finally {
      setCargando(false)
    }
  }, [])

  // Fetch inicial + polling
  useEffect(() => {
    fetchPendientes()
    intervalRef.current = setInterval(fetchPendientes, INTERVALO_POLLING)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchPendientes])

  // Refrescar cuando la ventana vuelve a tener foco (tab switch)
  useEffect(() => {
    const onFocus = () => fetchPendientes()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchPendientes])

  const totalActividades = pendientes.actividades_hoy + pendientes.actividades_vencidas

  /** Helper: ¿hay items pendientes para esta sección del sidebar/header? */
  const hayPendientes = useCallback((seccion: string): boolean => {
    switch (seccion) {
      case 'actividades': return totalActividades > 0
      case 'visitas': return pendientes.visitas_hoy > 0
      default: return false
    }
  }, [totalActividades, pendientes.visitas_hoy])

  return {
    ...pendientes,
    totalActividades,
    hayPendientes,
    cargando,
    refrescar: fetchPendientes,
  }
}

export { usePendientes }

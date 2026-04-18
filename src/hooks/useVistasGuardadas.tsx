'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DireccionOrden } from '@/componentes/tablas/TablaDinamica'

/**
 * Estado de datos de una vista — define QUÉ datos se ven (no cómo se ven).
 * Incluye búsqueda, filtros activos y ordenamiento.
 * NO incluye columnas visibles, anchos, etc. (eso va en preferencias).
 */
interface EstadoVistaDatos {
  busqueda: string
  filtros: Record<string, string | string[]>
  ordenamiento: { clave: string; direccion: DireccionOrden }[]
}

/** Vista guardada como se almacena en BD */
interface VistaGuardada {
  id: string
  nombre: string
  icono?: string | null
  orden?: number
  predefinida: boolean
  es_sistema?: boolean
  estado: EstadoVistaDatos
}

/** Resultado del detector: default (sin cambios), vista_activa (coincide con una vista), sin_guardar (cambios sin guardar) */
type EstadoDetector = 'default' | 'vista_activa' | 'sin_guardar'

/** Resultado completo del detector */
interface ResultadoDetector {
  tipo: EstadoDetector
  vistaActiva: VistaGuardada | null
}

/* ── Helpers de comparación ── */

/** Compara dos estados de vista por igualdad exacta */
function estadosIguales(a: EstadoVistaDatos, b: EstadoVistaDatos): boolean {
  /* Búsqueda */
  if (a.busqueda !== b.busqueda) return false

  /* Ordenamiento */
  if (a.ordenamiento.length !== b.ordenamiento.length) return false
  for (let i = 0; i < a.ordenamiento.length; i++) {
    if (a.ordenamiento[i].clave !== b.ordenamiento[i].clave) return false
    if (a.ordenamiento[i].direccion !== b.ordenamiento[i].direccion) return false
  }

  /* Filtros */
  const clavesA = Object.keys(a.filtros)
  const clavesB = Object.keys(b.filtros)

  /* Solo comparar claves con valor activo (no vacío) */
  const activasA = clavesA.filter(k => {
    const v = a.filtros[k]
    return Array.isArray(v) ? v.length > 0 : v !== ''
  })
  const activasB = clavesB.filter(k => {
    const v = b.filtros[k]
    return Array.isArray(v) ? v.length > 0 : v !== ''
  })

  if (activasA.length !== activasB.length) return false

  for (const clave of activasA) {
    const va = a.filtros[clave]
    const vb = b.filtros[clave]
    if (va === undefined || vb === undefined) return false
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length) return false
      const ordenadoA = [...va].sort()
      const ordenadoB = [...vb].sort()
      for (let i = 0; i < ordenadoA.length; i++) {
        if (ordenadoA[i] !== ordenadoB[i]) return false
      }
    } else if (va !== vb) {
      return false
    }
  }

  return true
}

/** Estado default: sin búsqueda, sin filtros, sin orden */
const ESTADO_DEFAULT: EstadoVistaDatos = {
  busqueda: '',
  filtros: {},
  ordenamiento: [],
}

/**
 * Hook para gestionar vistas guardadas de un módulo.
 * Carga desde BD, provee CRUD, y ejecuta el detector reactivo.
 * Se usa dentro de TablaDinamica cuando se pasa idModulo.
 */
function useVistasGuardadas(modulo?: string) {
  const [vistas, setVistas] = useState<VistaGuardada[]>([])
  const [cargando, setCargando] = useState(true)

  /* ── Cargar vistas del módulo ── */
  useEffect(() => {
    if (!modulo) { setCargando(false); return }

    fetch(`/api/vistas?modulo=${modulo}`)
      .then(res => res.ok ? res.json() : [])
      .then((data: VistaGuardada[]) => setVistas(data))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [modulo])

  /* ── Guardar nueva vista ── */
  const guardar = useCallback(async (nombre: string, estado: EstadoVistaDatos, icono?: string | null) => {
    if (!modulo) return null
    try {
      const res = await fetch('/api/vistas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo, nombre, estado, icono }),
      })
      if (res.ok) {
        const nueva: VistaGuardada = await res.json()
        setVistas(prev => [...prev, nueva])
        return nueva
      }
    } catch { /* silencioso */ }
    return null
  }, [modulo])

  /* ── Renombrar vista ── */
  const renombrar = useCallback(async (id: string, nombre: string) => {
    try {
      const res = await fetch('/api/vistas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nombre }),
      })
      if (res.ok) {
        const actualizada: VistaGuardada = await res.json()
        setVistas(prev => prev.map(v => v.id === id ? actualizada : v))
      }
    } catch { /* silencioso */ }
  }, [])

  /* ── Cambiar icono (emoji) ── */
  const cambiarIcono = useCallback(async (id: string, icono: string | null) => {
    try {
      const res = await fetch('/api/vistas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, icono }),
      })
      if (res.ok) {
        const actualizada: VistaGuardada = await res.json()
        setVistas(prev => prev.map(v => v.id === id ? actualizada : v))
      }
    } catch { /* silencioso */ }
  }, [])

  /* ── Reordenar vistas en lote ── */
  const reordenar = useCallback(async (idsOrdenados: string[]) => {
    // Actualización optimista en cliente
    setVistas(prev => {
      const map = new Map(prev.map(v => [v.id, v]))
      const reordenadas: VistaGuardada[] = []
      idsOrdenados.forEach((id, i) => {
        const v = map.get(id)
        if (v) reordenadas.push({ ...v, orden: i })
      })
      // Mantener las que no vinieron en la lista (ej: sistema) al inicio
      const faltantes = prev.filter(v => !idsOrdenados.includes(v.id))
      return [...faltantes, ...reordenadas]
    })
    try {
      const ordenes = idsOrdenados.map((id, i) => ({ id, orden: i }))
      await fetch('/api/vistas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordenes }),
      })
    } catch { /* silencioso */ }
  }, [])

  /* ── Eliminar vista ── */
  const eliminar = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/vistas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setVistas(prev => prev.filter(v => v.id !== id))
      }
    } catch { /* silencioso */ }
  }, [])

  /* ── Sobrescribir vista existente con nuevo estado ── */
  const sobrescribir = useCallback(async (id: string, estado: EstadoVistaDatos) => {
    try {
      const res = await fetch('/api/vistas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      })
      if (res.ok) {
        const actualizada: VistaGuardada = await res.json()
        setVistas(prev => prev.map(v => v.id === id ? actualizada : v))
      }
    } catch { /* silencioso */ }
  }, [])

  /* ── Marcar/desmarcar como predefinida ── */
  const marcarPredefinida = useCallback(async (id: string) => {
    if (!modulo) return
    try {
      const res = await fetch('/api/vistas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, predefinida: true, modulo }),
      })
      if (res.ok) {
        /* Solo una predefinida por módulo — desmarcar las demás */
        setVistas(prev => prev.map(v => ({
          ...v,
          predefinida: v.id === id,
        })))
      }
    } catch { /* silencioso */ }
  }, [modulo])

  /* ── Obtener la vista predefinida (para aplicar al entrar al módulo) ── */
  const vistaPredefinida = useMemo(
    () => vistas.find(v => v.predefinida) || null,
    [vistas]
  )

  return {
    vistas,
    cargando,
    guardar,
    eliminar,
    sobrescribir,
    marcarPredefinida,
    renombrar,
    cambiarIcono,
    reordenar,
    vistaPredefinida,
  }
}

/**
 * Hook detector de vistas — compara el estado actual contra default y vistas guardadas.
 * Retorna reactivamente qué tipo de estado estamos viendo.
 */
function useDetectorVistas(
  estadoActual: EstadoVistaDatos,
  vistas: VistaGuardada[]
): ResultadoDetector {
  return useMemo(() => {
    /* Paso 1: ¿Es el estado default? */
    if (estadosIguales(estadoActual, ESTADO_DEFAULT)) {
      return { tipo: 'default' as const, vistaActiva: null }
    }

    /* Paso 2: ¿Coincide con alguna vista guardada? */
    for (const vista of vistas) {
      if (estadosIguales(estadoActual, vista.estado)) {
        return { tipo: 'vista_activa' as const, vistaActiva: vista }
      }
    }

    /* Paso 3: Cambios sin guardar */
    return { tipo: 'sin_guardar' as const, vistaActiva: null }
  }, [estadoActual, vistas])
}

export {
  useVistasGuardadas,
  useDetectorVistas,
  estadosIguales,
  ESTADO_DEFAULT,
  type EstadoVistaDatos,
  type VistaGuardada,
  type EstadoDetector,
  type ResultadoDetector,
}

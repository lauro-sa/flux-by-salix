'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CategoriaNotificacion } from '@/hooks/useNotificaciones'

/**
 * useModoConcentracion — Hook para gestionar el modo "No molestar".
 * Silencia notificaciones por tiempo y/o categoría.
 * Persiste en localStorage para que sobreviva recargas de página.
 * Se usa en: NotificacionesHeader, Header (menú Flux).
 */

/* ─── Tipos ─── */

export interface ConfigConcentracion {
  /** Está activo el modo concentración */
  activo: boolean
  /** Timestamp Unix (ms) en que expira. null = manual (sin timer) */
  expiraEn: number | null
  /** Categorías silenciadas. Vacío = todas silenciadas */
  categoriasSilenciadas: CategoriaNotificacion[]
}

export interface OpcionTiempo {
  etiqueta: string
  /** Duración en minutos. null = hasta que lo desactive manualmente */
  minutos: number | null
}

const CLAVE_STORAGE = 'flux_modo_concentracion'

const OPCIONES_TIEMPO: OpcionTiempo[] = [
  { etiqueta: '30 minutos', minutos: 30 },
  { etiqueta: '1 hora', minutos: 60 },
  { etiqueta: '2 horas', minutos: 120 },
  { etiqueta: '4 horas', minutos: 240 },
  { etiqueta: 'Hasta mañana', minutos: null }, // se calcula dinámicamente → mañana 8:00
]

/** Ciclo rápido: cada click avanza al siguiente nivel */
const CICLO_RAPIDO: OpcionTiempo[] = [
  { etiqueta: '30 minutos', minutos: 30 },
  { etiqueta: '1 hora', minutos: 60 },
  { etiqueta: '4 horas', minutos: 240 },
  { etiqueta: 'Hasta mañana', minutos: null },
]

/* ─── Helpers ─── */

function calcularMinutosHastaMañana(): number {
  const ahora = new Date()
  const mañana = new Date(ahora)
  mañana.setDate(mañana.getDate() + 1)
  mañana.setHours(8, 0, 0, 0) // mañana a las 8:00
  return Math.ceil((mañana.getTime() - ahora.getTime()) / 60000)
}

function leerStorage(): ConfigConcentracion | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CLAVE_STORAGE)
    if (!raw) return null
    const config = JSON.parse(raw) as ConfigConcentracion
    /* Si ya expiró, limpiar */
    if (config.expiraEn && config.expiraEn < Date.now()) {
      localStorage.removeItem(CLAVE_STORAGE)
      return null
    }
    return config
  } catch {
    return null
  }
}

function guardarStorage(config: ConfigConcentracion | null) {
  if (typeof window === 'undefined') return
  if (!config || !config.activo) {
    localStorage.removeItem(CLAVE_STORAGE)
  } else {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(config))
  }
}

/* ─── Hook ─── */

function useModoConcentracion() {
  const [config, setConfig] = useState<ConfigConcentracion>({
    activo: false,
    expiraEn: null,
    categoriasSilenciadas: [],
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Leer de localStorage al montar */
  useEffect(() => {
    const guardado = leerStorage()
    if (guardado) setConfig(guardado)
  }, [])

  /* Timer para auto-desactivar cuando expira */
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!config.activo || !config.expiraEn) return

    const restante = config.expiraEn - Date.now()
    if (restante <= 0) {
      desactivar()
      return
    }

    timerRef.current = setTimeout(() => {
      desactivar()
    }, restante)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activo, config.expiraEn])

  /** Activar modo concentración — siempre con timer, máximo hasta mañana 8:00 */
  const activar = useCallback((opcion: OpcionTiempo, categorias?: CategoriaNotificacion[]) => {
    let expiraEn: number

    if (opcion.etiqueta === 'Hasta mañana') {
      expiraEn = Date.now() + calcularMinutosHastaMañana() * 60000
    } else if (opcion.minutos !== null) {
      expiraEn = Date.now() + opcion.minutos * 60000
    } else {
      /* Fallback: si por alguna razón no tiene minutos, usar hasta mañana */
      expiraEn = Date.now() + calcularMinutosHastaMañana() * 60000
    }

    const nueva: ConfigConcentracion = {
      activo: true,
      expiraEn,
      categoriasSilenciadas: categorias || [],
    }
    setConfig(nueva)
    guardarStorage(nueva)
  }, [])

  /** Desactivar modo concentración */
  const desactivar = useCallback(() => {
    const nueva: ConfigConcentracion = {
      activo: false,
      expiraEn: null,
      categoriasSilenciadas: [],
    }
    setConfig(nueva)
    guardarStorage(null)
  }, [])

  /** Verificar si una categoría específica está silenciada */
  const estaSilenciada = useCallback((categoria: CategoriaNotificacion): boolean => {
    if (!config.activo) return false
    /* Si no hay categorías específicas, todas están silenciadas */
    if (config.categoriasSilenciadas.length === 0) return true
    return config.categoriasSilenciadas.includes(categoria)
  }, [config])

  /** Texto descriptivo del estado actual */
  const textoEstado = (): string => {
    if (!config.activo) return ''
    if (!config.expiraEn) return 'Silenciado — expira pronto'
    const restante = config.expiraEn - Date.now()
    if (restante <= 0) return ''
    const min = Math.ceil(restante / 60000)
    if (min < 60) return `Silenciado — ${min} min restantes`
    const hrs = Math.floor(min / 60)
    const minRest = min % 60
    if (minRest === 0) return `Silenciado — ${hrs}h restantes`
    return `Silenciado — ${hrs}h ${minRest}min restantes`
  }

  /** Tiempo restante en ms (0 si no hay timer o no está activo) */
  const tiempoRestante = (): number => {
    if (!config.activo || !config.expiraEn) return 0
    return Math.max(0, config.expiraEn - Date.now())
  }

  /**
   * Ciclar — un click para todo. Cada click avanza:
   * apagado → 30min → 1h → 4h → hasta mañana → apagado
   */
  const ciclar = useCallback(() => {
    if (!config.activo) {
      /* Primer click: activar 30 min */
      activar(CICLO_RAPIDO[0])
      return
    }

    /* Buscar el paso actual por duración restante */
    const restanteMin = config.expiraEn ? Math.ceil((config.expiraEn - Date.now()) / 60000) : 0
    let indiceActual = -1

    /* Determinar en qué paso estamos basado en tiempo restante */
    if (restanteMin <= 30) indiceActual = 0
    else if (restanteMin <= 60) indiceActual = 1
    else if (restanteMin <= 240) indiceActual = 2
    else indiceActual = 3

    const siguienteIndice = indiceActual + 1
    if (siguienteIndice >= CICLO_RAPIDO.length) {
      /* Ya estaba en el último: desactivar */
      desactivar()
    } else {
      /* Avanzar al siguiente */
      activar(CICLO_RAPIDO[siguienteIndice])
    }
  }, [config, activar, desactivar])

  /** Texto que indica qué pasa con el siguiente click */
  const textoSiguiente = (): string => {
    if (!config.activo) return 'Click para silenciar 30 min'

    const restanteMin = config.expiraEn ? Math.ceil((config.expiraEn - Date.now()) / 60000) : 0
    let indiceActual = -1
    if (restanteMin <= 30) indiceActual = 0
    else if (restanteMin <= 60) indiceActual = 1
    else if (restanteMin <= 240) indiceActual = 2
    else indiceActual = 3

    const siguienteIndice = indiceActual + 1
    if (siguienteIndice >= CICLO_RAPIDO.length) {
      return 'Click para desactivar'
    }
    return `Click para extender a ${CICLO_RAPIDO[siguienteIndice].etiqueta.toLowerCase()}`
  }

  return {
    ...config,
    activar,
    desactivar,
    ciclar,
    estaSilenciada,
    textoEstado,
    textoSiguiente,
    tiempoRestante,
    opcionesTiempo: OPCIONES_TIEMPO,
  }
}

export { useModoConcentracion, OPCIONES_TIEMPO }

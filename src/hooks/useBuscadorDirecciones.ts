/**
 * Hook — Buscador de direcciones con Google Places API.
 * Maneja autocompletado, debounce, session tokens y selección.
 * Se usa en: componente InputDireccion.
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Direccion, SugerenciaDireccion } from '@/tipos/direccion'

interface OpcionesBuscador {
  /** Códigos de país ISO 3166-1 alpha-2 para restringir búsqueda (máx 5) */
  paises?: string[]
  /** Milisegundos de debounce antes de buscar (default: 300) */
  debounce?: number
  /** Mínimo de caracteres para iniciar búsqueda (default: 3) */
  minimoCaracteres?: number
  /** Callback cuando se selecciona una dirección */
  alSeleccionar?: (direccion: Direccion) => void
}

interface EstadoBuscador {
  texto: string
  sugerencias: SugerenciaDireccion[]
  cargando: boolean
  error: string | null
  abierto: boolean
  direccionSeleccionada: Direccion | null
}

/** Genera un ID único para session token */
function generarSessionToken(): string {
  return crypto.randomUUID()
}

export function useBuscadorDirecciones(opciones: OpcionesBuscador = {}) {
  const {
    paises,
    debounce: tiempoDebounce = 300,
    minimoCaracteres = 3,
    alSeleccionar,
  } = opciones

  const [estado, setEstado] = useState<EstadoBuscador>({
    texto: '',
    sugerencias: [],
    cargando: false,
    error: null,
    abierto: false,
    direccionSeleccionada: null,
  })

  const sessionTokenRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  /** Buscar sugerencias en el API */
  const buscar = useCallback(async (texto: string) => {
    // Cancelar petición anterior
    if (abortRef.current) abortRef.current.abort()

    if (texto.length < minimoCaracteres) {
      setEstado(prev => ({ ...prev, sugerencias: [], abierto: false, cargando: false }))
      return
    }

    // Crear session token si no existe
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = generarSessionToken()
    }

    const controller = new AbortController()
    abortRef.current = controller

    setEstado(prev => ({ ...prev, cargando: true, error: null }))

    try {
      const respuesta = await fetch('/api/lugares/autocompletar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto,
          paises,
          sessionToken: sessionTokenRef.current,
        }),
        signal: controller.signal,
      })

      if (!respuesta.ok) throw new Error('Error al buscar')

      const datos = await respuesta.json()

      setEstado(prev => ({
        ...prev,
        sugerencias: datos.sugerencias || [],
        abierto: (datos.sugerencias || []).length > 0,
        cargando: false,
      }))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setEstado(prev => ({
        ...prev,
        cargando: false,
        error: 'No se pudieron cargar las sugerencias',
        abierto: false,
      }))
    }
  }, [minimoCaracteres, paises])

  /** Manejar cambio de texto con debounce */
  const cambiarTexto = useCallback((nuevoTexto: string) => {
    setEstado(prev => ({
      ...prev,
      texto: nuevoTexto,
      direccionSeleccionada: null,
    }))

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (nuevoTexto.length < minimoCaracteres) {
      setEstado(prev => ({ ...prev, sugerencias: [], abierto: false }))
      return
    }

    debounceRef.current = setTimeout(() => {
      buscar(nuevoTexto)
    }, tiempoDebounce)
  }, [buscar, tiempoDebounce, minimoCaracteres])

  /** Seleccionar una sugerencia y obtener el detalle completo */
  const seleccionar = useCallback(async (sugerencia: SugerenciaDireccion) => {
    setEstado(prev => ({
      ...prev,
      texto: sugerencia.textoPrincipal,
      abierto: false,
      cargando: true,
      error: null,
    }))

    try {
      const respuesta = await fetch('/api/lugares/detalle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: sugerencia.placeId,
          sessionToken: sessionTokenRef.current,
        }),
      })

      // Destruir session token después de la selección
      sessionTokenRef.current = null

      if (!respuesta.ok) throw new Error('Error al obtener detalle')

      const datos = await respuesta.json()
      const direccion: Direccion = datos.direccion

      setEstado(prev => ({
        ...prev,
        texto: direccion.textoCompleto,
        direccionSeleccionada: direccion,
        cargando: false,
        sugerencias: [],
      }))

      alSeleccionar?.(direccion)
    } catch {
      sessionTokenRef.current = null
      setEstado(prev => ({
        ...prev,
        cargando: false,
        error: 'No se pudo obtener el detalle de la dirección',
      }))
    }
  }, [alSeleccionar])

  /** Cerrar el dropdown */
  const cerrar = useCallback(() => {
    setEstado(prev => ({ ...prev, abierto: false }))
  }, [])

  /** Limpiar todo */
  const limpiar = useCallback(() => {
    sessionTokenRef.current = null
    setEstado({
      texto: '',
      sugerencias: [],
      cargando: false,
      error: null,
      abierto: false,
      direccionSeleccionada: null,
    })
  }, [])

  /** Establecer texto sin disparar búsqueda (para valores iniciales) */
  const establecerTexto = useCallback((texto: string) => {
    setEstado(prev => ({ ...prev, texto }))
  }, [])

  return {
    ...estado,
    cambiarTexto,
    seleccionar,
    cerrar,
    limpiar,
    establecerTexto,
  }
}

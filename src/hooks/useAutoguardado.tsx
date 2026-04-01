'use client'

import { useState, useRef, useCallback } from 'react'

/**
 * Hook para autoguardado inteligente.
 * - Solo guarda si el valor realmente cambió (compara con snapshot anterior)
 * - Debounce configurable
 * - Permite deshacer el último cambio guardado
 * Se usa en: configuración de empresa, edición de registros, perfil.
 */

type EstadoGuardado = 'idle' | 'guardando' | 'guardado' | 'error'

interface OpcionesAutoguardado {
  onGuardar: (datos: Record<string, unknown>) => Promise<boolean>
  debounce?: number
}

interface UltimoGuardado {
  datos: Record<string, unknown>
  anteriores: Record<string, unknown>
}

function useAutoguardado({ onGuardar, debounce = 800 }: OpcionesAutoguardado) {
  const [estado, setEstado] = useState<EstadoGuardado>('idle')
  const [puedeDeshacer, setPuedeDeshacer] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ocultarRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const datosAcumulados = useRef<Record<string, unknown>>({})
  const snapshotRef = useRef<Record<string, unknown>>({})
  const ultimoGuardado = useRef<UltimoGuardado | null>(null)

  const limpiarEstado = useCallback(() => {
    if (ocultarRef.current) clearTimeout(ocultarRef.current)
    ocultarRef.current = setTimeout(() => {
      setEstado('idle')
      setPuedeDeshacer(false)
    }, 4000)
  }, [])

  /** Encola un guardado con debounce. Solo guarda si hay cambios reales. */
  const guardar = useCallback((campos: Record<string, unknown>) => {
    // Verificar si realmente cambió algo
    let hayCambios = false
    for (const [clave, valor] of Object.entries(campos)) {
      if (snapshotRef.current[clave] !== valor) {
        hayCambios = true
        break
      }
    }

    if (!hayCambios) return

    datosAcumulados.current = { ...datosAcumulados.current, ...campos }

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(async () => {
      const datos = { ...datosAcumulados.current }
      datosAcumulados.current = {}

      // Guardar snapshot anterior para undo
      const anteriores: Record<string, unknown> = {}
      for (const clave of Object.keys(datos)) {
        anteriores[clave] = snapshotRef.current[clave]
      }

      setEstado('guardando')
      const ok = await onGuardar(datos)

      if (ok) {
        // Actualizar snapshot
        snapshotRef.current = { ...snapshotRef.current, ...datos }
        ultimoGuardado.current = { datos, anteriores }
        setEstado('guardado')
        setPuedeDeshacer(true)
        limpiarEstado()
      } else {
        setEstado('error')
        limpiarEstado()
      }
    }, debounce)
  }, [onGuardar, debounce, limpiarEstado])

  /** Guarda inmediatamente (selects, toggles). Solo si cambió. */
  const guardarInmediato = useCallback(async (campos: Record<string, unknown>) => {
    let hayCambios = false
    for (const [clave, valor] of Object.entries(campos)) {
      if (snapshotRef.current[clave] !== valor) {
        hayCambios = true
        break
      }
    }

    if (!hayCambios) return

    const anteriores: Record<string, unknown> = {}
    for (const clave of Object.keys(campos)) {
      anteriores[clave] = snapshotRef.current[clave]
    }

    setEstado('guardando')
    const ok = await onGuardar(campos)

    if (ok) {
      snapshotRef.current = { ...snapshotRef.current, ...campos }
      ultimoGuardado.current = { datos: campos, anteriores }
      setEstado('guardado')
      setPuedeDeshacer(true)
      limpiarEstado()
    } else {
      setEstado('error')
      limpiarEstado()
    }
  }, [onGuardar, limpiarEstado])

  /** Deshace el último guardado — restaura valores anteriores en el servidor */
  const deshacer = useCallback(async () => {
    if (!ultimoGuardado.current) return null

    const { anteriores } = ultimoGuardado.current

    setEstado('guardando')
    const ok = await onGuardar(anteriores)

    if (ok) {
      snapshotRef.current = { ...snapshotRef.current, ...anteriores }
      setEstado('guardado')
      setPuedeDeshacer(false)
      limpiarEstado()
    }

    const valoresRestaurados = { ...anteriores }
    ultimoGuardado.current = null
    return valoresRestaurados
  }, [onGuardar, limpiarEstado])

  /** Fuerza el guardado inmediato de datos pendientes en el debounce */
  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    const datos = { ...datosAcumulados.current }
    if (Object.keys(datos).length === 0) return
    datosAcumulados.current = {}
    await onGuardar(datos)
    snapshotRef.current = { ...snapshotRef.current, ...datos }
  }, [onGuardar])

  /** Setea el snapshot inicial (valores cargados del servidor) */
  const setSnapshot = useCallback((datos: Record<string, unknown>) => {
    snapshotRef.current = { ...datos }
  }, [])

  return { estado, puedeDeshacer, guardar, guardarInmediato, deshacer, setSnapshot, flush }
}

export { useAutoguardado, type EstadoGuardado }

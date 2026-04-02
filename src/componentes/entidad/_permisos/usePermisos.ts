'use client'

/**
 * usePermisos — Hook que encapsula toda la logica de estado, toggles,
 * presets y persistencia de la seccion de permisos.
 * Se usa en: SeccionPermisos (componente orquestador).
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { PERMISOS_POR_ROL } from '@/hooks/useRol'
import type { Rol, Modulo, Accion, PermisosMapa } from '@/tipos'
import { CATEGORIAS_MODULOS, ACCIONES_POR_MODULO } from '@/tipos'
import type { EstadisticasPermisos, RetornoUsePermisos } from './tipos'

interface ParametrosUsePermisos {
  miembroId: string
  rol: Rol
  permisosCustomIniciales: PermisosMapa | null
  onGuardar: (permisos: PermisosMapa | null) => Promise<void>
}

export function usePermisos({
  miembroId,
  rol,
  permisosCustomIniciales,
  onGuardar,
}: ParametrosUsePermisos): RetornoUsePermisos {
  // Estado local de permisos (editables)
  const [permisos, setPermisos] = useState<PermisosMapa>(() => {
    if (permisosCustomIniciales) return structuredClone(permisosCustomIniciales)
    return structuredClone(PERMISOS_POR_ROL[rol] || {})
  })
  const [usaCustom, setUsaCustom] = useState(permisosCustomIniciales !== null)
  const [guardando, setGuardando] = useState(false)

  // Sincronizar si cambia el miembro
  useEffect(() => {
    if (permisosCustomIniciales) {
      setPermisos(structuredClone(permisosCustomIniciales))
      setUsaCustom(true)
    } else {
      setPermisos(structuredClone(PERMISOS_POR_ROL[rol] || {}))
      setUsaCustom(false)
    }
  }, [miembroId, rol, permisosCustomIniciales])

  // Calcular estadisticas
  const estadisticas = useMemo<EstadisticasPermisos>(() => {
    let totalActivas = 0
    let totalPosibles = 0
    let completos = 0
    let sinAcceso = 0
    let parciales = 0

    for (const modulo of Object.keys(ACCIONES_POR_MODULO) as Modulo[]) {
      const posibles = ACCIONES_POR_MODULO[modulo].length
      const activas = (permisos[modulo] || []).length
      totalPosibles += posibles
      totalActivas += activas
      if (activas === posibles) completos++
      else if (activas === 0) sinAcceso++
      else parciales++
    }

    const porcentaje = totalPosibles > 0 ? Math.round((totalActivas / totalPosibles) * 100) : 0
    return { porcentaje, completos, sinAcceso, parciales }
  }, [permisos])

  // Toggle individual
  const toggleAccion = useCallback((modulo: Modulo, accion: Accion) => {
    setPermisos((prev) => {
      const nuevo = { ...prev }
      const actuales = [...(nuevo[modulo] || [])]
      const idx = actuales.indexOf(accion)
      if (idx >= 0) actuales.splice(idx, 1)
      else actuales.push(accion)
      nuevo[modulo] = actuales
      return nuevo
    })
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  // Todo/Nada por modulo
  const todoModulo = useCallback((modulo: Modulo) => {
    setPermisos((prev) => ({ ...prev, [modulo]: [...ACCIONES_POR_MODULO[modulo]] }))
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  const nadaModulo = useCallback((modulo: Modulo) => {
    setPermisos((prev) => ({ ...prev, [modulo]: [] }))
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  // Toggle columna: marcar/desmarcar una accion para todos los modulos dados
  const toggleColumna = useCallback((modulos: Modulo[], accion: Accion) => {
    setPermisos((prev) => {
      const nuevo = { ...prev }
      // Contar cuantos modulos tienen esta accion activa
      let activos = 0
      let posibles = 0
      for (const modulo of modulos) {
        if (ACCIONES_POR_MODULO[modulo].includes(accion)) {
          posibles++
          if ((nuevo[modulo] || []).includes(accion)) activos++
        }
      }
      // Si todos activos -> desmarcar todos. Si no -> marcar todos.
      const marcar = activos < posibles
      for (const modulo of modulos) {
        if (!ACCIONES_POR_MODULO[modulo].includes(accion)) continue
        const actuales = [...(nuevo[modulo] || [])]
        const idx = actuales.indexOf(accion)
        if (marcar && idx < 0) {
          actuales.push(accion)
        } else if (!marcar && idx >= 0) {
          actuales.splice(idx, 1)
        }
        nuevo[modulo] = actuales
      }
      return nuevo
    })
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  // Presets globales
  const aplicarPreset = useCallback((tipo: 'todo' | 'lectura' | 'nada') => {
    const nuevo: PermisosMapa = {}
    for (const modulo of Object.keys(ACCIONES_POR_MODULO) as Modulo[]) {
      if (tipo === 'todo') {
        nuevo[modulo] = [...ACCIONES_POR_MODULO[modulo]]
      } else if (tipo === 'lectura') {
        nuevo[modulo] = ACCIONES_POR_MODULO[modulo].filter(a => a.startsWith('ver'))
      } else {
        nuevo[modulo] = []
      }
    }
    setPermisos(nuevo)
    setUsaCustom(true)
  }, [])

  // Presets por categoria
  const aplicarPresetCategoria = useCallback((categoriaKey: string, tipo: 'todo' | 'lectura' | 'nada') => {
    const categoria = CATEGORIAS_MODULOS[categoriaKey]
    if (!categoria) return
    setPermisos((prev) => {
      const nuevo = { ...prev }
      for (const modulo of categoria.modulos) {
        if (tipo === 'todo') {
          nuevo[modulo] = [...ACCIONES_POR_MODULO[modulo]]
        } else if (tipo === 'lectura') {
          nuevo[modulo] = ACCIONES_POR_MODULO[modulo].filter(a => a.startsWith('ver'))
        } else {
          nuevo[modulo] = []
        }
      }
      return nuevo
    })
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  // Restablecer a defaults del rol
  const restablecer = useCallback(async () => {
    setGuardando(true)
    try {
      await onGuardar(null)
      setPermisos(structuredClone(PERMISOS_POR_ROL[rol] || {}))
      setUsaCustom(false)
    } finally {
      setGuardando(false)
    }
  }, [onGuardar, rol])

  // Guardar permisos custom
  const guardar = useCallback(async () => {
    setGuardando(true)
    try {
      await onGuardar(permisos)
    } finally {
      setGuardando(false)
    }
  }, [onGuardar, permisos])

  return {
    permisos,
    usaCustom,
    guardando,
    estadisticas,
    toggleAccion,
    todoModulo,
    nadaModulo,
    toggleColumna,
    aplicarPreset,
    aplicarPresetCategoria,
    restablecer,
    guardar,
  }
}

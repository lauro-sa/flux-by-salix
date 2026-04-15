'use client'

/**
 * useNotasRapidas — Hook para gestionar notas rápidas personales y compartidas.
 * Maneja: CRUD, compartir, marcar como leído, polling para cambios.
 *
 * Se usa en: PanelNotas (botón flotante de notas rápidas).
 */

import { useState, useCallback, useEffect, useRef } from 'react'

// ─── Tipos ───

export interface NotaRapida {
  id: string
  empresa_id: string
  creador_id: string
  titulo: string
  contenido: string
  color: string
  fijada: boolean
  archivada: boolean
  creado_en: string
  actualizado_en: string
  actualizado_por: string | null
  // Extras del API
  _compartida?: boolean
  _puede_editar?: boolean
  _leido_en?: string | null
  _compartida_id?: string
  _tiene_cambios?: boolean
  _compartidos_con?: Array<{ usuario_id: string; puede_editar: boolean }>
}

interface EstadoNotas {
  propias: NotaRapida[]
  compartidas: NotaRapida[]
  cargando: boolean
  tiene_cambios_sin_leer: boolean
  error: string | null
}

export function useNotasRapidas() {
  const [estado, setEstado] = useState<EstadoNotas>({
    propias: [],
    compartidas: [],
    cargando: true,
    tiene_cambios_sin_leer: false,
    error: null,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cargar notas
  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/notas-rapidas')
      if (!res.ok) throw new Error('Error al cargar notas')
      const data = await res.json()
      setEstado({
        propias: data.propias ?? [],
        compartidas: data.compartidas ?? [],
        cargando: false,
        tiene_cambios_sin_leer: data.tiene_cambios_sin_leer ?? false,
        error: null,
      })
    } catch {
      setEstado((prev) => ({ ...prev, cargando: false, error: 'Error al cargar' }))
    }
  }, [])

  // Cargar al montar + polling cada 30s para detectar cambios en compartidas
  useEffect(() => {
    cargar()
    intervalRef.current = setInterval(cargar, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [cargar])

  // Crear nota
  const crear = useCallback(async (datos: {
    titulo?: string
    contenido?: string
    color?: string
    compartir_con?: string[]
  }) => {
    try {
      const res = await fetch('/api/notas-rapidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      if (!res.ok) throw new Error('Error al crear')
      const nota = await res.json()
      await cargar()
      return nota as NotaRapida
    } catch {
      return null
    }
  }, [cargar])

  // Actualizar nota
  const actualizar = useCallback(async (id: string, datos: Partial<NotaRapida>) => {
    try {
      const res = await fetch(`/api/notas-rapidas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      const nota = await res.json()

      // Actualizar localmente sin esperar refetch completo
      setEstado((prev) => ({
        ...prev,
        propias: prev.propias.map((n) => n.id === id ? { ...n, ...nota } : n),
        compartidas: prev.compartidas.map((n) => n.id === id ? { ...n, ...nota } : n),
      }))

      return nota as NotaRapida
    } catch {
      return null
    }
  }, [])

  // Eliminar nota (archivar — soft delete, se puede restaurar)
  const eliminar = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notas-rapidas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivada: true }),
      })
      if (!res.ok) throw new Error('Error al eliminar')
      setEstado((prev) => ({
        ...prev,
        propias: prev.propias.filter((n) => n.id !== id),
        compartidas: prev.compartidas.filter((n) => n.id !== id),
      }))
      return true
    } catch {
      return false
    }
  }, [])

  // Compartir nota
  const compartir = useCallback(async (nota_id: string, usuario_id: string, puede_editar = true) => {
    try {
      const res = await fetch(`/api/notas-rapidas/${nota_id}/compartir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id, puede_editar }),
      })
      if (!res.ok) throw new Error('Error al compartir')
      await cargar()
      return true
    } catch {
      return false
    }
  }, [cargar])

  // Dejar de compartir
  const dejarDeCompartir = useCallback(async (nota_id: string, usuario_id: string) => {
    try {
      const res = await fetch(`/api/notas-rapidas/${nota_id}/compartir`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id }),
      })
      if (!res.ok) throw new Error('Error')
      await cargar()
      return true
    } catch {
      return false
    }
  }, [cargar])

  // Marcar como leída (nota compartida)
  const marcarLeida = useCallback(async (nota_id: string) => {
    try {
      await fetch(`/api/notas-rapidas/${nota_id}/leer`, { method: 'POST' })
      setEstado((prev) => ({
        ...prev,
        compartidas: prev.compartidas.map((n) =>
          n.id === nota_id ? { ...n, _tiene_cambios: false, _leido_en: new Date().toISOString() } : n
        ),
        tiene_cambios_sin_leer: prev.compartidas.filter((n) => n.id !== nota_id).some((n) => n._tiene_cambios),
      }))
    } catch {
      // Silenciar error de lectura
    }
  }, [])

  return {
    ...estado,
    cargar,
    crear,
    actualizar,
    eliminar,
    compartir,
    dejarDeCompartir,
    marcarLeida,
  }
}

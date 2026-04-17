'use client'

import { useEffect, useCallback } from 'react'

/**
 * useAtajosInbox — Atajos de teclado para el inbox de correo.
 *
 * Atajos disponibles (solo cuando no hay un input/textarea enfocado):
 * - R: Responder al correo seleccionado
 * - A: Archivar la conversación seleccionada
 * - E: Marcar como leído/no leído
 * - Delete/Backspace: Eliminar la conversación seleccionada
 * - S: Marcar como spam
 * - ↑/↓ (j/k): Navegar entre conversaciones
 * - Escape: Cerrar compositor / deseleccionar
 */

interface OpcionesAtajos {
  conversaciones: { id: string }[]
  conversacionSeleccionadaId: string | null
  onSeleccionar: (id: string) => void
  onResponder: () => void
  onArchivar: (id: string) => void
  onEliminar: (id: string) => void
  onToggleLeido: (id: string, sinLeer: number) => void
  onMarcarSpam: (id: string) => void
  onLimpiarSeleccion: () => void
  respondiendo: boolean
  mensajesSinLeer: number
  habilitado: boolean
}

export function useAtajosInbox({
  conversaciones,
  conversacionSeleccionadaId,
  onSeleccionar,
  onResponder,
  onArchivar,
  onEliminar,
  onToggleLeido,
  onMarcarSpam,
  onLimpiarSeleccion,
  respondiendo,
  mensajesSinLeer,
  habilitado,
}: OpcionesAtajos) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!habilitado) return

    // No interceptar si hay un input/textarea/editor enfocado
    const target = e.target as HTMLElement
    const esInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
      target.isContentEditable || target.closest('[contenteditable]')
    if (esInput) return

    // No interceptar si hay modificadores (Ctrl, Cmd, Alt)
    if (e.ctrlKey || e.metaKey || e.altKey) return

    const key = e.key.toLowerCase()

    // Escape: cerrar compositor o deseleccionar
    if (e.key === 'Escape') {
      e.preventDefault()
      onLimpiarSeleccion()
      return
    }

    // Sin conversación seleccionada: solo navegación
    if (!conversacionSeleccionadaId) {
      if ((key === 'j' || key === 'arrowdown') && conversaciones.length > 0) {
        e.preventDefault()
        onSeleccionar(conversaciones[0].id)
      }
      return
    }

    // Navegación con j/k o flechas
    if (key === 'j' || key === 'arrowdown') {
      e.preventDefault()
      const idx = conversaciones.findIndex(c => c.id === conversacionSeleccionadaId)
      if (idx < conversaciones.length - 1) {
        onSeleccionar(conversaciones[idx + 1].id)
      }
      return
    }
    if (key === 'k' || key === 'arrowup') {
      e.preventDefault()
      const idx = conversaciones.findIndex(c => c.id === conversacionSeleccionadaId)
      if (idx > 0) {
        onSeleccionar(conversaciones[idx - 1].id)
      }
      return
    }

    // No ejecutar acciones si estamos respondiendo
    if (respondiendo) return

    // R: Responder
    if (key === 'r') {
      e.preventDefault()
      onResponder()
      return
    }

    // A: Archivar
    if (key === 'a') {
      e.preventDefault()
      onArchivar(conversacionSeleccionadaId)
      return
    }

    // E: Marcar como leído/no leído
    if (key === 'e') {
      e.preventDefault()
      onToggleLeido(conversacionSeleccionadaId, mensajesSinLeer)
      return
    }

    // S: Spam
    if (key === 's') {
      e.preventDefault()
      onMarcarSpam(conversacionSeleccionadaId)
      return
    }

    // Delete/Backspace: Eliminar
    if (key === 'delete' || key === 'backspace') {
      e.preventDefault()
      onEliminar(conversacionSeleccionadaId)
      return
    }
  }, [
    habilitado, conversaciones, conversacionSeleccionadaId,
    onSeleccionar, onResponder, onArchivar, onEliminar,
    onToggleLeido, onMarcarSpam, onLimpiarSeleccion,
    respondiendo, mensajesSinLeer,
  ])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

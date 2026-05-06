'use client'

import { useEffect } from 'react'

/**
 * Atajos de teclado del editor de flujos (sub-PR 19.2).
 *
 * Cobertura acordada con el coordinador (D10):
 *   • `Esc`         → si hay panel lateral abierto, lo cierra. Si no,
 *                      navega de vuelta al listado.
 *   • `Cmd/Ctrl+S`  → fuerza el flush del autoguardado pendiente.
 *
 * Atajos como `Cmd+Z`, `Cmd+D`, `Delete` quedan deferidos a iteración
 * posterior (plan §1.6.11) — undo requiere infraestructura considerable.
 *
 * En mobile (`pointer: coarse`) NO se monta el listener: ningún atajo
 * tiene sentido sin teclado físico, y dejarlo activo en tablets puede
 * disparar `preventDefault` de combinaciones del sistema operativo.
 */

interface OpcionesAtajos {
  /** True si el panel lateral del paso está abierto. */
  panelAbierto: boolean
  /** Llamada cuando se aprieta Esc con el panel abierto. */
  onCerrarPanel: () => void
  /** Llamada cuando se aprieta Esc sin panel (volver al listado). */
  onVolver: () => void
  /** Llamada cuando se aprieta Cmd/Ctrl+S (flush autoguardado). */
  onForzarGuardar: () => void
}

function esEntradaDeTexto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export function useAtajosEditorFlujo({
  panelAbierto,
  onCerrarPanel,
  onVolver,
  onForzarGuardar,
}: OpcionesAtajos) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Mobile / tablet sin teclado físico: no registramos listeners.
    if (window.matchMedia('(pointer: coarse)').matches) return

    function handler(e: KeyboardEvent) {
      // Cmd/Ctrl+S — flush autoguardado.
      const esGuardar = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's'
      if (esGuardar) {
        e.preventDefault()
        onForzarGuardar()
        return
      }

      // Esc — solo si NO está activo el foco en un input editable
      // (sino interfiere con cancelar selecciones del navegador en
      // formularios). Excepción: si el panel lateral está abierto,
      // aceptamos Esc incluso desde un input — es comportamiento
      // estándar Notion/Linear.
      if (e.key === 'Escape') {
        if (panelAbierto) {
          e.preventDefault()
          onCerrarPanel()
          return
        }
        if (esEntradaDeTexto(e.target)) return
        e.preventDefault()
        onVolver()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [panelAbierto, onCerrarPanel, onVolver, onForzarGuardar])
}

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
  /**
   * True si la consola de prueba está abierta (sub-PR 19.5). Cuando
   * está abierta y NO hay panel de paso, Esc cierra la consola en vez
   * de volver al listado.
   */
  consolaAbierta?: boolean
  /** Llamada cuando se aprieta Esc con el panel abierto. */
  onCerrarPanel: () => void
  /** Llamada cuando se aprieta Esc con la consola abierta y sin panel (sub-PR 19.5). */
  onCerrarConsola?: () => void
  /** Llamada cuando se aprieta Esc sin panel ni consola (volver al listado). */
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
  consolaAbierta = false,
  onCerrarPanel,
  onCerrarConsola,
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
        // Sub-PR 19.5: si la consola está abierta y no hay panel, Esc
        // la cierra. Solo si no hay foco en input — coherente con la
        // regla del Esc para "volver" (abajo). Excepción intencional:
        // queremos que el botón "Cerrar consola" del header sea la vía
        // primaria, no robarle Esc al input que el usuario está editando.
        if (consolaAbierta && onCerrarConsola && !esEntradaDeTexto(e.target)) {
          e.preventDefault()
          onCerrarConsola()
          return
        }
        if (esEntradaDeTexto(e.target)) return
        e.preventDefault()
        onVolver()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [panelAbierto, consolaAbierta, onCerrarPanel, onCerrarConsola, onVolver, onForzarGuardar])
}

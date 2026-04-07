/**
 * Hook para capturar lectura de lector RFID USB (HID emulado).
 * El lector simula un teclado: envía el código como keystrokes rápidos + Enter.
 * Distingue de escritura humana por intervalo <50ms entre teclas.
 */
'use client'

import { useEffect, useRef, useCallback } from 'react'

interface OpcionesRFID {
  /** Callback al leer un código RFID válido */
  alLeer: (codigo: string) => void
  /** Si el hook está activo (desactivar durante otras pantallas) */
  activo?: boolean
  /** Intervalo máximo entre teclas para considerar lectura RFID (ms) */
  intervaloMaxMs?: number
  /** Largo mínimo del código para ser válido */
  largoMinimo?: number
}

export function useEscuchaRFID({
  alLeer,
  activo = true,
  intervaloMaxMs = 50,
  largoMinimo = 4,
}: OpcionesRFID) {
  const buffer = useRef('')
  const ultimaTecla = useRef(0)
  const timerLimpieza = useRef<ReturnType<typeof setTimeout>>(undefined)

  const limpiarBuffer = useCallback(() => {
    buffer.current = ''
  }, [])

  useEffect(() => {
    if (!activo) return

    const manejarTecla = (e: KeyboardEvent) => {
      const ahora = Date.now()
      const intervalo = ahora - ultimaTecla.current

      // Si pasó mucho tiempo desde la última tecla, es escritura humana — resetear
      if (intervalo > intervaloMaxMs && buffer.current.length > 0) {
        buffer.current = ''
      }

      ultimaTecla.current = ahora

      if (e.key === 'Enter') {
        // Enter = fin de lectura RFID
        if (buffer.current.length >= largoMinimo) {
          e.preventDefault()
          e.stopPropagation()
          alLeer(buffer.current)
        }
        buffer.current = ''
        return
      }

      // Solo caracteres alfanuméricos
      if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
        buffer.current += e.key
        e.preventDefault()
        e.stopPropagation()

        // Limpiar buffer si no se completa en 500ms
        clearTimeout(timerLimpieza.current)
        timerLimpieza.current = setTimeout(limpiarBuffer, 500)
      }
    }

    // Capturar en fase de captura para interceptar antes que otros handlers
    document.addEventListener('keydown', manejarTecla, { capture: true })

    return () => {
      document.removeEventListener('keydown', manejarTecla, { capture: true })
      clearTimeout(timerLimpieza.current)
    }
  }, [activo, alLeer, intervaloMaxMs, largoMinimo, limpiarBuffer])
}

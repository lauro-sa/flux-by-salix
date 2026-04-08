/**
 * Hook para capturar códigos RFID emitidos por lectores USB (modo HID / emulación de teclado).
 *
 * Los lectores RFID USB envían el código como una ráfaga de pulsaciones de teclado (<50ms
 * entre cada una) seguida de Enter. Este hook distingue esa ráfaga de la escritura humana
 * normal comparando el intervalo entre teclas.
 *
 * Basado en el hook del kiosco anterior (salixweb-0226) que funcionaba en producción.
 */
'use client'

import { useEffect, useRef, useCallback } from 'react'

const INTERVALO_MAX_HID_MS = 50      // teclas con < 50ms → lector HID
const TIMEOUT_RESET_BUFFER_MS = 500  // limpiar buffer si pasan > 500ms sin input
const LONGITUD_MIN_CODIGO = 4        // mínimo de caracteres para código válido

interface OpcionesRFID {
  /** Callback al leer un código RFID válido */
  alLeer: (codigo: string) => void
  /** Si el hook está activo */
  activo?: boolean
}

export function useEscuchaRFID({ alLeer, activo = true }: OpcionesRFID) {
  const bufferRef = useRef('')
  const ultimaTeclaRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const limpiarBuffer = useCallback(() => {
    bufferRef.current = ''
    ultimaTeclaRef.current = 0
  }, [])

  useEffect(() => {
    if (!activo) return

    function handleKeydown(e: KeyboardEvent) {
      // Si hay un input/textarea/select enfocado → el usuario está escribiendo, ignorar
      const tag = document.activeElement?.tagName?.toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const ahora = Date.now()
      const intervalo = ahora - ultimaTeclaRef.current
      ultimaTeclaRef.current = ahora

      // Resetear el timer de limpieza con cada tecla
      if (timerRef.current) clearTimeout(timerRef.current)

      if (e.key === 'Enter') {
        const codigo = bufferRef.current.trim()
        if (codigo.length >= LONGITUD_MIN_CODIGO) {
          alLeer(codigo)
        }
        limpiarBuffer()
        return
      }

      // Solo acumular caracteres imprimibles (longitud 1)
      if (e.key.length !== 1) return

      // Si el buffer no estaba vacío y el intervalo es largo → humano escribiendo → reset
      if (bufferRef.current.length > 0 && intervalo > INTERVALO_MAX_HID_MS * 3) {
        limpiarBuffer()
      }

      bufferRef.current += e.key

      // Auto-reset si no llega Enter
      timerRef.current = setTimeout(limpiarBuffer, TIMEOUT_RESET_BUFFER_MS)
    }

    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activo, alLeer, limpiarBuffer])
}

/**
 * Hook para leer tarjetas NFC usando Web NFC API.
 * Solo disponible en Chrome Android con HTTPS.
 * Fallback silencioso si no está soportado.
 */
'use client'

import { useEffect, useRef } from 'react'

interface OpcionesNFC {
  /** Callback al leer un tag NFC */
  alLeer: (codigo: string) => void
  /** Si el hook está activo */
  activo?: boolean
}

export function useEscuchaNFC({
  alLeer,
  activo = true,
}: OpcionesNFC) {
  const readerRef = useRef<NDEFReader | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!activo) return

    // Web NFC API no disponible en todos los navegadores
    if (!('NDEFReader' in window)) {
      console.info('Kiosco: Web NFC API no disponible en este navegador')
      return
    }

    let montado = true

    async function iniciar() {
      try {
        const reader = new NDEFReader()
        const controller = new AbortController()

        readerRef.current = reader
        abortRef.current = controller

        await reader.scan({ signal: controller.signal })

        reader.addEventListener('reading', ((evento: Event) => {
          if (!montado) return
          const { serialNumber } = evento as NDEFReadingEvent
          if (serialNumber) {
            // Normalizar: quitar separadores y convertir a mayúsculas
            const codigo = serialNumber.replace(/[:-]/g, '').toUpperCase()
            alLeer(codigo)
          }
        }) as EventListener)

        reader.addEventListener('readingerror', () => {
          console.warn('Kiosco: error al leer tag NFC')
        })
      } catch (error) {
        console.warn('Kiosco: no se pudo iniciar NFC', error)
      }
    }

    iniciar()

    return () => {
      montado = false
      abortRef.current?.abort()
      readerRef.current = null
    }
  }, [activo, alLeer])
}

// Tipos de Web NFC API (no incluidos en lib.dom.d.ts estándar)
declare global {
  interface NDEFReader extends EventTarget {
    scan(options?: { signal?: AbortSignal }): Promise<void>
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
  class NDEFReader {
    constructor()
    scan(options?: { signal?: AbortSignal }): Promise<void>
    addEventListener(type: string, listener: EventListener): void
    removeEventListener(type: string, listener: EventListener): void
  }
  interface NDEFReadingEvent extends Event {
    serialNumber: string
    message: {
      records: Array<{
        recordType: string
        data: ArrayBuffer
      }>
    }
  }
}

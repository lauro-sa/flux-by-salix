'use client'

import { useEffect, useRef, useState } from 'react'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'

/**
 * Hook que carga el contexto-preview del flujo para el `PickerVariables`
 * (sub-PR 19.3b).
 *
 * Reglas de fetch (caveat del coordinador):
 *   • Carga UNA vez al montar el editor.
 *   • Re-fetch cuando cambia `tipoDisparador` (no en cada keystroke de
 *     la config interna del disparador). El componente que consume el
 *     hook solo le pasa `tipoDisparador`, no la configuración entera.
 *   • Cache durante toda la sesión: cerrar/abrir el panel del paso
 *     NO re-fetcha — el contexto vive a nivel del editor entero.
 *   • Si el endpoint devuelve 404 / 403 / 5xx, devolvemos un contexto
 *     vacío `{}` para que el picker pinte el árbol pero los previews
 *     queden vacíos. NO bloqueamos la UI con un error fatal.
 *
 * El abort controller cancela la fetch en vuelo si el componente se
 * desmonta o si cambia `tipoDisparador` antes de que termine.
 */

interface PropsUsePreviewContexto {
  flujoId: string
  /**
   * El tipo del disparador editable. Cuando cambia, re-fetch. Si es
   * null/undefined, no fetcheamos — el contexto queda vacío.
   */
  tipoDisparador: string | null | undefined
}

export function usePreviewContexto({ flujoId, tipoDisparador }: PropsUsePreviewContexto): {
  contexto: ContextoVariables
  cargando: boolean
} {
  const [contexto, setContexto] = useState<ContextoVariables>({})
  const [cargando, setCargando] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!tipoDisparador) {
      setContexto({})
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setCargando(true)

    fetch(`/api/flujos/${flujoId}/preview-contexto`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) return { contexto: {} as ContextoVariables }
        return (await res.json()) as { contexto: ContextoVariables }
      })
      .then((data) => {
        if (ctrl.signal.aborted) return
        setContexto(data.contexto ?? {})
      })
      .catch(() => {
        // Cualquier error de red → contexto vacío. El picker funciona
        // igual, solo sin previews.
        if (ctrl.signal.aborted) return
        setContexto({})
      })
      .finally(() => {
        if (ctrl.signal.aborted) return
        setCargando(false)
      })

    return () => {
      ctrl.abort()
    }
  }, [flujoId, tipoDisparador])

  return { contexto, cargando }
}

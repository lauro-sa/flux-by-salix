'use client'

import { useCallback, useState } from 'react'
import type { RespuestaDryRun } from '../tipos'

/**
 * Hook que dispara el dry-run contra `POST /api/flujos/[id]/probar`
 * (sub-PR 19.5). Maneja estados: idle, cargando, ok, error.
 *
 * Decisión D7 (snapshot): el body se arma en el `correr` y se envía como
 * está. Si el usuario edita mientras corre, la edición no afecta esta
 * corrida — al terminar, "Volver a ejecutar" toma el estado actualizado.
 *
 * Decisión D8 (flush): el `correr` recibe `flushPendiente` (lo proveerá
 * el `EditorFlujo`). Llamamos antes del fetch para garantizar que el
 * backend lea el borrador con el último cambio del usuario.
 *
 * Errores 422 (validación) se mapean a `error` con un texto legible — el
 * caller decide si mostrar un toast o cambiar al banner rojo del editor.
 */

export type EstadoDryRun =
  | { tipo: 'idle' }
  | { tipo: 'cargando' }
  | { tipo: 'ok'; respuesta: RespuestaDryRun }
  | { tipo: 'error'; mensaje: string; codigo?: 'validacion' | 'red' | 'desconocido' }

export interface UseDryRunOpts {
  flujoId: string
  flushPendiente?: () => Promise<void> | void
}

export function useDryRun({ flujoId, flushPendiente }: UseDryRunOpts) {
  const [estado, setEstado] = useState<EstadoDryRun>({ tipo: 'idle' })

  const correr = useCallback(async () => {
    setEstado({ tipo: 'cargando' })
    try {
      // Decisión D8: antes de pegarle al endpoint, asegurar que el
      // autoguardado terminó. Si flush no está, asumimos que el caller
      // ya garantizó persistencia.
      if (flushPendiente) {
        await flushPendiente()
      }

      const res = await fetch(`/api/flujos/${flujoId}/probar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true }),
      })

      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as {
          error?: string
          errores?: string[]
        }
        if (res.status === 422) {
          const detalle = Array.isArray(cuerpo.errores)
            ? cuerpo.errores.join(' · ')
            : cuerpo.error
          setEstado({
            tipo: 'error',
            mensaje: detalle ?? 'Validación falló',
            codigo: 'validacion',
          })
          return
        }
        setEstado({
          tipo: 'error',
          mensaje: cuerpo.error ?? `HTTP ${res.status}`,
          codigo: 'desconocido',
        })
        return
      }

      const respuesta = (await res.json()) as RespuestaDryRun
      setEstado({ tipo: 'ok', respuesta })
    } catch (err) {
      setEstado({
        tipo: 'error',
        mensaje: err instanceof Error ? err.message : 'Error de red',
        codigo: 'red',
      })
    }
  }, [flujoId, flushPendiente])

  const limpiar = useCallback(() => setEstado({ tipo: 'idle' }), [])

  return { estado, correr, limpiar }
}

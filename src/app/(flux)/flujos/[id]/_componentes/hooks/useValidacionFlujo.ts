'use client'

import { useMemo } from 'react'
import {
  validarFlujoConPasos,
  type ErrorValidacion,
  type ResultadoValidacionConPasos,
} from '@/lib/workflows/validacion-flujo'
import type { AccionConId } from '@/lib/workflows/ids-pasos'

/**
 * Hook puro que deriva el estado de validación del flujo en edición
 * (sub-PR 19.4). Es solo `useMemo` sobre `validarFlujoConPasos` más
 * un par de derivados que el editor consume frecuentemente:
 *
 *   - `erroresPorPaso`: Map<pasoId, ErrorValidacion[]> para que cada
 *     `TarjetaPaso`/`TarjetaCondicionBranch` pueda decidir si pintar
 *     marker rojo sin re-iterar el array.
 *   - `errorDisparador`: primer error del disparador (si hay), para
 *     `TarjetaDisparador`. Solo guardamos el primero porque el marker
 *     visual es binario (tiene/no tiene).
 *   - `primerError`: la ruta del primer error de la lista, usado por
 *     "Ver errores" del banner para decidir a dónde scrollear.
 *
 * El cálculo es síncrono y barato (chequeo de shape, sin BD ni red),
 * así que `useMemo` con dep en `disparador` + `pasosConId` alcanza.
 * Si en el futuro agregamos validaciones costosas (variables, plantillas)
 * habría que migrar a `useDeferredValue` o un worker — no aplica hoy.
 */

export interface UseValidacionFlujoReturn {
  resultado: ResultadoValidacionConPasos
  erroresPorPaso: Map<string, ErrorValidacion[]>
  errorDisparador: ErrorValidacion | null
  primerError: ErrorValidacion | null
}

export function useValidacionFlujo({
  disparador,
  pasosConId,
}: {
  disparador: unknown
  pasosConId: AccionConId[]
}): UseValidacionFlujoReturn {
  return useMemo(() => {
    const resultado = validarFlujoConPasos(disparador, pasosConId)

    const erroresPorPaso = new Map<string, ErrorValidacion[]>()
    let errorDisparador: ErrorValidacion | null = null

    for (const err of resultado.errores) {
      if (err.ruta.tipo === 'disparador') {
        if (!errorDisparador) errorDisparador = err
      } else {
        const arr = erroresPorPaso.get(err.ruta.pasoId) ?? []
        arr.push(err)
        erroresPorPaso.set(err.ruta.pasoId, arr)
      }
    }

    return {
      resultado,
      erroresPorPaso,
      errorDisparador,
      primerError: resultado.errores[0] ?? null,
    }
  }, [disparador, pasosConId])
}

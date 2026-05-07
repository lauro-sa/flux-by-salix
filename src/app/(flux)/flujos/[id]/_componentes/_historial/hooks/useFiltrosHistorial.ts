'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'
import type { EstadoEjecucion } from '@/tipos/workflow'
import type { TipoDisparadoPor } from '../formato-ejecucion'

/**
 * useFiltrosHistorial — state local efímero de filtros para el listado
 * de ejecuciones (sub-PR 19.6).
 *
 * Por qué NO usa `useFiltrosUrl`:
 *
 *   `useFiltrosUrl` reescribe TODOS los query params al sincronizar
 *   con URL, lo que pisaría `?vista=historial` y `?ejecucion=<id>`.
 *   Modificar ese hook impacta 8+ listados existentes — fuera de scope.
 *
 *   Decisión coordinador (commit 2 del macro 19.6): los filtros del
 *   historial son efímeros, no se comparten por link. Si emerge dolor
 *   real, migrar al hook reusable se hace en un PR aislado posterior
 *   con tests sobre todos los consumidores.
 *
 * El hook expone busqueda con debounce (mismo timeout estándar de Flux)
 * y resetea automáticamente la página a 1 cuando cualquier filtro
 * cambia — patrón consistente con `useFiltrosUrl`.
 */

export interface ValoresFiltrosHistorial {
  busquedaActiva: string
  estados: EstadoEjecucion[]
  disparadoPorTipos: TipoDisparadoPor[]
  creadoRango: string
  errorRawClass: string[]
}

export interface FiltrosHistorial {
  // Inputs (no debounceados)
  busquedaInput: string
  setBusquedaInput: (v: string) => void
  estados: EstadoEjecucion[]
  setEstados: (v: EstadoEjecucion[]) => void
  disparadoPorTipos: TipoDisparadoPor[]
  setDisparadoPorTipos: (v: TipoDisparadoPor[]) => void
  creadoRango: string
  setCreadoRango: (v: string) => void
  errorRawClass: string[]
  setErrorRawClass: (v: string[]) => void

  // Derivados
  /** Valor de búsqueda con debounce — usar para queries / API. */
  busquedaActiva: string
  pagina: number
  setPagina: (n: number) => void
  /** True si todo está en default (ningún filtro aplicado). */
  estaEnDefecto: boolean
  /** Reinicia todos los filtros a sus defaults (no toca paginación
   *  manualmente — el efecto interno la lleva a 1 al detectar el cambio). */
  limpiar: () => void
}

const DEFAULTS = {
  busqueda: '',
  estados: [] as EstadoEjecucion[],
  disparadoPorTipos: [] as TipoDisparadoPor[],
  creadoRango: '',
  errorRawClass: [] as string[],
}

export function useFiltrosHistorial(): FiltrosHistorial {
  const [busquedaInput, setBusquedaInput] = useState(DEFAULTS.busqueda)
  const [busquedaActiva, setBusquedaActiva] = useState(DEFAULTS.busqueda)
  const [estados, setEstados] = useState<EstadoEjecucion[]>(DEFAULTS.estados)
  const [disparadoPorTipos, setDisparadoPorTipos] = useState<TipoDisparadoPor[]>(
    DEFAULTS.disparadoPorTipos,
  )
  const [creadoRango, setCreadoRango] = useState(DEFAULTS.creadoRango)
  const [errorRawClass, setErrorRawClass] = useState<string[]>(DEFAULTS.errorRawClass)
  const [pagina, setPagina] = useState(1)

  // Debounce: aplica el input a busquedaActiva tras DEBOUNCE_BUSQUEDA ms.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaActiva(busquedaInput), DEBOUNCE_BUSQUEDA)
    return () => clearTimeout(t)
  }, [busquedaInput])

  // Reset de página cuando cambian filtros o búsqueda activa.
  // Mismo patrón que useFiltrosUrl — paginación 1 cada vez que el
  // dataset filtrado cambia, sino el "estoy en página 5" pierde sentido.
  useEffect(() => {
    setPagina(1)
  }, [busquedaActiva, estados, disparadoPorTipos, creadoRango, errorRawClass])

  const estaEnDefecto =
    busquedaActiva === DEFAULTS.busqueda &&
    estados.length === 0 &&
    disparadoPorTipos.length === 0 &&
    creadoRango === DEFAULTS.creadoRango &&
    errorRawClass.length === 0

  const limpiar = useCallback(() => {
    setBusquedaInput(DEFAULTS.busqueda)
    setBusquedaActiva(DEFAULTS.busqueda)
    setEstados(DEFAULTS.estados)
    setDisparadoPorTipos(DEFAULTS.disparadoPorTipos)
    setCreadoRango(DEFAULTS.creadoRango)
    setErrorRawClass(DEFAULTS.errorRawClass)
  }, [])

  return useMemo(
    () => ({
      busquedaInput,
      setBusquedaInput,
      busquedaActiva,
      estados,
      setEstados,
      disparadoPorTipos,
      setDisparadoPorTipos,
      creadoRango,
      setCreadoRango,
      errorRawClass,
      setErrorRawClass,
      pagina,
      setPagina,
      estaEnDefecto,
      limpiar,
    }),
    [
      busquedaInput,
      busquedaActiva,
      estados,
      disparadoPorTipos,
      creadoRango,
      errorRawClass,
      pagina,
      estaEnDefecto,
      limpiar,
    ],
  )
}

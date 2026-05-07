'use client'

import { useListado } from '@/hooks/useListado'
import type { EjecucionFlujo, EstadoEjecucion } from '@/tipos/workflow'
import type { TipoDisparadoPor } from '../formato-ejecucion'

/**
 * useListadoEjecuciones — wrapper sobre `useListado` para el endpoint
 * GET /api/ejecuciones (PR 18.3).
 *
 * Filtra siempre por `flujo_id` (la pestaña Historial vive dentro del
 * editor de un flujo concreto). Los demás filtros vienen del state
 * local (`useFiltrosHistorial`); cuando un filtro está vacío se omite
 * del query string para no sobrecargar el endpoint.
 *
 * El response del endpoint añade `flujo_nombre` y `flujo_estado`
 * denormalizados, que acá no necesitamos (ya conocemos el flujo) pero
 * los preservamos en el tipo de fila por si ChatterFlujosDisparados
 * reusa este hook con `flujoId` distinto en otra ubicación.
 */

export interface FilaEjecucion extends EjecucionFlujo {
  flujo_nombre: string | null
  flujo_estado: string | null
}

const POR_PAGINA_DEFAULT = 50

export function useListadoEjecuciones(opciones: {
  flujoId: string
  busqueda?: string
  estados?: EstadoEjecucion[]
  disparadoPorTipos?: TipoDisparadoPor[]
  creadoRango?: string
  errorRawClass?: string[]
  pagina: number
  porPagina?: number
  habilitado?: boolean
}) {
  const {
    flujoId,
    estados = [],
    disparadoPorTipos = [],
    creadoRango = '',
    errorRawClass = [],
    pagina,
    porPagina = POR_PAGINA_DEFAULT,
    habilitado = true,
  } = opciones

  // Nota: el endpoint no soporta búsqueda libre por texto en 18.3.
  // El parámetro `busqueda` queda reservado para cuando se agregue
  // (ej: matchear por contexto_inicial.entidad.titulo). Por ahora
  // lo ignoramos en la query — el input sigue visible en el toolbar
  // pero no filtra hasta que el backend lo soporte. Mejora futura.

  return useListado<FilaEjecucion>({
    clave: `ejecuciones-${flujoId}`,
    url: '/api/ejecuciones',
    parametros: {
      flujo_id: flujoId,
      estado: estados.length ? estados.join(',') : undefined,
      disparado_por_tipo: disparadoPorTipos.length
        ? disparadoPorTipos.join(',')
        : undefined,
      creado_rango: creadoRango || undefined,
      error_raw_class: errorRawClass.length ? errorRawClass.join(',') : undefined,
      pagina,
      por_pagina: porPagina,
    },
    extraerDatos: (json) => (json.ejecuciones || []) as FilaEjecucion[],
    extraerTotal: (json) => (json.total || 0) as number,
    habilitado,
  })
}

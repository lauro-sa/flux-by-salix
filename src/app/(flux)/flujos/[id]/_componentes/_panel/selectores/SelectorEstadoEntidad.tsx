'use client'

import { useMemo } from 'react'
import { useTraduccion } from '@/lib/i18n'
import SelectorPopoverBase, { type OpcionSelector } from './SelectorPopoverBase'
import { useAutocompleteRemoto } from './useAutocompleteRemoto'
import type { EntidadConEstado } from '@/tipos/estados'

/**
 * Selector autocomplete de estados configurables por entidad
 * (sub-PR 19.3c).
 *
 * Usa GET /api/estados?entidad_tipo=<tipo>. Cada `entidadTipo` distinto
 * genera una entrada separada en el cache (la URL incluye el query
 * param, que es la clave del cache).
 */

interface EstadoRaw {
  clave: string
  etiqueta: string
  color?: string | null
  grupo?: string | null
}

interface Props {
  /** Entidad cuya tabla de estados consultamos. Si es null, no fetcheamos. */
  entidadTipo: EntidadConEstado | null
  /** Valor actual = `clave` del estado. */
  valor: string | null
  onChange: (clave: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function SelectorEstadoEntidad({
  entidadTipo,
  valor,
  onChange,
  disabled,
  placeholder,
}: Props) {
  const { t } = useTraduccion()
  const url = entidadTipo ? `/api/estados?entidad_tipo=${entidadTipo}` : null
  const { opciones, cargando, error } = useAutocompleteRemoto<EstadoRaw>({
    url,
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { estados?: unknown }).estados)
        ? ((raw as { estados: EstadoRaw[] }).estados)
        : [],
  })

  const lista: OpcionSelector[] = useMemo(
    () =>
      opciones.map((e) => ({
        id: e.clave,
        etiqueta: e.etiqueta,
        busqueda: `${e.clave} ${e.grupo ?? ''}`,
      })),
    [opciones],
  )

  const seleccionada = lista.find((o) => o.id === valor) ?? null

  return (
    <SelectorPopoverBase
      placeholder={placeholder ?? t('flujos.selector.estado.placeholder')}
      seleccionada={seleccionada}
      opciones={lista}
      cargando={cargando}
      error={error}
      onSeleccionar={(o) => onChange(o.id)}
      disabled={disabled || !entidadTipo}
    />
  )
}

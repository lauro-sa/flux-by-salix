'use client'

import { useMemo } from 'react'
import { useTraduccion } from '@/lib/i18n'
import SelectorPopoverBase, { type OpcionSelector } from './SelectorPopoverBase'
import { useAutocompleteRemoto } from './useAutocompleteRemoto'

/**
 * Selector autocomplete de tipos de actividad (sub-PR 19.3c).
 *
 * Usa GET /api/actividades/config — respuesta: `{ tipos: [...], estados: [...] }`.
 * Solo nos interesa la lista de `tipos`.
 */

interface TipoActividadRaw {
  id: string
  nombre: string
  clave?: string
  descripcion?: string
}

interface Props {
  valor: string | null
  onChange: (tipoId: string) => void
  disabled?: boolean
}

export default function SelectorTipoActividad({ valor, onChange, disabled }: Props) {
  const { t } = useTraduccion()
  const { opciones, cargando, error } = useAutocompleteRemoto<TipoActividadRaw>({
    url: '/api/actividades/config',
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { tipos?: unknown }).tipos)
        ? ((raw as { tipos: TipoActividadRaw[] }).tipos)
        : [],
  })

  const lista: OpcionSelector[] = useMemo(
    () => opciones.map((tp) => ({ id: tp.id, etiqueta: tp.nombre, busqueda: `${tp.clave ?? ''} ${tp.descripcion ?? ''}` })),
    [opciones],
  )

  const seleccionada = lista.find((o) => o.id === valor) ?? null

  return (
    <SelectorPopoverBase
      placeholder={t('flujos.selector.tipo_actividad.placeholder')}
      seleccionada={seleccionada}
      opciones={lista}
      cargando={cargando}
      error={error}
      onSeleccionar={(o) => onChange(o.id)}
      disabled={disabled}
    />
  )
}

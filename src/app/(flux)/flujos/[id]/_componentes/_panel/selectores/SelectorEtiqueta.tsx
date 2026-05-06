'use client'

import { useMemo } from 'react'
import { useTraduccion } from '@/lib/i18n'
import SelectorPopoverBase, { type OpcionSelector } from './SelectorPopoverBase'
import { useAutocompleteRemoto } from './useAutocompleteRemoto'

/**
 * Selector autocomplete de etiquetas configurables (sub-PR 19.3d).
 *
 * Usa GET /api/inbox/etiquetas — respuesta: `{ etiquetas: [{ id, clave,
 * nombre, color?, ... }] }`.
 *
 * El motor (sub-PR 15.X+) lee la `clave` técnica para aplicar / quitar
 * la etiqueta sobre la entidad disparadora. Por eso `valor` es la
 * `clave`, no el `id` del registro.
 *
 * Cubre la restricción dura del coordinador para 19.3d: reemplaza el
 * Input de texto crudo en `PanelEtiqueta`.
 */

interface EtiquetaRaw {
  id: string
  clave: string
  nombre: string
  color?: string | null
}

interface Props {
  valor: string | null
  onChange: (clave: string) => void
  disabled?: boolean
}

export default function SelectorEtiqueta({ valor, onChange, disabled }: Props) {
  const { t } = useTraduccion()
  const { opciones, cargando, error } = useAutocompleteRemoto<EtiquetaRaw>({
    url: '/api/inbox/etiquetas',
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { etiquetas?: unknown }).etiquetas)
        ? ((raw as { etiquetas: EtiquetaRaw[] }).etiquetas)
        : [],
  })

  const lista: OpcionSelector[] = useMemo(
    () => opciones.map((e) => ({ id: e.clave, etiqueta: e.nombre, busqueda: e.clave })),
    [opciones],
  )

  const seleccionada = lista.find((o) => o.id === valor) ?? null

  return (
    <SelectorPopoverBase
      placeholder={t('flujos.selector.etiqueta.placeholder')}
      seleccionada={seleccionada}
      opciones={lista}
      cargando={cargando}
      error={error}
      onSeleccionar={(o) => onChange(o.id)}
      disabled={disabled}
    />
  )
}

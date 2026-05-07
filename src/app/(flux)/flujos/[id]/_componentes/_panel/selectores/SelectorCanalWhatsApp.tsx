'use client'

import { useMemo } from 'react'
import { useTraduccion } from '@/lib/i18n'
import SelectorPopoverBase, { type OpcionSelector } from './SelectorPopoverBase'
import { useAutocompleteRemoto } from './useAutocompleteRemoto'

/**
 * Selector autocomplete de canales de WhatsApp (sub-PR 19.3c).
 * Usa GET /api/whatsapp/canales — respuesta: `{ canales: [{ id, nombre, ... }] }`.
 */

interface CanalRaw {
  id: string
  nombre: string
  proveedor?: string
}

interface Props {
  valor: string | null
  onChange: (canalId: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function SelectorCanalWhatsApp({ valor, onChange, disabled, placeholder }: Props) {
  const { t } = useTraduccion()
  const { opciones, cargando, error } = useAutocompleteRemoto<CanalRaw>({
    url: '/api/whatsapp/canales',
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { canales?: unknown }).canales)
        ? ((raw as { canales: CanalRaw[] }).canales)
        : [],
  })

  const lista: OpcionSelector[] = useMemo(
    () => opciones.map((c) => ({ id: c.id, etiqueta: c.nombre, busqueda: c.proveedor ?? '' })),
    [opciones],
  )

  const seleccionada = lista.find((o) => o.id === valor) ?? null

  return (
    <SelectorPopoverBase
      placeholder={placeholder ?? t('flujos.selector.canal_wa.placeholder')}
      seleccionada={seleccionada}
      opciones={lista}
      cargando={cargando}
      error={error}
      onSeleccionar={(o) => onChange(o.id)}
      disabled={disabled}
    />
  )
}

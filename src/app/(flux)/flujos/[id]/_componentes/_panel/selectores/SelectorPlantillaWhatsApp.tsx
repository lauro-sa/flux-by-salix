'use client'

import { useMemo } from 'react'
import { useTraduccion } from '@/lib/i18n'
import SelectorPopoverBase, { type OpcionSelector } from './SelectorPopoverBase'
import { useAutocompleteRemoto } from './useAutocompleteRemoto'

/**
 * Selector autocomplete de plantillas de WhatsApp aprobadas
 * (sub-PR 19.3c).
 *
 * Usa GET /api/whatsapp/plantillas — respuesta:
 *   `{ plantillas: [{ id, nombre, nombre_api, idioma, estado, ... }] }`.
 *
 * Para el motor el campo crítico es `nombre_api` (= "plantilla_nombre"
 * del shape AccionEnviarWhatsappPlantilla). Lo guardamos como id para
 * que el guardado del paso lleve el nombre canónico.
 */

interface PlantillaRaw {
  id: string
  nombre: string
  nombre_api: string
  idioma?: string
  estado?: string
}

interface Props {
  /** Valor actual = `plantilla_nombre` (= nombre_api). */
  valor: string | null
  onChange: (nombreApi: string) => void
  disabled?: boolean
}

export default function SelectorPlantillaWhatsApp({ valor, onChange, disabled }: Props) {
  const { t } = useTraduccion()
  const { opciones, cargando, error } = useAutocompleteRemoto<PlantillaRaw>({
    url: '/api/whatsapp/plantillas',
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { plantillas?: unknown }).plantillas)
        ? ((raw as { plantillas: PlantillaRaw[] }).plantillas)
        : [],
  })

  const lista: OpcionSelector[] = useMemo(
    () =>
      opciones.map((p) => ({
        id: p.nombre_api,
        etiqueta: p.nombre,
        busqueda: `${p.nombre_api} ${p.idioma ?? ''} ${p.estado ?? ''}`,
      })),
    [opciones],
  )

  const seleccionada = lista.find((o) => o.id === valor) ?? null

  return (
    <SelectorPopoverBase
      placeholder={t('flujos.selector.plantilla_wa.placeholder')}
      seleccionada={seleccionada}
      opciones={lista}
      cargando={cargando}
      error={error}
      onSeleccionar={(o) => onChange(o.id)}
      disabled={disabled}
      renderOpcion={(o) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">{o.etiqueta}</span>
          <code className="text-xxs text-texto-terciario font-mono truncate">{o.id}</code>
        </div>
      )}
    />
  )
}

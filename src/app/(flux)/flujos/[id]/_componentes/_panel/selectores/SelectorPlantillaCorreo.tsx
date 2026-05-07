'use client'

import { useMemo } from 'react'
import { useTraduccion } from '@/lib/i18n'
import SelectorPopoverBase, { type OpcionSelector } from './SelectorPopoverBase'
import { useAutocompleteRemoto } from './useAutocompleteRemoto'

/**
 * Selector autocomplete de plantillas de correo (sub-PR 19.3d).
 *
 * Usa GET /api/correo/plantillas — respuesta: `{ plantillas: [{ id,
 * nombre, asunto, contenido, contenido_html, ... }] }`.
 *
 * Hallazgo crítico (sub-PR 19.3d): las plantillas de correo de Flux
 * usan `{{entidad.campo}}` (dot notation), NO `{{N}}` numéricas como
 * WhatsApp. El motor las resuelve automáticamente con
 * `resolverPlantilla` + contexto enriquecido. Por eso el panel
 * `PanelEnviarCorreoPlantilla` no necesita mapeo posicional de
 * variables — solo elegir la plantilla + destinatario.
 *
 * El componente expone también una versión enriquecida del item
 * (`onSeleccionarConDatos`) que devuelve la plantilla COMPLETA al
 * elegir, para que el panel pueda mostrar preview del asunto y cuerpo.
 */

export interface PlantillaCorreoItem {
  id: string
  nombre: string
  asunto: string
  contenido: string
  contenido_html: string
  categoria?: string | null
}

interface Props {
  valor: string | null
  onChange: (plantillaId: string, item: PlantillaCorreoItem | null) => void
  disabled?: boolean
}

export default function SelectorPlantillaCorreo({ valor, onChange, disabled }: Props) {
  const { t } = useTraduccion()
  const { opciones, cargando, error } = useAutocompleteRemoto<PlantillaCorreoItem>({
    url: '/api/correo/plantillas',
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { plantillas?: unknown }).plantillas)
        ? ((raw as { plantillas: PlantillaCorreoItem[] }).plantillas)
        : [],
  })

  const lista: OpcionSelector[] = useMemo(
    () =>
      opciones.map((p) => ({
        id: p.id,
        etiqueta: p.nombre,
        busqueda: `${p.asunto ?? ''} ${p.categoria ?? ''}`,
      })),
    [opciones],
  )

  const seleccionada = lista.find((o) => o.id === valor) ?? null

  return (
    <SelectorPopoverBase
      placeholder={t('flujos.selector.plantilla_correo.placeholder')}
      seleccionada={seleccionada}
      opciones={lista}
      cargando={cargando}
      error={error}
      onSeleccionar={(o) => {
        const item = opciones.find((p) => p.id === o.id) ?? null
        onChange(o.id, item)
      }}
      disabled={disabled}
      renderOpcion={(o) => {
        const item = opciones.find((p) => p.id === o.id)
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">{o.etiqueta}</span>
            {item?.asunto && (
              <span className="text-xxs text-texto-terciario truncate">{item.asunto}</span>
            )}
          </div>
        )
      }}
    />
  )
}

'use client'

import { useMemo } from 'react'
import { useTraduccion } from '@/lib/i18n'
import SelectorPopoverBase, { type OpcionSelector } from './SelectorPopoverBase'
import { useAutocompleteRemoto } from './useAutocompleteRemoto'

/**
 * Selector autocomplete de respuestas rápidas de correo.
 *
 * Usa GET /api/correo/respuestas-rapidas — respuesta: `{ plantillas: [
 * { id, nombre, asunto, contenido, contenido_html, categoria? } ] }`
 * (el endpoint reusa el nombre `plantillas` por consistencia con el de
 * plantillas_correo).
 *
 * Las respuestas rápidas son entidades distintas de las plantillas:
 * pensadas para atajos manuales del operador en el inbox, pero el
 * motor las puede mandar igual desde un flujo via
 * `enviar_respuesta_rapida_correo`. Esa separación se mantiene
 * deliberadamente — ver memoria del PR.
 */

export interface RespuestaRapidaCorreoItem {
  id: string
  nombre: string
  asunto: string | null
  contenido: string
  contenido_html: string | null
  categoria?: string | null
}

interface Props {
  valor: string | null
  onChange: (id: string, item: RespuestaRapidaCorreoItem | null) => void
  disabled?: boolean
}

export default function SelectorRespuestaRapidaCorreo({ valor, onChange, disabled }: Props) {
  const { t } = useTraduccion()
  const { opciones, cargando, error } = useAutocompleteRemoto<RespuestaRapidaCorreoItem>({
    url: '/api/correo/respuestas-rapidas',
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { plantillas?: unknown }).plantillas)
        ? ((raw as { plantillas: RespuestaRapidaCorreoItem[] }).plantillas)
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
      placeholder={t('flujos.selector.respuesta_rapida_correo.placeholder')}
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
        const preview = item?.contenido?.slice(0, 80) ?? ''
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">{o.etiqueta}</span>
            {preview && (
              <span className="text-xxs text-texto-terciario truncate">{preview}</span>
            )}
          </div>
        )
      }}
    />
  )
}

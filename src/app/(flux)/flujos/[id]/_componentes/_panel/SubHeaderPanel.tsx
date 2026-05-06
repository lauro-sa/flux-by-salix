'use client'

import { Insignia } from '@/componentes/ui/Insignia'
import { useTraduccion } from '@/lib/i18n'
import type { PosicionPaso } from '@/lib/workflows/posicion-paso'

/**
 * Sub-header de chips informativos del panel lateral (sub-PR 19.3a).
 *
 * Muestra:
 *   • Tipo legible del paso/disparador (chip outline neutro).
 *   • Posición "Paso N de M" si está en raíz, o "Paso N de M · Rama Sí/No"
 *     si está dentro de un branch (decisión §1.7.1).
 *   • Para el modo `disparador` no hay posición — el disparador es
 *     siempre primero y único, así que solo se muestra el chip de tipo.
 *
 * Sin emojis ni colores fuertes — el sub-header es informativo, no
 * accionable.
 */

interface PropsBase {
  tipoLegible: string
}

type Props =
  | (PropsBase & { modo: 'disparador' })
  | (PropsBase & { modo: 'paso'; posicion: PosicionPaso | null })

export default function SubHeaderPanel(props: Props) {
  const { t } = useTraduccion()

  const chipPosicion = (() => {
    if (props.modo === 'disparador') return null
    const p = props.posicion
    if (!p) return null
    const base = t('flujos.editor.panel.subheader.posicion')
      .replace('{{n}}', String(p.indice))
      .replace('{{total}}', String(p.total))
    if (p.contexto === 'raiz') return base
    const ramaTexto =
      p.contexto === 'rama_si'
        ? t('flujos.editor.panel.subheader.rama_si')
        : t('flujos.editor.panel.subheader.rama_no')
    return `${base} · ${ramaTexto}`
  })()

  return (
    <div className="shrink-0 flex items-center flex-wrap gap-1.5 px-4 py-2.5 border-b border-borde-sutil">
      <Insignia color="neutro" tamano="sm" variante="outline">
        {props.tipoLegible}
      </Insignia>
      {chipPosicion && (
        <Insignia color="neutro" tamano="sm" variante="outline">
          {chipPosicion}
        </Insignia>
      )}
    </div>
  )
}

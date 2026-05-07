'use client'

import { Input } from '@/componentes/ui/Input'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import type { AccionTerminarFlujo, AccionWorkflow } from '@/tipos/workflow'

/**
 * Panel para `accion: terminar_flujo` (sub-PR 19.3a).
 *
 * Es el paso más simple del catálogo: solo tiene un campo opcional
 * `motivo` para dejar registrado por qué se cortó el flujo. La leyenda
 * arriba refuerza que el motor no ejecuta nada después de este paso —
 * los pasos siguientes (si quedaron en el array por error) se ignoran.
 */

interface Props {
  paso: AccionTerminarFlujo
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
}

export default function PanelTerminar({ paso, soloLectura, onCambiar }: Props) {
  const { t } = useTraduccion()

  return (
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
        <p className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.terminar.leyenda')}
        </p>
        <Input
          etiqueta={t('flujos.editor.panel.terminar.motivo_label')}
          placeholder={t('flujos.editor.panel.terminar.motivo_placeholder')}
          value={paso.motivo ?? ''}
          onChange={(e) =>
            onCambiar({ motivo: e.target.value.length > 0 ? e.target.value : undefined })
          }
          disabled={soloLectura}
          formato={null}
        />
      </SeccionPanel>
    </>
  )
}

'use client'

import { Select } from '@/componentes/ui/Select'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import { ENTIDADES_CON_ESTADO, type EntidadConEstado } from '@/tipos/estados'
import type {
  DisparadorEntidadCreada,
  DisparadorWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `disparador: entidad.creada` (sub-PR 19.3b).
 *
 * Único campo: `entidad_tipo`. Dispara cuando se crea una entidad
 * nueva del tipo elegido. Sin filtro adicional en este sub-PR.
 */

interface Props {
  disparador: DisparadorEntidadCreada
  soloLectura: boolean
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelDisparadorEntidadCreada({
  disparador,
  soloLectura,
  onCambiar,
}: Props) {
  const { t } = useTraduccion()
  const cfg = disparador.configuracion

  const opcionesEntidad = ENTIDADES_CON_ESTADO.map((e) => ({
    valor: e,
    etiqueta: t(`flujos.editor.panel.cambiar_estado.entidad.${e}`),
  }))

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.disparador')}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.entidad_creada.entidad_label')}
        </span>
        {soloLectura ? (
          <div className="text-sm text-texto-secundario py-2">
            {opcionesEntidad.find((o) => o.valor === cfg.entidad_tipo)?.etiqueta ?? cfg.entidad_tipo}
          </div>
        ) : (
          <Select
            opciones={opcionesEntidad}
            valor={cfg.entidad_tipo}
            onChange={(v) =>
              onCambiar({
                tipo: 'entidad.creada',
                configuracion: { entidad_tipo: v as EntidadConEstado },
              })
            }
          />
        )}
        <span className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.entidad_creada.entidad_ayuda')}
        </span>
      </div>
    </SeccionPanel>
  )
}

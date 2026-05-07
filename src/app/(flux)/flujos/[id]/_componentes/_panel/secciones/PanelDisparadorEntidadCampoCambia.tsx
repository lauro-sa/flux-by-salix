'use client'

import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import { ENTIDADES_CON_ESTADO, type EntidadConEstado } from '@/tipos/estados'
import type {
  DisparadorEntidadCampoCambia,
  DisparadorWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `disparador: entidad.campo_cambia` (sub-PR 19.3b).
 *
 * Cobertura:
 *   • Entidad (select).
 *   • Campo a observar (Input texto — autocomplete contra schema es
 *     deuda futura).
 *   • Valor opcional: si presente, dispara solo cuando el campo pasa
 *     a ese valor exacto.
 */

interface Props {
  disparador: DisparadorEntidadCampoCambia
  soloLectura: boolean
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelDisparadorEntidadCampoCambia({
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

  const valorRaw = cfg.valor === undefined || cfg.valor === null ? '' : String(cfg.valor)

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.disparador')}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.entidad_campo_cambia.entidad_label')}
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
                tipo: 'entidad.campo_cambia',
                configuracion: { ...cfg, entidad_tipo: v as EntidadConEstado },
              })
            }
          />
        )}
      </div>

      <Input
        etiqueta={t('flujos.editor.panel.entidad_campo_cambia.campo_label')}
        placeholder={t('flujos.editor.panel.entidad_campo_cambia.campo_placeholder')}
        value={cfg.campo}
        onChange={(e) =>
          onCambiar({
            tipo: 'entidad.campo_cambia',
            configuracion: { ...cfg, campo: e.target.value },
          })
        }
        disabled={soloLectura}
        formato={null}
        ayuda={t('flujos.editor.panel.entidad_campo_cambia.campo_ayuda')}
      />

      <Input
        etiqueta={t('flujos.editor.panel.entidad_campo_cambia.valor_label')}
        placeholder={t('flujos.editor.panel.entidad_campo_cambia.valor_placeholder')}
        value={valorRaw}
        onChange={(e) => {
          const nuevo = e.target.value
          onCambiar({
            tipo: 'entidad.campo_cambia',
            configuracion: {
              ...cfg,
              valor: nuevo.length > 0 ? nuevo : undefined,
            },
          })
        }}
        disabled={soloLectura}
        formato={null}
        ayuda={t('flujos.editor.panel.entidad_campo_cambia.valor_ayuda')}
      />
    </SeccionPanel>
  )
}

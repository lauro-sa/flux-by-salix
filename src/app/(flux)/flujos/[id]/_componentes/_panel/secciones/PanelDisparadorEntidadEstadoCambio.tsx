'use client'

import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import { ENTIDADES_CON_ESTADO, type EntidadConEstado } from '@/tipos/estados'
import type {
  DisparadorEntidadEstadoCambio,
  DisparadorWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `disparador: entidad.estado_cambio` (sub-PR 19.3b).
 *
 * Cobertura:
 *   • Entidad (select de ENTIDADES_CON_ESTADO).
 *   • Estado destino (`hasta_clave`) — Input texto con ayuda en 19.3b;
 *     autocomplete contra `estados_<entidad>` es deuda.
 *   • Estado origen (`desde_clave`, opcional).
 *
 * El disparador es el "más usado" del catálogo: la mayoría de los flujos
 * del plan §1.4.1 son cambios de estado (presupuesto aceptado, cuota
 * pagada, etc).
 */

interface Props {
  disparador: DisparadorEntidadEstadoCambio
  soloLectura: boolean
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelDisparadorEntidadEstadoCambio({
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
          {t('flujos.editor.panel.entidad_estado_cambio.entidad_label')}
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
                tipo: 'entidad.estado_cambio',
                configuracion: { ...cfg, entidad_tipo: v as EntidadConEstado },
              })
            }
          />
        )}
      </div>

      <Input
        etiqueta={t('flujos.editor.panel.entidad_estado_cambio.hasta_label')}
        placeholder={t('flujos.editor.panel.entidad_estado_cambio.hasta_placeholder')}
        value={cfg.hasta_clave}
        onChange={(e) =>
          onCambiar({
            tipo: 'entidad.estado_cambio',
            configuracion: { ...cfg, hasta_clave: e.target.value },
          })
        }
        disabled={soloLectura}
        formato={null}
        ayuda={t('flujos.editor.panel.entidad_estado_cambio.hasta_ayuda')}
      />

      <Input
        etiqueta={t('flujos.editor.panel.entidad_estado_cambio.desde_label')}
        placeholder={t('flujos.editor.panel.entidad_estado_cambio.desde_placeholder')}
        value={cfg.desde_clave ?? ''}
        onChange={(e) =>
          onCambiar({
            tipo: 'entidad.estado_cambio',
            configuracion: {
              ...cfg,
              desde_clave: e.target.value.length > 0 ? e.target.value : null,
            },
          })
        }
        disabled={soloLectura}
        formato={null}
        ayuda={t('flujos.editor.panel.entidad_estado_cambio.desde_ayuda')}
      />
    </SeccionPanel>
  )
}

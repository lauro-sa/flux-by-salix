'use client'

import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import { ENTIDADES_CON_ESTADO, type EntidadConEstado } from '@/tipos/estados'
import type {
  DisparadorTiempoRelativoACampo,
  DisparadorWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `disparador: tiempo.relativo_a_campo` (sub-PR 19.3b).
 *
 * Cobertura:
 *   • Entidad (select).
 *   • Campo fecha (Input — autocomplete contra schema es deuda).
 *   • Delta días (Input number, negativo = antes; positivo = después).
 *   • Avanzado: hora_local, tolerancia_dias.
 *
 * Ejemplos comunes:
 *   - cuotas que vencen en 3 días (cuota, fecha_vencimiento, delta=-3)
 *   - revisión post-instalación (visita, fecha_completada, delta=+7)
 *
 * `filtro_estado_clave` se difiere a sub-PR posterior (requiere multi-input
 * para listas de strings — UI no trivial).
 */

interface Props {
  disparador: DisparadorTiempoRelativoACampo
  soloLectura: boolean
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelDisparadorRelativoACampo({
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
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.disparador')}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.relativo_a_campo.entidad_label')}
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
                  tipo: 'tiempo.relativo_a_campo',
                  configuracion: { ...cfg, entidad_tipo: v as EntidadConEstado },
                })
              }
            />
          )}
        </div>

        <Input
          etiqueta={t('flujos.editor.panel.relativo_a_campo.campo_fecha_label')}
          placeholder={t('flujos.editor.panel.relativo_a_campo.campo_fecha_placeholder')}
          value={cfg.campo_fecha}
          onChange={(e) =>
            onCambiar({
              tipo: 'tiempo.relativo_a_campo',
              configuracion: { ...cfg, campo_fecha: e.target.value },
            })
          }
          disabled={soloLectura}
          formato={null}
          ayuda={t('flujos.editor.panel.relativo_a_campo.campo_fecha_ayuda')}
        />

        <Input
          tipo="number"
          etiqueta={t('flujos.editor.panel.relativo_a_campo.delta_label')}
          value={String(cfg.delta_dias ?? 0)}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isFinite(n)) return
            onCambiar({
              tipo: 'tiempo.relativo_a_campo',
              configuracion: { ...cfg, delta_dias: Math.round(n) },
            })
          }}
          disabled={soloLectura}
          formato={null}
          ayuda={t('flujos.editor.panel.relativo_a_campo.delta_ayuda')}
        />
      </SeccionPanel>

      <SeccionPanel titulo={t('flujos.editor.panel.seccion.avanzado')} defaultAbierto={false}>
        <Input
          etiqueta={t('flujos.editor.panel.relativo_a_campo.hora_local_label')}
          placeholder="09:00"
          value={cfg.hora_local ?? '09:00'}
          onChange={(e) =>
            onCambiar({
              tipo: 'tiempo.relativo_a_campo',
              configuracion: { ...cfg, hora_local: e.target.value },
            })
          }
          disabled={soloLectura}
          formato={null}
          ayuda={t('flujos.editor.panel.relativo_a_campo.hora_local_ayuda')}
        />
        <Input
          tipo="number"
          etiqueta={t('flujos.editor.panel.relativo_a_campo.tolerancia_label')}
          value={String(cfg.tolerancia_dias ?? 0)}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isFinite(n) || n < 0) return
            onCambiar({
              tipo: 'tiempo.relativo_a_campo',
              configuracion: { ...cfg, tolerancia_dias: Math.round(n) },
            })
          }}
          disabled={soloLectura}
          formato={null}
          ayuda={t('flujos.editor.panel.relativo_a_campo.tolerancia_ayuda')}
        />
      </SeccionPanel>
    </>
  )
}

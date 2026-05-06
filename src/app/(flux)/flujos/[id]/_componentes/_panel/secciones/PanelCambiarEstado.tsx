'use client'

import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import { ENTIDADES_CON_ESTADO, type EntidadConEstado } from '@/tipos/estados'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'
import type {
  AccionCambiarEstadoEntidad,
  AccionWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `accion: cambiar_estado_entidad` (sub-PR 19.3b).
 *
 * Caveat del coordinador: el selector `entidad_tipo` se auto-llena del
 * disparador del flujo si éste tiene una entidad asociada. Si el
 * disparador es time-driven sin entidad (tiempo.cron, webhook), el
 * panel muestra un selector explícito.
 *
 * `entidad_id` admite variables (típico: `{{entidad.id}}` cuando el
 * flujo está reaccionando a un cambio en la misma entidad).
 *
 * `hasta_clave` queda como Input texto en 19.3b — autocomplete contra
 * la tabla `estados_<entidad>` es deuda explícita.
 */

interface Props {
  paso: AccionCambiarEstadoEntidad
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
  /** Entidad-tipo del disparador del flujo (si tiene). */
  tipoEntidadDisparador: EntidadConEstado | null
}

export default function PanelCambiarEstado({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
  tipoEntidadDisparador,
}: Props) {
  const { t } = useTraduccion()

  const opcionesEntidad = ENTIDADES_CON_ESTADO.map((e) => ({
    valor: e,
    etiqueta: t(`flujos.editor.panel.cambiar_estado.entidad.${e}`),
  }))

  return (
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.cambiar_estado.entidad_label')}
          </span>
          {soloLectura ? (
            <div className="text-sm text-texto-secundario py-2">
              {opcionesEntidad.find((o) => o.valor === paso.entidad_tipo)?.etiqueta ?? paso.entidad_tipo}
            </div>
          ) : (
            <Select
              opciones={opcionesEntidad}
              valor={paso.entidad_tipo ?? tipoEntidadDisparador ?? 'presupuesto'}
              onChange={(v) => onCambiar({ entidad_tipo: v as EntidadConEstado })}
            />
          )}
          {tipoEntidadDisparador && (
            <span className="text-xs text-texto-terciario leading-relaxed">
              {t('flujos.editor.panel.cambiar_estado.entidad_ayuda_disparador').replace(
                '{{tipo}}',
                t(`flujos.editor.panel.cambiar_estado.entidad.${tipoEntidadDisparador}`),
              )}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.cambiar_estado.entidad_id_label')}
          </span>
          <InputConVariables
            valor={paso.entidad_id ?? ''}
            onChange={(v) => onCambiar({ entidad_id: v })}
            placeholder="{{entidad.id}}"
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
            ariaLabel={t('flujos.editor.panel.cambiar_estado.entidad_id_label')}
          />
          <span className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.cambiar_estado.entidad_id_ayuda')}
          </span>
        </div>

        <Input
          etiqueta={t('flujos.editor.panel.cambiar_estado.hasta_clave_label')}
          placeholder={t('flujos.editor.panel.cambiar_estado.hasta_clave_placeholder')}
          value={paso.hasta_clave ?? ''}
          onChange={(e) => onCambiar({ hasta_clave: e.target.value })}
          disabled={soloLectura}
          formato={null}
          ayuda={t('flujos.editor.panel.cambiar_estado.hasta_clave_ayuda')}
        />

        <Input
          etiqueta={t('flujos.editor.panel.cambiar_estado.motivo_label')}
          placeholder={t('flujos.editor.panel.cambiar_estado.motivo_placeholder')}
          value={paso.motivo ?? ''}
          onChange={(e) =>
            onCambiar({ motivo: e.target.value.length > 0 ? e.target.value : undefined })
          }
          disabled={soloLectura}
          formato={null}
        />
      </SeccionPanel>

      <SeccionPanel titulo={t('flujos.editor.panel.seccion.avanzado')} defaultAbierto={false}>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={paso.continuar_si_falla === true}
            onChange={(e) => onCambiar({ continuar_si_falla: e.target.checked })}
            disabled={soloLectura}
            className="mt-0.5 cursor-pointer"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-texto-primario">
              {t('flujos.editor.panel.avanzado.continuar_si_falla_label')}
            </span>
            <span className="text-xs text-texto-terciario leading-relaxed">
              {t('flujos.editor.panel.avanzado.continuar_si_falla_ayuda')}
            </span>
          </span>
        </label>
      </SeccionPanel>
    </>
  )
}

'use client'

import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import SelectorTipoActividad from '../selectores/SelectorTipoActividad'
import SelectorMiembro from '../selectores/SelectorMiembro'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'
import type {
  AccionCrearActividad,
  AccionWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `accion: crear_actividad` (sub-PR 19.3b).
 *
 * Cobertura:
 *   • Básicos: tipo_actividad_id, titulo (con variables), descripcion
 *     (con variables), prioridad.
 *   • Avanzado: asignados_ids (CSV), contacto_id, fecha_vencimiento,
 *     continuar_si_falla.
 *
 * Difiere: autocomplete de tipos contra `/api/actividades/config`,
 * autocomplete de usuarios y contactos.
 */

interface Props {
  paso: AccionCrearActividad
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

const OPCIONES_PRIORIDAD = [
  { valor: 'baja', etiquetaClave: 'flujos.editor.panel.actividad.prioridad_baja' },
  { valor: 'normal', etiquetaClave: 'flujos.editor.panel.actividad.prioridad_normal' },
  { valor: 'alta', etiquetaClave: 'flujos.editor.panel.actividad.prioridad_alta' },
] as const

export default function PanelCrearActividad({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()

  const opcionesPrioridad = OPCIONES_PRIORIDAD.map((o) => ({
    valor: o.valor,
    etiqueta: t(o.etiquetaClave),
  }))

  return (
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.actividad.tipo_id_label')}
          </span>
          <SelectorTipoActividad
            valor={paso.tipo_actividad_id ?? null}
            onChange={(id) => onCambiar({ tipo_actividad_id: id })}
            disabled={soloLectura}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.actividad.titulo_label')}
          </span>
          <InputConVariables
            valor={paso.titulo ?? ''}
            onChange={(v) => onCambiar({ titulo: v })}
            placeholder={t('flujos.editor.panel.actividad.titulo_placeholder')}
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
            ariaLabel={t('flujos.editor.panel.actividad.titulo_label')}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.actividad.descripcion_label')}
          </span>
          <InputConVariables
            valor={paso.descripcion ?? ''}
            onChange={(v) => onCambiar({ descripcion: v.length > 0 ? v : undefined })}
            placeholder={t('flujos.editor.panel.actividad.descripcion_placeholder')}
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
            ariaLabel={t('flujos.editor.panel.actividad.descripcion_label')}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.actividad.prioridad_label')}
          </span>
          {soloLectura ? (
            <div className="text-sm text-texto-secundario py-2">
              {opcionesPrioridad.find((o) => o.valor === (paso.prioridad ?? 'normal'))?.etiqueta}
            </div>
          ) : (
            <Select
              opciones={opcionesPrioridad}
              valor={paso.prioridad ?? 'normal'}
              onChange={(v) => onCambiar({ prioridad: v as 'baja' | 'normal' | 'alta' })}
            />
          )}
        </div>
      </SeccionPanel>

      <SeccionPanel titulo={t('flujos.editor.panel.seccion.avanzado')} defaultAbierto={false}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.actividad.asignados_label')}
          </span>
          <SelectorMiembro
            multi
            valor={paso.asignados_ids ?? []}
            onChange={(ids) => onCambiar({ asignados_ids: ids.length > 0 ? ids : undefined })}
            disabled={soloLectura}
          />
        </div>
        <Input
          etiqueta={t('flujos.editor.panel.actividad.contacto_label')}
          placeholder={t('flujos.editor.panel.actividad.contacto_placeholder')}
          value={paso.contacto_id ?? ''}
          onChange={(e) =>
            onCambiar({ contacto_id: e.target.value.length > 0 ? e.target.value : undefined })
          }
          disabled={soloLectura}
          formato={null}
          ayuda={t('flujos.editor.panel.actividad.contacto_ayuda')}
        />
        <Input
          etiqueta={t('flujos.editor.panel.actividad.fecha_label')}
          placeholder="YYYY-MM-DD"
          value={paso.fecha_vencimiento ?? ''}
          onChange={(e) =>
            onCambiar({
              fecha_vencimiento: e.target.value.length > 0 ? e.target.value : undefined,
            })
          }
          disabled={soloLectura}
          formato={null}
          ayuda={t('flujos.editor.panel.actividad.fecha_ayuda')}
        />
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

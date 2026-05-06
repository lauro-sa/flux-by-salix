'use client'

import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import SelectorPlantillaCorreo, {
  type PlantillaCorreoItem,
} from '../selectores/SelectorPlantillaCorreo'
import type { AccionGenerica, AccionWorkflow } from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Panel para `accion: enviar_correo_plantilla` (sub-PR 19.3d).
 *
 * Sale del diferido de 19.3b porque el endpoint GET de plantillas
 * existe (`/api/correo/plantillas`).
 *
 * Hallazgo crítico de 19.3d: las plantillas de correo de Flux usan
 * `{{entidad.campo}}` (dot notation). El motor (`resolverPlantilla`)
 * las resuelve automáticamente con el contexto enriquecido en runtime.
 * NO hay mapeo posicional `{{1}}/{{2}}` como WhatsApp Meta. Por eso el
 * shape de parametros se simplifica:
 *
 *   {
 *     plantilla_id: string
 *     destinatario: string  // soporta variables, ej: {{contacto.email}}
 *   }
 *
 * El panel solo:
 *   • Selecciona la plantilla.
 *   • Permite override del destinatario.
 *   • Muestra preview READ-ONLY del asunto y cuerpo de la plantilla
 *     (texto plano + variables visibles tal cual). El motor las resuelve
 *     en ejecución.
 *
 * NO permite editar el cuerpo de la plantilla desde acá — para eso
 * existe la página de configuración de plantillas. Mantener el
 * principio de "un único lugar donde se editan plantillas".
 */

interface Props {
  paso: AccionGenerica
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

export default function PanelEnviarCorreoPlantilla({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()
  const params = paso.parametros ?? {}
  const plantillaId = typeof params.plantilla_id === 'string' ? params.plantilla_id : null
  const destinatario = typeof params.destinatario === 'string' ? params.destinatario : ''
  // El item completo de la plantilla seleccionada se guarda como
  // metadata en parametros para mostrar preview. NO se persiste — se
  // recarga al elegir. Si refrescamos sin haber elegido, el preview
  // queda vacío hasta que el usuario abra el dropdown.
  const previewAsunto = typeof params._preview_asunto === 'string' ? params._preview_asunto : null
  const previewCuerpo = typeof params._preview_cuerpo === 'string' ? params._preview_cuerpo : null

  const cambiar = (parche: Record<string, unknown>) =>
    onCambiar({ parametros: { ...params, ...parche } } as Partial<AccionWorkflow>)

  const onSeleccionarPlantilla = (id: string, item: PlantillaCorreoItem | null) => {
    cambiar({
      plantilla_id: id,
      _preview_asunto: item?.asunto ?? null,
      _preview_cuerpo: item?.contenido ?? null,
    })
  }

  return (
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.correo_plantilla.plantilla_label')}
          </span>
          <SelectorPlantillaCorreo
            valor={plantillaId}
            onChange={onSeleccionarPlantilla}
            disabled={soloLectura}
          />
          <span className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.correo_plantilla.plantilla_ayuda')}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.correo_plantilla.destinatario_label')}
          </span>
          <InputConVariables
            valor={destinatario}
            onChange={(v) => cambiar({ destinatario: v })}
            placeholder="{{contacto.email}}"
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
          />
        </div>
      </SeccionPanel>

      {plantillaId && (previewAsunto || previewCuerpo) && (
        <SeccionPanel titulo={t('flujos.editor.panel.correo_plantilla.preview_titulo')}>
          {previewAsunto && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                {t('flujos.editor.panel.correo_plantilla.preview_asunto_label')}
              </span>
              <div className="text-sm text-texto-primario p-2 rounded border border-borde-sutil bg-superficie-tarjeta whitespace-pre-wrap">
                {previewAsunto}
              </div>
            </div>
          )}
          {previewCuerpo && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                {t('flujos.editor.panel.correo_plantilla.preview_cuerpo_label')}
              </span>
              <div className="text-sm text-texto-secundario p-2 rounded border border-borde-sutil bg-superficie-tarjeta whitespace-pre-wrap max-h-40 overflow-y-auto">
                {previewCuerpo}
              </div>
            </div>
          )}
          <p className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.correo_plantilla.preview_ayuda')}
          </p>
        </SeccionPanel>
      )}
    </>
  )
}

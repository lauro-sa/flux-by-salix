'use client'

import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import SelectorRespuestaRapidaCorreo, {
  type RespuestaRapidaCorreoItem,
} from '../selectores/SelectorRespuestaRapidaCorreo'
import type {
  AccionEnviarRespuestaRapidaCorreo,
  AccionWorkflow,
} from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Panel para `accion: enviar_respuesta_rapida_correo`.
 *
 * Espejo de PanelEnviarCorreoPlantilla pero leyendo de
 * `respuestas_rapidas_correo`. Cambia solo el selector — el resto del
 * patrón es idéntico (override opcional de destinatario, preview).
 *
 * Cuando el flujo se dispara como respuesta a un mensaje entrante
 * (inbox.mensaje_recibido), el destinatario y la cuenta origen se
 * derivan automáticamente del mensaje original; el `destinatario_override`
 * solo aplica si el flujo viene de otro disparador (cron, etc.) o si
 * se quiere forzar otro destinatario.
 */

interface Props {
  paso: AccionEnviarRespuestaRapidaCorreo & { _preview_asunto?: string | null; _preview_cuerpo?: string | null }
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

export default function PanelEnviarRespuestaRapidaCorreo({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()
  const respuestaId = paso.respuesta_rapida_id || null
  const destinatario = paso.destinatario_override ?? ''
  const previewAsunto = paso._preview_asunto ?? null
  const previewCuerpo = paso._preview_cuerpo ?? null

  const onSeleccionarRespuesta = (id: string, item: RespuestaRapidaCorreoItem | null) => {
    onCambiar({
      respuesta_rapida_id: id,
      _preview_asunto: item?.asunto ?? null,
      _preview_cuerpo: item?.contenido ?? null,
    } as Partial<AccionWorkflow>)
  }

  return (
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.respuesta_rapida_correo.respuesta_label')}
          </span>
          <SelectorRespuestaRapidaCorreo
            valor={respuestaId}
            onChange={onSeleccionarRespuesta}
            disabled={soloLectura}
          />
          <span className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.respuesta_rapida_correo.respuesta_ayuda')}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.respuesta_rapida_correo.destinatario_label')}
          </span>
          <InputConVariables
            valor={destinatario}
            onChange={(v) =>
              onCambiar({
                destinatario_override: v || undefined,
              } as Partial<AccionWorkflow>)
            }
            placeholder={t('flujos.editor.panel.respuesta_rapida_correo.destinatario_placeholder')}
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
          />
          <span className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.respuesta_rapida_correo.destinatario_ayuda')}
          </span>
        </div>
      </SeccionPanel>

      {respuestaId && (previewAsunto || previewCuerpo) && (
        <SeccionPanel titulo={t('flujos.editor.panel.respuesta_rapida_correo.preview_titulo')}>
          {previewAsunto && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                {t('flujos.editor.panel.respuesta_rapida_correo.preview_asunto_label')}
              </span>
              <div className="text-sm text-texto-primario p-2 rounded border border-borde-sutil bg-superficie-tarjeta whitespace-pre-wrap">
                {previewAsunto}
              </div>
            </div>
          )}
          {previewCuerpo && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                {t('flujos.editor.panel.respuesta_rapida_correo.preview_cuerpo_label')}
              </span>
              <div className="text-sm text-texto-secundario p-2 rounded border border-borde-sutil bg-superficie-tarjeta whitespace-pre-wrap max-h-40 overflow-y-auto">
                {previewCuerpo}
              </div>
            </div>
          )}
          <p className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.respuesta_rapida_correo.preview_ayuda')}
          </p>
        </SeccionPanel>
      )}
    </>
  )
}

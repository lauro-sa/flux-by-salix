'use client'

import { Select } from '@/componentes/ui/Select'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import SelectorCanalWhatsApp from '../selectores/SelectorCanalWhatsApp'
import SelectorPlantillaWhatsApp from '../selectores/SelectorPlantillaWhatsApp'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'
import type {
  AccionEnviarWhatsappPlantilla,
  AccionWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `accion: enviar_whatsapp_plantilla` (sub-PR 19.3b).
 *
 * Cobertura mínima:
 *   • Básicos:     canal (id), teléfono (con variables), plantilla
 *                  (nombre), idioma.
 *   • Avanzado:    `continuar_si_falla`.
 *
 * Difiere a sub-PR posterior:
 *   • Selector de canal con autocomplete contra `/api/whatsapp/canales`.
 *   • Selector de plantilla aprobada con autocomplete contra
 *     `/api/whatsapp/plantillas`.
 *   • Mapeo visual de variables `{{1}}`, `{{2}}` de la plantilla
 *     (depende del fetch de la plantilla — endpoint GET aún no existe).
 *
 * El campo `componentes?` no se edita en 19.3b — queda como estaba en
 * el JSON, el panel no lo pisa.
 */

interface Props {
  paso: AccionEnviarWhatsappPlantilla
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

const OPCIONES_IDIOMA = [
  { valor: 'es', etiqueta: 'es' },
  { valor: 'es_AR', etiqueta: 'es_AR' },
  { valor: 'en', etiqueta: 'en' },
  { valor: 'pt', etiqueta: 'pt' },
]

export default function PanelEnviarWhatsApp({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()

  return (
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.whatsapp.canal_label')}
          </span>
          <SelectorCanalWhatsApp
            valor={paso.canal_id ?? null}
            onChange={(id) => onCambiar({ canal_id: id })}
            disabled={soloLectura}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.whatsapp.telefono_label')}
          </span>
          <InputConVariables
            valor={paso.telefono ?? ''}
            onChange={(v) => onCambiar({ telefono: v })}
            placeholder={t('flujos.editor.panel.whatsapp.telefono_placeholder')}
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
            ariaLabel={t('flujos.editor.panel.whatsapp.telefono_label')}
          />
          <span className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.whatsapp.telefono_ayuda')}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.whatsapp.plantilla_label')}
          </span>
          <SelectorPlantillaWhatsApp
            valor={paso.plantilla_nombre ?? null}
            onChange={(nombreApi) => onCambiar({ plantilla_nombre: nombreApi })}
            disabled={soloLectura}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.whatsapp.idioma_label')}
          </span>
          {soloLectura ? (
            <div className="text-sm text-texto-secundario py-2">{paso.idioma ?? 'es'}</div>
          ) : (
            <Select
              opciones={OPCIONES_IDIOMA}
              valor={paso.idioma ?? 'es'}
              onChange={(v) => onCambiar({ idioma: v })}
            />
          )}
        </div>
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

'use client'

import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import SelectorCanalWhatsApp from '../selectores/SelectorCanalWhatsApp'
import type { AccionGenerica, AccionWorkflow } from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Panel para `accion: enviar_whatsapp_texto` (sub-PR 19.3c).
 *
 * Texto libre de WhatsApp dentro de la ventana de 24hs (no requiere
 * plantilla aprobada). Shape de parametros:
 *   {
 *     canal_id: string
 *     telefono: string  // soporta variables
 *     mensaje: string   // soporta variables
 *   }
 */

interface Props {
  paso: AccionGenerica
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

export default function PanelEnviarWhatsAppTexto({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()
  const params = paso.parametros ?? {}
  const canalId = typeof params.canal_id === 'string' ? params.canal_id : null
  const telefono = typeof params.telefono === 'string' ? params.telefono : ''
  const mensaje = typeof params.mensaje === 'string' ? params.mensaje : ''

  const cambiar = (parche: Record<string, unknown>) =>
    onCambiar({ parametros: { ...params, ...parche } } as Partial<AccionWorkflow>)

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.whatsapp.canal_label')}
        </span>
        <SelectorCanalWhatsApp
          valor={canalId}
          onChange={(id) => cambiar({ canal_id: id })}
          disabled={soloLectura}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.whatsapp.telefono_label')}
        </span>
        <InputConVariables
          valor={telefono}
          onChange={(v) => cambiar({ telefono: v })}
          placeholder="{{contacto.telefono}}"
          contexto={contexto}
          fuentes={fuentes}
          soloLectura={soloLectura}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.whatsapp_texto.mensaje_label')}
        </span>
        <InputConVariables
          valor={mensaje}
          onChange={(v) => cambiar({ mensaje: v })}
          placeholder={t('flujos.editor.panel.whatsapp_texto.mensaje_placeholder')}
          contexto={contexto}
          fuentes={fuentes}
          soloLectura={soloLectura}
        />
        <span className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.whatsapp_texto.mensaje_ayuda')}
        </span>
      </div>
    </SeccionPanel>
  )
}

'use client'

import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import type { AccionGenerica, AccionWorkflow } from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Panel para `accion: enviar_correo_texto` (sub-PR 19.3c).
 *
 * Correo libre (sin plantilla pre-armada). Shape de parametros:
 *   {
 *     destinatario: string  // soporta variables, ej: {{contacto.email}}
 *     asunto: string        // soporta variables
 *     cuerpo: string        // soporta variables, single-line en este sub-PR
 *   }
 *
 * Cuerpo rich-text con variables se difiere a sub-PR posterior (D4=C
 * del plan macro de 19.3). En 19.3c queda single-line; el motor lo
 * acepta tal cual y la mayoría de casos cabe en una línea de
 * variables + texto.
 */

interface Props {
  paso: AccionGenerica
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

export default function PanelEnviarCorreoTexto({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()
  const params = paso.parametros ?? {}
  const destinatario = typeof params.destinatario === 'string' ? params.destinatario : ''
  const asunto = typeof params.asunto === 'string' ? params.asunto : ''
  const cuerpo = typeof params.cuerpo === 'string' ? params.cuerpo : ''

  const cambiar = (parche: Record<string, unknown>) =>
    onCambiar({ parametros: { ...params, ...parche } } as Partial<AccionWorkflow>)

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.correo_texto.destinatario_label')}
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

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.correo_texto.asunto_label')}
        </span>
        <InputConVariables
          valor={asunto}
          onChange={(v) => cambiar({ asunto: v })}
          placeholder={t('flujos.editor.panel.correo_texto.asunto_placeholder')}
          contexto={contexto}
          fuentes={fuentes}
          soloLectura={soloLectura}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.correo_texto.cuerpo_label')}
        </span>
        <InputConVariables
          valor={cuerpo}
          onChange={(v) => cambiar({ cuerpo: v })}
          placeholder={t('flujos.editor.panel.correo_texto.cuerpo_placeholder')}
          contexto={contexto}
          fuentes={fuentes}
          soloLectura={soloLectura}
        />
        <span className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.correo_texto.cuerpo_ayuda')}
        </span>
      </div>
    </SeccionPanel>
  )
}

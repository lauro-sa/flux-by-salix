'use client'

import { Input } from '@/componentes/ui/Input'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import SelectorMiembro from '../selectores/SelectorMiembro'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'
import type {
  AccionNotificarUsuario,
  AccionWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `accion: notificar_usuario` (sub-PR 19.3b).
 *
 * Cobertura:
 *   • Básicos: usuario (id), título (con variables), cuerpo (con variables).
 *   • Avanzado: url de deep-link, notificacion_tipo, continuar_si_falla.
 *
 * Difiere: autocomplete de usuarios (depende de listar miembros).
 */

interface Props {
  paso: AccionNotificarUsuario
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

export default function PanelNotificarUsuario({
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
            {t('flujos.editor.panel.notificar.usuario_label')}
          </span>
          <SelectorMiembro
            valor={paso.usuario_id ?? null}
            onChange={(id) => onCambiar({ usuario_id: id })}
            disabled={soloLectura}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.notificar.titulo_label')}
          </span>
          <InputConVariables
            valor={paso.titulo ?? ''}
            onChange={(v) => onCambiar({ titulo: v })}
            placeholder={t('flujos.editor.panel.notificar.titulo_placeholder')}
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
            ariaLabel={t('flujos.editor.panel.notificar.titulo_label')}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.notificar.cuerpo_label')}
          </span>
          <InputConVariables
            valor={paso.cuerpo ?? ''}
            onChange={(v) => onCambiar({ cuerpo: v.length > 0 ? v : undefined })}
            placeholder={t('flujos.editor.panel.notificar.cuerpo_placeholder')}
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
            ariaLabel={t('flujos.editor.panel.notificar.cuerpo_label')}
          />
        </div>
      </SeccionPanel>

      <SeccionPanel titulo={t('flujos.editor.panel.seccion.avanzado')} defaultAbierto={false}>
        <Input
          etiqueta={t('flujos.editor.panel.notificar.url_label')}
          placeholder={t('flujos.editor.panel.notificar.url_placeholder')}
          value={paso.url ?? ''}
          onChange={(e) => onCambiar({ url: e.target.value.length > 0 ? e.target.value : undefined })}
          disabled={soloLectura}
          formato={null}
          ayuda={t('flujos.editor.panel.notificar.url_ayuda')}
        />
        <Input
          etiqueta={t('flujos.editor.panel.notificar.tipo_label')}
          placeholder={t('flujos.editor.panel.notificar.tipo_placeholder')}
          value={paso.notificacion_tipo ?? ''}
          onChange={(e) =>
            onCambiar({
              notificacion_tipo: e.target.value.length > 0 ? e.target.value : undefined,
            })
          }
          disabled={soloLectura}
          formato={null}
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

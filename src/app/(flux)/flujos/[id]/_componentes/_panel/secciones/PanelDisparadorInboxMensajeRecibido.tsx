'use client'

import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import SelectorCanalesCorreo from '../selectores/SelectorCanalesCorreo'
import type {
  DisparadorInboxMensajeRecibido,
  DisparadorWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `disparador: inbox.mensaje_recibido`.
 *
 * Tipo de canal está fijado a 'correo' hoy. Cuando se sume WhatsApp al
 * motor, este panel agregará un switch arriba para elegir el tipo y el
 * selector multi cambiará por canales del tipo correspondiente.
 *
 * `canal_ids` vacío = todas las cuentas de correo activas de la empresa.
 * Para limitar a cuentas específicas, el usuario las elige en el
 * multi-select.
 */

interface Props {
  disparador: DisparadorInboxMensajeRecibido
  soloLectura: boolean
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelDisparadorInboxMensajeRecibido({
  disparador,
  soloLectura,
  onCambiar,
}: Props) {
  const { t } = useTraduccion()
  const cfg = disparador.configuracion
  const canalIds = cfg.canal_ids ?? []

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.disparador')}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.inbox_mensaje_recibido.tipo_canal_label')}
        </span>
        <div className="text-sm text-texto-secundario py-1.5 px-2.5 rounded-md border border-borde-sutil bg-superficie-tarjeta">
          {t('flujos.editor.panel.inbox_mensaje_recibido.tipo_canal_correo')}
        </div>
        <span className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.inbox_mensaje_recibido.tipo_canal_ayuda')}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.inbox_mensaje_recibido.canales_label')}
        </span>
        <SelectorCanalesCorreo
          valor={canalIds}
          onChange={(ids) =>
            onCambiar({
              tipo: 'inbox.mensaje_recibido',
              configuracion: {
                tipo_canal: 'correo',
                ...(ids.length > 0 ? { canal_ids: ids } : {}),
              },
            })
          }
          disabled={soloLectura}
        />
        <span className="text-xs text-texto-terciario leading-relaxed">
          {canalIds.length === 0
            ? t('flujos.editor.panel.inbox_mensaje_recibido.canales_ayuda_todas')
            : t('flujos.editor.panel.inbox_mensaje_recibido.canales_ayuda_filtradas')}
        </span>
      </div>
    </SeccionPanel>
  )
}

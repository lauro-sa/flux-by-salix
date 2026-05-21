'use client'

import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import SelectorCanalesCorreo from '../selectores/SelectorCanalesCorreo'
import type {
  DisparadorInboxCorreoRecibido,
  DisparadorWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `disparador: inbox.correo_recibido`.
 *
 * `canal_ids` vacío = todas las cuentas de correo activas de la
 * empresa. Para limitar a cuentas específicas, el usuario las elige
 * en el multi-select.
 *
 * Es el único de los tres disparadores de inbox con UI funcional:
 * WhatsApp e interno tienen tarjetas en el catálogo pero sus paneles
 * muestran un cartel "Próximamente" y la validación rechaza activar
 * un flujo que los use.
 */

interface Props {
  disparador: DisparadorInboxCorreoRecibido
  soloLectura: boolean
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelDisparadorInboxCorreoRecibido({
  disparador,
  soloLectura,
  onCambiar,
}: Props) {
  const { t } = useTraduccion()
  const canalIds = disparador.configuracion.canal_ids ?? []

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.disparador')}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.inbox_correo_recibido.canales_label')}
        </span>
        <SelectorCanalesCorreo
          valor={canalIds}
          onChange={(ids) =>
            onCambiar({
              tipo: 'inbox.correo_recibido',
              configuracion: ids.length > 0 ? { canal_ids: ids } : {},
            })
          }
          disabled={soloLectura}
        />
        <span className="text-xs text-texto-terciario leading-relaxed">
          {canalIds.length === 0
            ? t('flujos.editor.panel.inbox_correo_recibido.canales_ayuda_todas')
            : t('flujos.editor.panel.inbox_correo_recibido.canales_ayuda_filtradas')}
        </span>
      </div>
    </SeccionPanel>
  )
}

'use client'

import { Input } from '@/componentes/ui/Input'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import type { DisparadorTiempoCron, DisparadorWorkflow } from '@/tipos/workflow'

/**
 * Panel para `disparador: tiempo.cron` (sub-PR 19.3a).
 *
 * Editor mínimo: un input de texto con la expresión cron (5 campos
 * estándar) + ayuda con ejemplos comunes. Validación dura llega con
 * 19.4 (al activar/publicar). En este sub-PR no parseamos la expresión
 * — la mostramos cruda y dejamos al motor (PR 17) que la rechace si está
 * mal formada al activar.
 *
 * El selector visual L M M J V S D + hora HH:MM mencionado en §1.7.5 va
 * en un sub-PR posterior. Empezamos con el textbox básico para no
 * meter complejidad de parser cron de ida y vuelta en 19.3a.
 */

interface Props {
  disparador: DisparadorTiempoCron
  soloLectura: boolean
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelDisparadorCron({ disparador, soloLectura, onCambiar }: Props) {
  const { t } = useTraduccion()

  const handleCambioExpresion = (valor: string) => {
    onCambiar({
      tipo: 'tiempo.cron',
      configuracion: { expresion: valor },
    })
  }

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.disparador')}>
      <Input
        etiqueta={t('flujos.editor.panel.cron.expresion_label')}
        value={disparador.configuracion.expresion}
        onChange={(e) => handleCambioExpresion(e.target.value)}
        disabled={soloLectura}
        placeholder="0 9 * * 1-5"
        formato={null}
      />
      <div className="flex flex-col gap-1.5 text-xs text-texto-terciario leading-relaxed">
        <p>{t('flujos.editor.panel.cron.ayuda')}</p>
        <ul className="list-disc pl-5 flex flex-col gap-0.5">
          <li>
            <code className="text-texto-secundario">0 9 * * 1-5</code> ·{' '}
            {t('flujos.editor.panel.cron.ejemplo_1')}
          </li>
          <li>
            <code className="text-texto-secundario">*/15 * * * *</code> ·{' '}
            {t('flujos.editor.panel.cron.ejemplo_2')}
          </li>
          <li>
            <code className="text-texto-secundario">0 0 1 * *</code> ·{' '}
            {t('flujos.editor.panel.cron.ejemplo_3')}
          </li>
        </ul>
      </div>
    </SeccionPanel>
  )
}

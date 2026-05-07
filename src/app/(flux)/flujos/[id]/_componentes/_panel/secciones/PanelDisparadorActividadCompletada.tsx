'use client'

import { Input } from '@/componentes/ui/Input'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import type {
  DisparadorActividadCompletada,
  DisparadorWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `disparador: actividad.completada` (sub-PR 19.3a).
 *
 * En 19.3a el campo `tipo_clave` (opcional, filtra por tipo de
 * actividad) es un Input texto plano. En 19.3b lo convertimos en
 * autocomplete consumiendo `/api/actividades/config` que ya devuelve
 * los tipos por empresa. Esa lista es contextual al tenant — preferimos
 * no introducir el fetch en 19.3a para mantener el sub-PR contenido a
 * tipos sin variables ni lookups remotos.
 */

interface Props {
  disparador: DisparadorActividadCompletada
  soloLectura: boolean
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelDisparadorActividadCompletada({
  disparador,
  soloLectura,
  onCambiar,
}: Props) {
  const { t } = useTraduccion()

  const handleCambioClave = (valor: string) => {
    const limpio = valor.trim()
    onCambiar({
      tipo: 'actividad.completada',
      configuracion: limpio.length > 0 ? { tipo_clave: limpio } : {},
    })
  }

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.disparador')}>
      <Input
        etiqueta={t('flujos.editor.panel.actividad_completada.tipo_clave_label')}
        placeholder={t('flujos.editor.panel.actividad_completada.tipo_clave_placeholder')}
        value={disparador.configuracion.tipo_clave ?? ''}
        onChange={(e) => handleCambioClave(e.target.value)}
        disabled={soloLectura}
        formato={null}
        ayuda={t('flujos.editor.panel.actividad_completada.tipo_clave_ayuda')}
      />
    </SeccionPanel>
  )
}

'use client'

import { Construction } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'

/**
 * Panel fallback para tipos cuyo editor real aún no entró
 * (sub-PR 19.3a → resto llega en 19.3b/c).
 *
 * El usuario puede seguir teniendo el paso en el flujo (ya elegido vía
 * `CatalogoPasos`), solo que su edición detallada todavía no está. El
 * panel muestra un cartel que comunica esto con honestidad — sin
 * mentir que "está disponible". Siempre se puede eliminar el paso o
 * cerrar el panel.
 */

interface Props {
  /** Título legible del tipo (para que el cartel sea específico). */
  tipoLegible: string
}

export default function PanelTipoPendiente({ tipoLegible }: Props) {
  const { t } = useTraduccion()

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <span className="inline-flex items-center justify-center size-10 rounded-full bg-texto-marca/10 text-texto-marca">
          <Construction size={18} strokeWidth={1.6} />
        </span>
        <p className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.pendiente.titulo').replace('{{tipo}}', tipoLegible)}
        </p>
        <p className="text-xs text-texto-terciario max-w-sm leading-relaxed">
          {t('flujos.editor.panel.pendiente.descripcion')}
        </p>
      </div>
    </SeccionPanel>
  )
}

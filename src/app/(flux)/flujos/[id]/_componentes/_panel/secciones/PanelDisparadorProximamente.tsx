'use client'

import { Construction } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'

/**
 * Cartel "Próximamente" para disparadores que existen en el catálogo
 * (para que el usuario sepa que vienen) pero que el motor todavía no
 * ejecuta. Hoy lo usan `inbox.whatsapp_recibido` e
 * `inbox.interno_recibido`.
 *
 * El cartel deja claro:
 *   1. El disparador NO está implementado todavía.
 *   2. Activar un flujo con este disparador fallará en validación
 *      (con error explícito desde `validacion-flujo.ts`).
 *   3. El flujo se puede dejar como borrador.
 */

interface Props {
  /** Clave i18n del mensaje específico del canal. */
  claveI18nMensaje: string
}

export default function PanelDisparadorProximamente({ claveI18nMensaje }: Props) {
  const { t } = useTraduccion()

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.disparador')}>
      <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4 rounded-card border border-dashed border-borde-fuerte bg-superficie-tarjeta/40">
        <div className="inline-flex items-center justify-center size-10 rounded-full bg-insignia-advertencia-fondo text-insignia-advertencia-texto">
          <Construction size={18} strokeWidth={1.7} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-texto-primario">
            {t('flujos.editor.panel.proximamente.titulo')}
          </p>
          <p className="text-xs text-texto-terciario leading-relaxed max-w-sm">
            {t(claveI18nMensaje)}
          </p>
        </div>
      </div>
    </SeccionPanel>
  )
}

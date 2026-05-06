'use client'

import { AlertTriangle, Eye, AlertCircle } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

/**
 * Banner contextual del editor de flujos (sub-PR 19.2).
 *
 * Tres variantes mutuamente excluyentes (prioridad: error > lectura >
 * borrador):
 *   • `error`     — rojo, errores de validación al activar/publicar.
 *                    En 19.2 el componente está listo pero no se
 *                    dispara: la validación real es del 19.4.
 *   • `lectura`   — gris, usuario tiene permiso `ver` pero no `editar`.
 *   • `borrador`  — amarillo, flujo Activo/Pausado con borrador interno.
 *
 * El componente es puramente presentacional. La decisión de qué
 * variante mostrar la toma `EditorFlujo` consultando permisos +
 * `obtenerVersionEditable(flujo).esBorradorInterno`.
 */

interface PropiedadesBanner {
  tipo: 'borrador' | 'lectura' | 'error'
  /**
   * Texto detallado opcional (solo para `error`). Se renderiza debajo
   * del título cuando `tipo === 'error'`. En 19.2 nunca se pasa.
   */
  detalleError?: string
}

export default function BannerEditorFlujo({ tipo, detalleError }: PropiedadesBanner) {
  const { t } = useTraduccion()

  const config = (() => {
    switch (tipo) {
      case 'borrador':
        return {
          Icono: AlertTriangle,
          // Tokens semánticos del proyecto: insignia-advertencia para amarillo.
          fondo: 'bg-insignia-advertencia/10 border-insignia-advertencia/30',
          icono: 'text-insignia-advertencia-texto',
          texto: 'text-texto-primario',
          titulo: t('flujos.editor.banner.borrador_titulo'),
          desc: t('flujos.editor.banner.borrador_desc'),
        }
      case 'lectura':
        return {
          Icono: Eye,
          fondo: 'bg-superficie-tarjeta border-borde-sutil',
          icono: 'text-texto-terciario',
          texto: 'text-texto-secundario',
          titulo: t('flujos.editor.banner.lectura_titulo'),
          desc: t('flujos.editor.banner.lectura_desc'),
        }
      case 'error':
        return {
          Icono: AlertCircle,
          fondo: 'bg-insignia-peligro/10 border-insignia-peligro/30',
          icono: 'text-insignia-peligro-texto',
          texto: 'text-texto-primario',
          titulo: t('flujos.editor.banner.error_titulo'),
          desc: detalleError ?? t('flujos.editor.banner.error_desc'),
        }
    }
  })()

  return (
    <div
      role="status"
      className={`flex items-start gap-3 px-4 sm:px-6 py-3 border-y ${config.fondo}`}
    >
      <span className={`shrink-0 mt-0.5 ${config.icono}`}>
        <config.Icono size={18} strokeWidth={1.8} />
      </span>
      <div className={`flex-1 min-w-0 ${config.texto}`}>
        <p className="text-sm font-medium leading-tight">{config.titulo}</p>
        <p className="text-xs text-texto-terciario mt-0.5 leading-relaxed">{config.desc}</p>
      </div>
    </div>
  )
}

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { iconoDefaultAccion, iconoDefaultDisparador } from '@/lib/workflows/iconos-flujo'
import { etiquetaDisparador } from '@/lib/workflows/etiquetas-disparador'
import { claveI18nTituloPaso } from '@/lib/workflows/categorias-pasos'
import type { TipoAccion, TipoDisparador } from '@/tipos/workflow'

/**
 * Placeholder del panel lateral derecho del editor (sub-PR 19.2 — D7).
 *
 * Implementa el shell completo del panel:
 *   • Slide-in desde la derecha, ancho 480px en desktop, full en mobile.
 *   • Header con ícono + nombre del paso + botón cerrar.
 *   • Cuerpo: mensaje "Próximamente en 19.3" para no dejar el panel
 *             vacío y validar el layout asimétrico (canvas flex-1 +
 *             panel 480) en este sub-PR.
 *   • Footer con un solo botón "Cerrar".
 *
 * El panel real con campos editables (texto, picker de variables,
 * constructor de condiciones) llega en 19.3 — este componente se
 * reemplaza limpio.
 */

interface PropsBase {
  abierto: boolean
  onCerrar: () => void
}

type Props =
  | (PropsBase & {
      modo: 'disparador'
      tipo: TipoDisparador | null
    })
  | (PropsBase & {
      modo: 'paso'
      tipo: TipoAccion | null
    })

export default function PanelEdicionPasoPlaceholder(props: Props) {
  const { abierto, onCerrar, modo } = props
  const { t } = useTraduccion()

  const tipoTexto = props.tipo as string | null

  const Icono = (() => {
    if (!tipoTexto) return null
    return modo === 'disparador'
      ? iconoDefaultDisparador(tipoTexto as TipoDisparador)
      : iconoDefaultAccion(tipoTexto as TipoAccion)
  })()

  const titulo = (() => {
    if (!tipoTexto) {
      return t(modo === 'disparador'
        ? 'flujos.editor.disparador.placeholder_titulo'
        : 'flujos.editor.panel.titulo_default')
    }
    if (modo === 'disparador') return etiquetaDisparador(t, tipoTexto as TipoDisparador)
    const clave = claveI18nTituloPaso(tipoTexto as TipoAccion)
    const traducido = t(clave)
    return traducido === clave ? tipoTexto : traducido
  })()

  return (
    <AnimatePresence>
      {abierto && (
        <motion.aside
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-y-0 right-0 z-30 w-full md:w-[480px] bg-superficie-app border-l border-borde-sutil flex flex-col shadow-2xl"
          role="dialog"
          aria-label={titulo}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-borde-sutil">
            {Icono && (
              <span
                className="shrink-0 inline-flex items-center justify-center size-9 rounded-md bg-texto-marca/10 text-texto-marca"
                aria-hidden="true"
              >
                <Icono size={16} strokeWidth={1.7} />
              </span>
            )}
            <h2 className="flex-1 text-sm font-semibold text-texto-primario truncate">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              aria-label={t('comun.cerrar')}
              className="shrink-0 inline-flex items-center justify-center size-8 rounded-md text-texto-terciario hover:bg-superficie-hover hover:text-texto-secundario transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Cuerpo placeholder */}
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center text-center gap-3">
            <p className="text-sm font-medium text-texto-secundario">
              {t('flujos.editor.panel.placeholder_titulo')}
            </p>
            <p className="text-xs text-texto-terciario max-w-sm leading-relaxed">
              {t('flujos.editor.panel.placeholder_desc')}
            </p>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-borde-sutil">
            <button
              type="button"
              onClick={onCerrar}
              className="h-8 px-3 text-sm font-medium rounded-md bg-superficie-tarjeta text-texto-primario border border-borde-sutil hover:border-borde-fuerte hover:bg-superficie-hover transition-colors cursor-pointer"
            >
              {t('comun.cerrar')}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

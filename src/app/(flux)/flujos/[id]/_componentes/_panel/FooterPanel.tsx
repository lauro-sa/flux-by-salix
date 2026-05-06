'use client'

import { Trash2 } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

/**
 * Footer del panel lateral (sub-PR 19.3a).
 *
 * Layout:
 *   [Eliminar paso (rojo, ghost)] ............ [Cerrar]
 *
 * Variantes:
 *   • modo='paso' + !soloLectura          → ambos botones.
 *   • modo='paso' + soloLectura           → solo "Cerrar" (sin acción
 *                                             destructiva en lectura).
 *   • modo='disparador' + !soloLectura    → solo "Cerrar" (el disparador
 *                                             no se elimina; cambiarlo
 *                                             es responsabilidad del
 *                                             catálogo + sub-PR de tipos).
 *   • modo='disparador' + soloLectura     → solo "Cerrar".
 */

interface Props {
  modo: 'paso' | 'disparador'
  soloLectura: boolean
  onEliminar: () => void
  onCerrar: () => void
  /**
   * En mobile, el BottomSheet provee el cerrar. Si además es modo
   * disparador / lectura (sin "Eliminar paso"), el footer entero se
   * vuelve redundante: lo ocultamos. Sub-PR 19.3d.
   */
  ocultarBotonCerrar?: boolean
}

export default function FooterPanel({
  modo,
  soloLectura,
  onEliminar,
  onCerrar,
  ocultarBotonCerrar = false,
}: Props) {
  const { t } = useTraduccion()
  const mostrarEliminar = modo === 'paso' && !soloLectura

  // En mobile, si tampoco hay botón eliminar, el footer entero queda
  // vacío — lo ocultamos para no robar espacio del cuerpo.
  if (ocultarBotonCerrar && !mostrarEliminar) {
    return null
  }

  return (
    <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-borde-sutil">
      {mostrarEliminar ? (
        <button
          type="button"
          onClick={onEliminar}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 text-sm font-medium rounded-md text-insignia-peligro-texto hover:bg-insignia-peligro-fondo/50 transition-colors cursor-pointer"
        >
          <Trash2 size={14} strokeWidth={1.8} />
          {t('flujos.editor.panel.footer.eliminar_paso')}
        </button>
      ) : (
        <span aria-hidden="true" />
      )}

      {!ocultarBotonCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          className="h-8 px-3 text-sm font-medium rounded-md bg-superficie-tarjeta text-texto-primario border border-borde-sutil hover:border-borde-fuerte hover:bg-superficie-hover transition-colors cursor-pointer"
        >
          {t('comun.cerrar')}
        </button>
      )}
    </div>
  )
}

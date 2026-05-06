'use client'

import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import NombrePasoEditable from './NombrePasoEditable'

/**
 * Header del panel lateral del editor de flujos (sub-PR 19.3a + 19.3b).
 *
 * Layout:
 *   [ícono 36x36] [nombre editable inline / fallback al tipo] [cerrar]
 *
 * 19.3b agrega edición inline del campo `etiqueta?: string` que ahora
 * vive en `AccionBase` y `MetadataUiDisparador`. Si el paso/disparador
 * no tiene etiqueta propia, el header muestra el título legible del
 * tipo (ej: "Enviar WhatsApp"). Click → input editable.
 */

interface Props {
  Icono: LucideIcon | null
  /**
   * Etiqueta actual del paso/disparador. Si está vacía, se muestra
   * `fallbackTitulo` y al editar se inicializa vacío.
   */
  etiqueta?: string | null
  /**
   * Texto a mostrar cuando `etiqueta` está vacío. Es el título legible
   * del tipo (ej: "Enviar WhatsApp"). Caveat: nunca mostrar el `tipo`
   * raw — siempre la etiqueta legible vía `etiquetaAccion` /
   * `etiquetaDisparador`.
   */
  fallbackTitulo: string
  soloLectura: boolean
  onCambiarEtiqueta: (nueva: string) => void
  onCerrar: () => void
}

export default function HeaderPanel({
  Icono,
  etiqueta,
  fallbackTitulo,
  soloLectura,
  onCambiarEtiqueta,
  onCerrar,
}: Props) {
  const { t } = useTraduccion()

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-borde-sutil">
      {Icono && (
        <span
          className="shrink-0 inline-flex items-center justify-center size-9 rounded-md bg-texto-marca/10 text-texto-marca"
          aria-hidden="true"
        >
          <Icono size={18} strokeWidth={1.7} />
        </span>
      )}
      <NombrePasoEditable
        valor={etiqueta}
        fallback={fallbackTitulo}
        onCambiar={onCambiarEtiqueta}
        soloLectura={soloLectura}
      />
      <button
        type="button"
        onClick={onCerrar}
        aria-label={t('comun.cerrar')}
        className="shrink-0 inline-flex items-center justify-center size-8 rounded-md text-texto-terciario hover:bg-superficie-hover hover:text-texto-secundario transition-colors cursor-pointer"
      >
        <X size={16} />
      </button>
    </div>
  )
}

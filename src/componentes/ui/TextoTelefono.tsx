/**
 * TextoTelefono — Display formateado de un número de teléfono.
 *
 * Los teléfonos se guardan en BD normalizados como dígitos puros (ej: "5491156029403"),
 * pero deberían mostrarse al usuario en formato internacional (+54 9 11 5602-9403)
 * para legibilidad. Usar este componente en TODA la UI de solo lectura para
 * consistencia.
 *
 * Para inputs editables, ver TelefonosContacto que maneja el toggle entre raw
 * (al editar) y formato bonito (al perder foco).
 */

import { formatearTelefonoInternacional } from '@/lib/validaciones'

interface Props {
  valor?: string | null
  /** Texto a renderizar cuando el valor es vacío. Si no se pasa, no renderiza nada. */
  fallback?: string
  className?: string
}

export function TextoTelefono({ valor, fallback, className }: Props) {
  if (!valor || !valor.trim()) {
    return fallback ? <span className={className}>{fallback}</span> : null
  }
  const formateado = formatearTelefonoInternacional(valor) || valor
  return <span className={className}>{formateado}</span>
}

/** Versión helper para usar en strings concatenados (ej: title de tooltip). */
export function formatearParaMostrar(valor?: string | null): string {
  if (!valor || !valor.trim()) return ''
  return formatearTelefonoInternacional(valor) || valor
}

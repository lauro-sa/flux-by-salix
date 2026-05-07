'use client'

import { useTraduccion } from '@/lib/i18n'
import { Plus } from 'lucide-react'
import { etiquetaDisparador, descripcionDisparador } from '@/lib/workflows/etiquetas-disparador'
import { iconoDefaultDisparador, iconoLucideFlujo } from '@/lib/workflows/iconos-flujo'
import type { TipoDisparador } from '@/tipos/workflow'

/**
 * Primera tarjeta del canvas: el disparador (§1.6.8 del plan).
 *
 * Diferenciación visual sin romper la metáfora vertical:
 *   • Border-top coloreado (`border-t-2 border-texto-marca`).
 *   • Etiqueta "DISPARADOR" uppercase pequeña arriba.
 *   • Ícono dentro de círculo `bg-texto-marca/10`.
 *
 * Si el flujo no tiene disparador todavía (recién creado desde cero),
 * se renderiza una variante "placeholder" que invita a configurarlo.
 *
 * Click → callback `onSeleccionar`. En 19.2 abre el placeholder del
 * panel; en 19.3 abre el panel real con campos del disparador.
 *
 * Si no hay disparador aún, click → `onElegirDisparador` (abre
 * `CatalogoPasos` en modo `disparador`).
 *
 * El disparador NO es draggable (siempre primero — §1.6.6 del plan).
 */

interface DisparadorRaw {
  tipo?: TipoDisparador
  configuracion?: Record<string, unknown>
}

interface Props {
  disparador: DisparadorRaw | null
  seleccionado: boolean
  soloLectura: boolean
  onSeleccionar: () => void
  onElegirDisparador: () => void
  /** Si el flujo tiene `icono` custom, lo usamos en el círculo en
   *  lugar del default por tipo de disparador. */
  iconoCustom: string | null
  /** Sub-PR 19.4: marker rojo si el disparador tiene errores de
   *  validación tras intento fallido de Publicar/Activar. */
  tieneError?: boolean
  /** Mensaje del error, usado como tooltip nativo. */
  mensajeError?: string
}

export default function TarjetaDisparador({
  disparador,
  seleccionado,
  soloLectura,
  onSeleccionar,
  onElegirDisparador,
  iconoCustom,
  tieneError = false,
  mensajeError,
}: Props) {
  const { t } = useTraduccion()

  const tipo = disparador?.tipo ?? null
  const sinDisparador = !tipo

  const Icono = (() => {
    if (iconoCustom) return iconoLucideFlujo(iconoCustom)
    if (tipo) return iconoDefaultDisparador(tipo)
    return null
  })()

  const titulo = sinDisparador
    ? t('flujos.editor.disparador.placeholder_titulo')
    : etiquetaDisparador(t, tipo)
  const subtitulo = sinDisparador
    ? t('flujos.editor.disparador.placeholder_desc')
    : descripcionDisparador(t, tipo)

  const onClick = sinDisparador && !soloLectura ? onElegirDisparador : onSeleccionar

  return (
    <div
      // `id` HTML para el scroll-to-disparador del banner rojo (19.4).
      id="flujo-disparador"
      title={tieneError ? mensajeError : undefined}
      className={`relative rounded-card border bg-superficie-tarjeta border-t-2 transition-colors ${
        seleccionado ? 'border-texto-marca shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]' : 'border-borde-sutil'
      } ${tieneError ? 'border-l-2 border-l-insignia-peligro-texto' : ''}`}
      style={{ borderTopColor: 'var(--texto-marca)' }}
    >
      {/* Etiqueta uppercase del plan UX */}
      <div className="absolute -top-2.5 left-3 px-1.5 bg-superficie-app">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-texto-marca">
          {t('flujos.editor.disparador.etiqueta')}
        </span>
      </div>

      {/* Marker rojo (19.4): mismo patrón que TarjetaPaso. Visible solo
          tras intento fallido de Publicar/Activar. */}
      {tieneError && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 size-2 rounded-full bg-insignia-peligro-texto ring-2 ring-superficie-app"
        />
      )}

      <button
        type="button"
        onClick={onClick}
        disabled={soloLectura && sinDisparador}
        className="w-full flex items-center gap-3 px-3 pt-4 pb-3 text-left cursor-pointer disabled:cursor-default"
      >
        <span
          className={`shrink-0 inline-flex items-center justify-center size-10 rounded-md bg-texto-marca/10 ${
            sinDisparador ? 'text-texto-terciario' : 'text-texto-marca'
          }`}
          aria-hidden="true"
        >
          {Icono ? <Icono size={18} strokeWidth={1.7} /> : <Plus size={18} strokeWidth={1.7} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-texto-primario truncate">{titulo}</p>
          {subtitulo && (
            <p className="text-xs text-texto-terciario mt-0.5 leading-relaxed line-clamp-2">
              {subtitulo}
            </p>
          )}
        </div>
      </button>
    </div>
  )
}

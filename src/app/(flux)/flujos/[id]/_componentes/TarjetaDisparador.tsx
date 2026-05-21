'use client'

import { useTraduccion } from '@/lib/i18n'
import { Plus, ChevronRight, RefreshCcw } from 'lucide-react'
import { etiquetaDisparador, descripcionDisparador } from '@/lib/workflows/etiquetas-disparador'
import { iconoDefaultDisparador, iconoLucideFlujo } from '@/lib/workflows/iconos-flujo'
import { resumirDisparador } from '@/lib/workflows/resumen-disparador'
import { useAutocompleteRemoto } from './_panel/selectores/useAutocompleteRemoto'
import type { CanalCorreoItem } from './_panel/selectores/SelectorCanalesCorreo'
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
 *
 * Cuando ya hay un disparador configurado:
 *   • 3ra línea con resumen de la config (ej: nombres de cuentas
 *     seleccionadas para `inbox.correo_recibido`).
 *   • Botón "Cambiar" en la esquina superior derecha que reabre el
 *     catálogo. Para los disparadores que requieren resolver IDs a
 *     nombres (canales de correo), refetchamos via el hook cacheado
 *     `useAutocompleteRemoto` — comparte cache con el panel.
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

  // Cargamos canales de correo solo si el disparador los necesita.
  // El hook reusa la cache module-level que también consume
  // SelectorCanalesCorreo en el panel: típicamente 0 fetches extra.
  const urlCanales = tipo === 'inbox.correo_recibido' ? '/api/correo/canales' : null
  const { opciones: canalesCorreo } = useAutocompleteRemoto<CanalCorreoItem>({
    url: urlCanales,
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { canales?: unknown }).canales)
        ? ((raw as { canales: CanalCorreoItem[] }).canales)
        : [],
  })

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
  const resumen = sinDisparador
    ? null
    : resumirDisparador(t, disparador, { canalesCorreo })

  const onClick = sinDisparador && !soloLectura ? onElegirDisparador : onSeleccionar

  // Variante "placeholder" (sinDisparador): mostramos la tarjeta con
  // borde discontinuo + hover marcado + chevron a la derecha y un CTA
  // textual, igual al patrón de "Agregar paso". Sin esos affordances
  // la tarjeta se ve idéntica a una card informativa pasiva y el
  // usuario no entiende que tiene que tocarla.
  return (
    <div
      // `id` HTML para el scroll-to-disparador del banner rojo (19.4).
      id="flujo-disparador"
      title={tieneError ? mensajeError : undefined}
      // Diferenciación sutil del disparador (raíz del árbol):
      //   • Borde marca completo a baja opacidad (no solo top).
      //   • Fondo levemente teñido en el color de marca.
      //   • Glow muy sutil para reforzar la jerarquía sin gritar.
      // Cuando está seleccionado, sube el peso del borde y del glow.
      className={`relative rounded-card border bg-superficie-tarjeta transition-colors ${
        sinDisparador
          ? 'border-dashed border-texto-marca/40 hover:border-texto-marca hover:bg-texto-marca/[0.04]'
          : seleccionado
              ? 'border-texto-marca bg-texto-marca/[0.04] shadow-[0_0_0_3px_rgba(124,75,255,0.08)]'
              : 'border-texto-marca/30 bg-texto-marca/[0.025]'
      } ${tieneError ? 'border-l-2 border-l-insignia-peligro-texto' : ''}`}
    >
      {/* Etiqueta uppercase del plan UX */}
      <div className="absolute -top-2.5 left-3 px-1.5 bg-superficie-app">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-texto-marca">
          {t('flujos.editor.disparador.etiqueta')}
        </span>
      </div>

      {/* Botón "Cambiar" — solo visible cuando ya hay disparador
          configurado y el usuario puede editar. Se posiciona absoluto
          en la esquina superior derecha para no robar protagonismo al
          contenido principal. stopPropagation para no disparar el
          onClick del cuerpo (que abriría el panel). */}
      {!sinDisparador && !soloLectura && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onElegirDisparador()
          }}
          className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-texto-terciario hover:text-texto-secundario hover:bg-white/[0.04] cursor-pointer"
          aria-label={t('flujos.editor.disparador.cta_cambiar')}
        >
          <RefreshCcw size={11} strokeWidth={2} />
          {t('flujos.editor.disparador.cta_cambiar')}
        </button>
      )}

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
        className="group w-full flex items-center gap-3 px-3 pt-4 pb-3 text-left cursor-pointer disabled:cursor-default"
      >
        <span
          className={`shrink-0 inline-flex items-center justify-center size-10 rounded-md ${
            sinDisparador
              ? 'bg-texto-marca/10 text-texto-marca/70 group-hover:text-texto-marca'
              : 'bg-texto-marca/10 text-texto-marca'
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
          {/* Resumen de configuración (3ra línea). Se trunca a 1 línea:
              si hay muchas cuentas el usuario abre el panel para ver
              todas. La distinción visual con `text-texto-secundario`
              (un tono más fuerte que el subtitulo terciario) ayuda a
              que se lea como "info concreta" y no como microcopy. */}
          {resumen && (
            <p className="text-xs text-texto-secundario mt-1 truncate font-medium">
              {resumen}
            </p>
          )}
        </div>
        {/* CTA explícito cuando la tarjeta está vacía: chip + chevron
            que dejan en claro que es clickeable. Se oculta una vez que
            el disparador ya está configurado. */}
        {sinDisparador && !soloLectura && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-texto-marca bg-texto-marca/10 group-hover:bg-texto-marca/15">
            {t('flujos.editor.disparador.cta_elegir')}
            <ChevronRight size={12} strokeWidth={2} />
          </span>
        )}
      </button>
    </div>
  )
}

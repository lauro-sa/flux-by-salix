'use client'

/**
 * Mini-preview lateral de un listado configurable (tipos de evento /
 * actividad, plantillas, respuestas rápidas, etc.) que aparece dentro
 * de las páginas de Configuración del módulo correspondiente.
 *
 * Sirve para que el usuario vea "qué hay ahí dentro" antes de hacer
 * click en el botón que lo lleva a la página de gestión completa.
 * Carga `endpoint` con fetch, aplica `extraerItems` para mapear el
 * payload al shape `ItemPreview`, y muestra hasta `limite` items
 * (default 8). Si hay más, muestra "Ver todos · N".
 *
 * Tonos de origen (chip a la derecha del nombre):
 *   - 'sistema'        → gris fuerte (lo provee Flux y no se borra)
 *   - 'predefinido'    → gris suave (lo provee Flux pero se puede ocultar)
 *   - 'personalizado'  → texto marca (lo creó la empresa)
 *
 * Estados:
 *   - cargando → skeleton con 4 filas pulsantes.
 *   - error    → mensaje con botón Reintentar.
 *   - vacío    → texto desde `textoVacio` + el botón de gestión.
 *   - normal   → lista + footer con link al destino.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'

export type TonoOrigen = 'sistema' | 'predefinido' | 'personalizado' | 'normal'

export interface ItemPreview {
  id: string
  /** Nombre de un ícono Lucide (ej: 'FileText', 'Calendar'). Opcional. */
  icono?: string
  /** Color CSS para el ícono. Acepta tokens (`var(--texto-marca)`) o hex. */
  color?: string
  etiqueta: string
  subEtiqueta?: string
  /** Chips pequeños a la derecha de la fila (módulos, duración, etc.). */
  badges?: { texto: string }[]
  /** Chip de origen al final de la fila. */
  origen?: { texto: string; tono: TonoOrigen }
}

interface Props {
  titulo: string
  descripcion?: string
  endpoint: string
  extraerItems: (data: unknown) => ItemPreview[]
  hrefDestino: string
  textoBoton: string
  etiquetaItem: { singular: string; plural: string }
  textoVacio: { titulo: string; descripcion?: string }
  /** Cantidad máxima de items en el preview. Default: 8. */
  limite?: number
}

const TONOS: Record<TonoOrigen, string> = {
  sistema:
    'bg-borde-fuerte/15 text-texto-secundario border-borde-fuerte/30',
  predefinido:
    'bg-borde-sutil/40 text-texto-terciario border-borde-sutil',
  personalizado:
    'bg-texto-marca/10 text-texto-marca border-texto-marca/30',
  // Origen neutro (ej. canales WhatsApp donde 'normal' significa
  // "configurado por la empresa, sin marca especial").
  normal:
    'bg-superficie-app text-texto-terciario border-borde-sutil/60',
}

export function PreviewSeccionExterna({
  titulo,
  descripcion,
  endpoint,
  extraerItems,
  hrefDestino,
  textoBoton,
  etiquetaItem,
  textoVacio,
  limite = 8,
}: Props) {
  const [items, setItems] = useState<ItemPreview[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(endpoint)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string })?.error || `Error ${res.status}`)
      }
      const data = await res.json()
      setItems(extraerItems(data))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar')
    } finally {
      setCargando(false)
    }
  }, [endpoint, extraerItems])

  useEffect(() => {
    cargar()
  }, [cargar])

  const total = items.length
  const visibles = items.slice(0, limite)
  const hayMas = total > limite
  const conteo = total === 1 ? `1 ${etiquetaItem.singular}` : `${total} ${etiquetaItem.plural}`

  return (
    <section className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-5 space-y-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-texto-primario">{titulo}</h3>
          {descripcion && (
            <p className="mt-1 text-sm text-texto-terciario">{descripcion}</p>
          )}
        </div>
        {!cargando && !error && total > 0 && (
          <span className="shrink-0 text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
            {conteo}
          </span>
        )}
      </div>

      {/* Cuerpo */}
      {cargando ? (
        <ul className="space-y-2" role="status" aria-label="Cargando">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-12 rounded-md bg-superficie-app animate-pulse" />
          ))}
        </ul>
      ) : error ? (
        <div className="rounded-md border border-insignia-peligro/30 bg-insignia-peligro/5 px-3 py-3 flex items-start gap-2">
          <AlertCircle size={14} className="text-insignia-peligro mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-insignia-peligro">{error}</p>
            <button
              type="button"
              onClick={cargar}
              className="mt-1 text-[11px] font-semibold text-insignia-peligro hover:opacity-80"
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : total === 0 ? (
        <div className="rounded-md border border-dashed border-borde-sutil bg-superficie-app px-4 py-6 text-center">
          <p className="text-sm font-medium text-texto-secundario">{textoVacio.titulo}</p>
          {textoVacio.descripcion && (
            <p className="mt-1 text-xs text-texto-terciario">{textoVacio.descripcion}</p>
          )}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {visibles.map(item => (
            <FilaItem key={item.id} item={item} />
          ))}
          {hayMas && (
            <li className="px-2 py-1 text-[11px] text-texto-terciario">
              + {total - limite} {total - limite === 1 ? etiquetaItem.singular : etiquetaItem.plural} más
            </li>
          )}
        </ul>
      )}

      {/* Footer con link de gestión */}
      <Link
        href={hrefDestino}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-texto-marca hover:opacity-80"
      >
        {textoBoton}
        <ArrowRight size={14} />
      </Link>
    </section>
  )
}

function FilaItem({ item }: { item: ItemPreview }) {
  const Icono = item.icono ? obtenerIcono(item.icono) : null

  return (
    <li className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-superficie-hover transition-colors">
      {/* Bolita con ícono */}
      <span
        className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: item.color ? `${item.color}22` : 'var(--borde-sutil)' }}
      >
        {Icono ? (
          <Icono size={14} className="text-texto-primario" />
        ) : (
          <span className="size-2 rounded-full" style={{ backgroundColor: item.color || 'var(--texto-terciario)' }} />
        )}
      </span>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-texto-primario truncate">{item.etiqueta}</p>
        {item.subEtiqueta && (
          <p className="text-[11px] text-texto-terciario truncate">{item.subEtiqueta}</p>
        )}
      </div>

      {/* Badges */}
      {item.badges && item.badges.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {item.badges.map((b, i) => (
            <span
              key={i}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-borde-sutil/30 text-texto-terciario"
            >
              {b.texto}
            </span>
          ))}
        </div>
      )}

      {/* Origen */}
      {item.origen && (
        <span
          className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TONOS[item.origen.tono]}`}
        >
          {item.origen.texto}
        </span>
      )}
    </li>
  )
}

/** Helper que un caller puede usar mientras espera (loading state opcional). */
export function SkeletonPreviewSeccionExterna() {
  return (
    <section className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-5 space-y-4">
      <div className="h-5 w-40 bg-superficie-app rounded animate-pulse" />
      <div className="h-3 w-64 bg-superficie-app rounded animate-pulse" />
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="h-12 rounded-md bg-superficie-app animate-pulse" />
        ))}
      </ul>
      <div className="flex items-center gap-2 text-texto-terciario">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs">Cargando…</span>
      </div>
    </section>
  )
}

export default PreviewSeccionExterna

'use client'

/**
 * HistorialEstados — Timeline visual de cambios de estado de una entidad.
 *
 * Lee de `cambios_estado` (vía useHistorialEstados) y renderiza un timeline
 * compacto con:
 *   - Bolita de color del estado nuevo
 *   - "Usuario" + verbo + "Estado A → Estado B"
 *   - Tiempo relativo
 *   - Origen (manual/sistema/workflow/etc) como tag
 *   - Motivo si está presente
 *
 * Funciona automáticamente con cualquier entidad que esté conectada al
 * sistema genérico de estados (cuotas, conversaciones, etc.). Si la entidad
 * no está soportada o no tiene historial, devuelve null silenciosamente.
 *
 * Uso:
 *   <HistorialEstados entidadTipo="conversacion" entidadId={conversacion.id} />
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, History, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHistorialEstados, type ItemHistorialEstado } from '@/hooks/useHistorialEstados'
import { fechaRelativa, fechaCompleta } from './_panel_chatter/constantes'
import { useFormato } from '@/hooks/useFormato'
import type { EntidadConEstado, OrigenCambioEstado } from '@/tipos/estados'

interface Props {
  entidadTipo: EntidadConEstado
  entidadId: string
  /** Mostrar inicialmente colapsado (true) o expandido (false). Default: true. */
  inicialColapsado?: boolean
  /** Cantidad de items a mostrar antes de "Ver todos". Default: 5. */
  limiteVisible?: number
  className?: string
}

const ETIQUETAS_ORIGEN: Record<OrigenCambioEstado, string> = {
  manual:   'Manual',
  sistema:  'Sistema',
  workflow: 'Automatización',
  api:      'API',
  webhook:  'Webhook',
  cron:     'Programado',
}

export function HistorialEstados({
  entidadTipo,
  entidadId,
  inicialColapsado = true,
  limiteVisible = 5,
  className = '',
}: Props) {
  const { data: historial = [], isLoading } = useHistorialEstados(entidadTipo, entidadId)
  const { formatoHora, locale } = useFormato()
  const [expandido, setExpandido] = useState(!inicialColapsado)
  const [mostrarTodos, setMostrarTodos] = useState(false)

  // No mostrar nada si no hay historial (ej: entidad recién creada sin cambios)
  if (!isLoading && historial.length === 0) return null

  const itemsAMostrar = mostrarTodos ? historial : historial.slice(0, limiteVisible)
  const hayMas = historial.length > limiteVisible

  return (
    <div className={`rounded-card border border-borde-sutil bg-superficie-tarjeta ${className}`}>
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <History size={14} className="text-texto-terciario" />
          <span className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
            Historial de estados
          </span>
          {historial.length > 0 && (
            <span className="text-xs text-texto-terciario">
              · {historial.length}
            </span>
          )}
        </div>
        {expandido ? (
          <ChevronUp size={14} className="text-texto-terciario" />
        ) : (
          <ChevronDown size={14} className="text-texto-terciario" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-white/[0.06]">
              {isLoading && historial.length === 0 ? (
                <div className="px-4 py-3 text-xs text-texto-terciario">Cargando…</div>
              ) : (
                <ol className="divide-y divide-white/[0.05]">
                  {itemsAMostrar.map(item => (
                    <ItemTimeline
                      key={item.id}
                      item={item}
                      formatoHora={formatoHora}
                      locale={locale}
                    />
                  ))}
                </ol>
              )}

              {hayMas && (
                <div className="px-4 py-2 border-t border-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => setMostrarTodos(v => !v)}
                    className="text-xs text-texto-marca hover:underline"
                  >
                    {mostrarTodos
                      ? 'Mostrar solo recientes'
                      : `Ver los ${historial.length - limiteVisible} más antiguos`}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface PropsItem {
  item: ItemHistorialEstado
  formatoHora: string
  locale: string
}

function ItemTimeline({ item, formatoHora, locale }: PropsItem) {
  const cuandoCorto = fechaRelativa(item.creado_en, formatoHora, locale)
  const cuandoCompleto = fechaCompleta(item.creado_en, formatoHora, locale)
  const colorBolita = item.color_nuevo || '#6b7280'
  const usuario = item.usuario_nombre?.trim() || (item.origen === 'manual' ? 'Usuario' : null)

  // Texto principal: "[Usuario] cambió a [Etiqueta]" o "[Sistema] marcó como [Etiqueta]"
  const verbo = item.estado_anterior ? 'cambió a' : 'creó como'

  return (
    <li className="px-4 py-2.5 flex items-start gap-3">
      {/* Bolita de color */}
      <div
        className="size-2 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: colorBolita }}
      />

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap text-xs">
          {usuario && (
            <span className="font-medium text-texto-primario">{usuario}</span>
          )}
          <span className="text-texto-secundario">{verbo}</span>
          <span className="font-medium text-texto-primario">{item.etiqueta_nuevo}</span>

          {item.estado_anterior && (
            <>
              <span className="text-texto-terciario inline-flex items-center gap-1">
                <ArrowRight size={11} />
              </span>
              <span className="text-texto-terciario line-through">
                {item.etiqueta_anterior}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <time
            className="text-[11px] text-texto-terciario"
            title={cuandoCompleto}
          >
            {cuandoCorto}
          </time>

          {item.origen !== 'manual' && (
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] text-texto-terciario"
              title={`Origen: ${ETIQUETAS_ORIGEN[item.origen] ?? item.origen}`}
            >
              {ETIQUETAS_ORIGEN[item.origen] ?? item.origen}
            </span>
          )}
        </div>

        {item.motivo && (
          <div className="mt-1 text-xs text-texto-secundario italic">
            “{item.motivo}”
          </div>
        )}
      </div>
    </li>
  )
}

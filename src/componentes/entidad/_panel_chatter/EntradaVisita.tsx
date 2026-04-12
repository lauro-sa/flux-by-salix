'use client'

/**
 * EntradaVisita — Bloque visual de visita completada en el chatter.
 * Muestra resultado, notas, checklist, fotos, temperatura, dirección y duración.
 * Botón "Ver detalle" abre ModalDetalleVisita con toda la info expandida.
 * Se usa en: EntradaTimeline (cuando tipo === 'visita').
 */

import { useState } from 'react'
import Image from 'next/image'
import {
  MapPin, Clock, Thermometer, CheckSquare, Square,
  ImageIcon, ChevronRight, Navigation, CalendarClock,
} from 'lucide-react'
import type { EntradaChatter, AdjuntoChatter } from '@/tipos/chatter'
import { fechaRelativa, fechaCompleta } from './constantes'
import { ModalDetalleVisita } from './ModalDetalleVisita'

// ─── Colores de temperatura ───
const COLORES_TEMPERATURA: Record<string, { bg: string; texto: string; etiqueta: string }> = {
  frio: { bg: 'bg-insignia-info-fondo', texto: 'text-insignia-info', etiqueta: 'Frío' },
  tibio: { bg: 'bg-insignia-advertencia-fondo', texto: 'text-insignia-advertencia', etiqueta: 'Tibio' },
  caliente: { bg: 'bg-insignia-peligro-fondo', texto: 'text-insignia-peligro', etiqueta: 'Caliente' },
}

// ─── Galería compacta de fotos (max 4 thumbnails) ───
function GaleriaCompacta({ adjuntos }: { adjuntos: AdjuntoChatter[] }) {
  const fotos = adjuntos.filter(a => a.tipo?.startsWith('image/'))
  if (!fotos.length) return null

  const visibles = fotos.slice(0, 4)
  const restantes = fotos.length - 4

  return (
    <div className="flex gap-1.5 mt-2">
      {visibles.map((foto, i) => (
        <a
          key={i}
          href={foto.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative size-14 rounded-md overflow-hidden border border-white/[0.06] hover:border-texto-marca/40 transition-colors"
        >
          <Image
            src={foto.url}
            alt={foto.nombre}
            fill
            sizes="56px"
            className="object-cover"
          />
          {/* Mostrar "+N más" sobre la última miniatura visible */}
          {i === 3 && restantes > 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-xs font-semibold text-white">+{restantes}</span>
            </div>
          )}
        </a>
      ))}
    </div>
  )
}

// ─── Componente principal ───
export function EntradaVisita({
  entrada,
  formatoHora,
  locale,
}: {
  entrada: EntradaChatter
  formatoHora: string
  locale: string
}) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const m = entrada.metadata

  const resultado = m?.visita_resultado
  const notas = m?.visita_notas
  const temperatura = m?.visita_temperatura
  const checklist = m?.visita_checklist || []
  const direccion = m?.visita_direccion
  const duracionReal = m?.visita_duracion_real
  const duracionEstimada = m?.visita_duracion_estimada
  const fechaCompletada = m?.visita_fecha_completada

  const completados = checklist.filter(i => i.completado).length
  const totalChecklist = checklist.length
  const tempConfig = temperatura ? COLORES_TEMPERATURA[temperatura] : null

  const fotos = entrada.adjuntos?.filter(a => a.tipo?.startsWith('image/')) || []

  return (
    <>
      <div className="rounded-lg border-l-[3px] border-l-texto-marca border border-texto-marca/15 bg-texto-marca/[0.04] overflow-hidden my-1">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5">
          <div className="flex items-center justify-center size-7 rounded-full bg-texto-marca/10 text-texto-marca shrink-0">
            <MapPin size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-texto-primario">Visita completada</span>
              {tempConfig && (
                <span className={`text-xxs px-1.5 py-px rounded-full font-medium ${tempConfig.bg} ${tempConfig.texto}`}>
                  {tempConfig.etiqueta}
                </span>
              )}
            </div>
            <p className="text-xxs text-texto-terciario mt-0.5">
              {entrada.autor_nombre}
              {fechaCompletada && (
                <> · <span title={fechaCompleta(fechaCompletada, formatoHora, locale)}>{fechaRelativa(fechaCompletada, formatoHora, locale)}</span></>
              )}
            </p>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="px-3 pl-[52px] pb-2 space-y-1.5">
          {/* Resultado */}
          {resultado && (
            <p className="text-sm text-texto-secundario leading-relaxed">{resultado}</p>
          )}

          {/* Notas */}
          {notas && notas !== resultado && (
            <p className="text-xs text-texto-terciario italic">{notas}</p>
          )}

          {/* Checklist resumen */}
          {totalChecklist > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xxs text-texto-terciario flex items-center gap-1">
                <CheckSquare size={10} className="text-insignia-exito" />
                {completados}/{totalChecklist} completados
              </span>
              {/* Mostrar items inline */}
              <div className="flex flex-wrap gap-1">
                {checklist.slice(0, 4).map(item => (
                  <span
                    key={item.id}
                    className={`inline-flex items-center gap-0.5 text-xxs px-1.5 py-px rounded ${
                      item.completado
                        ? 'bg-insignia-exito/10 text-insignia-exito line-through'
                        : 'bg-superficie-hover text-texto-terciario'
                    }`}
                  >
                    {item.completado ? <CheckSquare size={8} /> : <Square size={8} />}
                    {item.texto}
                  </span>
                ))}
                {totalChecklist > 4 && (
                  <span className="text-xxs text-texto-terciario">+{totalChecklist - 4} más</span>
                )}
              </div>
            </div>
          )}

          {/* Dirección y duración — fila compacta */}
          <div className="flex flex-wrap items-center gap-3 text-xxs text-texto-terciario">
            {direccion && (
              <span className="flex items-center gap-1">
                <Navigation size={10} />
                <span className="truncate max-w-[200px]">{direccion}</span>
              </span>
            )}
            {duracionReal != null && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {duracionReal} min
                {duracionEstimada != null && (
                  <span className="text-texto-terciario/60">/ {duracionEstimada} est.</span>
                )}
              </span>
            )}
          </div>

          {/* Fotos — galería compacta */}
          {fotos.length > 0 && <GaleriaCompacta adjuntos={entrada.adjuntos} />}

          {/* Adjuntos no-imagen */}
          {entrada.adjuntos?.filter(a => !a.tipo?.startsWith('image/')).length > 0 && (
            <div className="flex items-center gap-1 text-xxs text-texto-terciario mt-1">
              <ImageIcon size={10} />
              {entrada.adjuntos.filter(a => !a.tipo?.startsWith('image/')).length} archivo(s) adjunto(s)
            </div>
          )}
        </div>

        {/* Footer — botón ver detalle */}
        <button
          onClick={() => setModalAbierto(true)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-texto-marca border-t border-texto-marca/10 hover:bg-texto-marca/[0.06] transition-colors"
        >
          Ver detalle
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Modal de detalle expandido */}
      <ModalDetalleVisita
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        entrada={entrada}
      />
    </>
  )
}

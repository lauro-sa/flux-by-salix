'use client'

/**
 * TarjetaParada — Línea de tiempo vertical centrada.
 * Siempre visible: nodo discreto + nombre + dirección + hora.
 * Expandible: solo si está seleccionada o activa (en_camino/en_sitio).
 * Permite: cancelar, reactivar, volver a programada desde en_camino.
 * Se usa en: ListaParadas.
 */

import { Navigation, Check, X, MessageSquare, RotateCcw, Pencil } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { abrirNavegacion } from '@/componentes/mapa/utilidades-mapa'

type EstadoVisita = 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada' | 'reprogramada'

interface Visita {
  id: string
  contacto_nombre: string
  contacto_telefono: string | null
  direccion_texto: string
  direccion_lat: number | null
  direccion_lng: number | null
  estado: EstadoVisita
  motivo: string | null
  prioridad: string | null
  checklist: unknown[] | null
  notas: string | null
  fecha_programada: string | null
  duracion_estimada_min: number | null
  // Contacto de recepción
  recibe_nombre: string | null
  recibe_telefono: string | null
  recibe_contacto_id: string | null
}

interface PropiedadesTarjetaParada {
  orden: number
  visita: Visita
  esActual: boolean
  seleccionada: boolean
  onSeleccionar: () => void
  onCambiarEstado: (visitaId: string, estado: EstadoVisita) => void
  onRegistrar: (visitaId: string) => void
  onEditar: (visitaId: string) => void
  esUltima: boolean
  otraEnCurso: boolean
}

const COLORES_ESTADO: Record<EstadoVisita, string> = {
  programada: 'var(--texto-terciario)',
  en_camino: 'var(--insignia-info)',
  en_sitio: 'var(--insignia-info)',
  completada: 'var(--insignia-exito)',
  cancelada: 'var(--insignia-peligro)',
  reprogramada: 'var(--insignia-advertencia)',
}

function TarjetaParada({
  orden,
  visita,
  esActual,
  seleccionada,
  onSeleccionar,
  onCambiarEstado,
  onRegistrar,
  onEditar,
  esUltima,
  otraEnCurso,
}: PropiedadesTarjetaParada) {
  const { t } = useTraduccion()
  const formato = useFormato()

  const estado = visita.estado as EstadoVisita
  const colorEstado = COLORES_ESTADO[estado]
  const esCompletada = estado === 'completada'
  const esCancelada = estado === 'cancelada'
  const tieneCoords = visita.direccion_lat != null && visita.direccion_lng != null
  const estaActiva = estado === 'en_camino' || estado === 'en_sitio'
  const bloqueada = otraEnCurso && !estaActiva && estado === 'programada'
  const expandida = seleccionada || estaActiva

  return (
    <div className="flex flex-col items-center">
      {/* Línea arriba */}
      <div className="w-px h-4" style={{ backgroundColor: 'var(--borde-sutil)' }} />

      {/* Nodo discreto */}
      <button
        onClick={onSeleccionar}
        className={[
          'flex items-center justify-center rounded-full shrink-0 transition-all border',
          esActual || estaActiva ? 'size-7' : 'size-6',
          esCompletada ? 'border-[var(--insignia-exito)]/40 bg-[var(--insignia-exito)]/15'
            : esCancelada ? 'border-[var(--insignia-peligro)]/40 bg-[var(--insignia-peligro)]/15'
            : estaActiva ? 'border-[var(--insignia-info)]/40 bg-[var(--insignia-info)]/15'
            : 'border-borde-sutil bg-superficie-elevada',
        ].join(' ')}
      >
        {esCompletada ? <Check size={11} strokeWidth={3} style={{ color: colorEstado }} /> : (
          esCancelada ? <X size={11} strokeWidth={3} style={{ color: colorEstado }} /> : (
            <span className="text-[10px] font-semibold" style={{ color: estaActiva ? colorEstado : 'var(--texto-terciario)' }}>
              {orden}
            </span>
          )
        )}
      </button>

      {/* Línea debajo del nodo */}
      <div className="w-px h-2" style={{ backgroundColor: 'var(--borde-sutil)' }} />

      {/* Info siempre visible */}
      <button
        onClick={onSeleccionar}
        className={[
          'w-full text-center px-6 py-1.5 transition-colors rounded-lg',
          expandida ? '' : 'hover:bg-superficie-elevada/30',
          esCancelada ? 'opacity-40' : '',
        ].join(' ')}
      >
        <div className="flex items-center justify-center gap-2">
          <p className={`text-sm font-medium text-texto-primario ${esCancelada ? 'line-through' : ''}`}>
            {visita.contacto_nombre || visita.direccion_texto}
          </p>
          {visita.fecha_programada && (
            <span className="text-[11px] text-texto-terciario tabular-nums">
              {formato.hora(visita.fecha_programada)}
            </span>
          )}
        </div>
        {visita.contacto_nombre && visita.direccion_texto && (
          <p className="text-xs text-texto-terciario mt-0.5">{visita.direccion_texto}</p>
        )}
        {estado !== 'programada' && (
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <div className="size-1.5 rounded-full" style={{ backgroundColor: colorEstado }} />
            <span className="text-[11px]" style={{ color: colorEstado }}>
              {estado === 'en_camino' ? t('recorrido.en_camino')
                : estado === 'en_sitio' ? 'En sitio'
                : estado === 'completada' ? t('recorrido.estados.completado')
                : estado === 'cancelada' ? 'Cancelada'
                : 'Reprogramada'}
            </span>
          </div>
        )}
      </button>

      {/* Panel expandible */}
      <AnimatePresence>
        {expandida && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full overflow-hidden"
          >
            <div className="px-4 pt-2 pb-1">
              {/* Notas */}
              {visita.notas && (
                <div className="flex items-start gap-2 mb-2 px-2">
                  <MessageSquare size={12} className="text-texto-terciario shrink-0 mt-0.5" />
                  <p className="text-xs text-texto-secundario leading-relaxed">{visita.notas}</p>
                </div>
              )}

              {/* ── Botones según estado ── */}

              {/* PROGRAMADA — puede iniciar (si no hay otra en curso) o cancelar */}
              {estado === 'programada' && !bloqueada && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => tieneCoords && abrirNavegacion({ lat: visita.direccion_lat!, lng: visita.direccion_lng! })}
                    disabled={!tieneCoords}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all disabled:opacity-30"
                  >
                    <Navigation size={16} className="text-[var(--insignia-info)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">Navegar</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(visita.id, 'cancelada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <X size={16} className="text-[var(--insignia-peligro)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('comun.cancelar')}</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(visita.id, 'en_camino')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <Check size={16} className="text-[var(--insignia-exito)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('recorrido.en_camino')}</span>
                  </button>
                </div>
              )}

              {/* PROGRAMADA BLOQUEADA — solo navegar */}
              {estado === 'programada' && bloqueada && tieneCoords && (
                <button
                  onClick={() => abrirNavegacion({ lat: visita.direccion_lat!, lng: visita.direccion_lng! })}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-borde-sutil text-xs text-texto-terciario hover:bg-superficie-elevada transition-colors"
                >
                  <Navigation size={13} className="text-[var(--insignia-info)]" />
                  <span>Ver en mapa</span>
                </button>
              )}

              {/* EN CAMINO — puede llegar, cancelar, o volver a programada */}
              {estado === 'en_camino' && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onCambiarEstado(visita.id, 'programada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <RotateCcw size={16} className="text-texto-terciario" />
                    <span className="text-[10px] font-medium text-texto-secundario">Deshacer</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(visita.id, 'cancelada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <X size={16} className="text-[var(--insignia-peligro)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('comun.cancelar')}</span>
                  </button>
                  <button
                    onClick={() => onRegistrar(visita.id)}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <Check size={16} className="text-[var(--insignia-exito)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('recorrido.llegue')}</span>
                  </button>
                </div>
              )}

              {/* EN SITIO — completar, agregar info, cancelar, deshacer */}
              {estado === 'en_sitio' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onEditar(visita.id)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                    >
                      <Pencil size={14} className="text-texto-marca" />
                      <span className="text-[11px] font-medium text-texto-secundario">Agregar info</span>
                    </button>
                    <button
                      onClick={() => onRegistrar(visita.id)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                    >
                      <Check size={14} className="text-[var(--insignia-exito)]" />
                      <span className="text-[11px] font-medium text-texto-secundario">Completar</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onCambiarEstado(visita.id, 'programada')}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium text-texto-terciario hover:bg-superficie-elevada transition-colors"
                    >
                      <RotateCcw size={12} />
                      <span>Deshacer</span>
                    </button>
                    <button
                      onClick={() => onCambiarEstado(visita.id, 'cancelada')}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium text-texto-terciario hover:bg-superficie-elevada transition-colors"
                    >
                      <X size={12} />
                      <span>{t('comun.cancelar')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CANCELADA — reactivar */}
              {esCancelada && (
                <button
                  onClick={() => onCambiarEstado(visita.id, 'programada')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all text-xs font-medium text-texto-secundario"
                >
                  <RotateCcw size={14} className="text-texto-marca" />
                  <span>Reactivar parada</span>
                </button>
              )}

              {/* COMPLETADA — editar registro o reabrir */}
              {esCompletada && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onEditar(visita.id)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all text-xs font-medium text-texto-secundario"
                  >
                    <Pencil size={14} className="text-texto-marca" />
                    <span>Editar registro</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(visita.id, 'programada')}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all text-xs font-medium text-texto-secundario"
                  >
                    <RotateCcw size={14} className="text-texto-terciario" />
                    <span>Reabrir</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Línea final */}
      {!esUltima && (
        <div className="w-px h-2" style={{ backgroundColor: 'var(--borde-sutil)' }} />
      )}
    </div>
  )
}

export { TarjetaParada, type EstadoVisita, type Visita }

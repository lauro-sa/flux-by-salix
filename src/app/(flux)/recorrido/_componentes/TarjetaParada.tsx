'use client'

/**
 * TarjetaParada — Línea de tiempo vertical centrada.
 *
 * Soporta dos tipos de parada:
 *  - tipo='visita': Visita real a un contacto. Tiene checklist/notas/registro con fotos.
 *    Flujo completo: programada → en_camino → en_sitio → completada.
 *  - tipo='parada': Parada genérica (café, combustible, depósito, etc.) que NO
 *    cuenta como visita al cliente. Sin registro con fotos, sin "llegué".
 *    Flujo simplificado: programada → en_camino → completada/cancelada.
 *
 * Siempre visible: nodo discreto + título + dirección + hora.
 * Expandible: solo si está seleccionada o activa (en_camino/en_sitio).
 * Se usa en: ListaParadas.
 */

import { Navigation, Check, X, MessageSquare, RotateCcw, Pencil, Coffee, Trash2 } from 'lucide-react'
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
  fecha_inicio?: string | null // timestamp cuando arrancó el trayecto
  fecha_llegada?: string | null // timestamp cuando llegó al sitio
  fecha_completada?: string | null // timestamp cuando se completó la visita
  duracion_estimada_min: number | null
  recibe_nombre: string | null
  recibe_telefono: string | null
  recibe_contacto_id: string | null
}

interface Parada {
  id: string
  orden: number
  tipo: 'visita' | 'parada'
  visita: Visita | null
  titulo?: string | null
  motivo?: string | null
  direccion_texto?: string | null
  direccion_lat?: number | null
  direccion_lng?: number | null
  contacto_nombre?: string | null
  estado?: string | null
  distancia_km: number | null
  duracion_viaje_min: number | null
}

interface PropiedadesTarjetaParada {
  orden: number
  parada: Parada
  esActual: boolean
  seleccionada: boolean
  onSeleccionar: () => void
  /** Cambia estado. Recibe parada_id (id universal de recorrido_paradas). */
  onCambiarEstado: (paradaId: string, estado: EstadoVisita) => void
  /** Solo paradas tipo 'visita'. Recibe visita_id (legacy, para registro con fotos). */
  onRegistrar: (visitaId: string) => void
  /** Solo paradas tipo 'visita'. Recibe visita_id. */
  onEditar: (visitaId: string) => void
  /** Eliminar una parada genérica del recorrido. */
  onQuitar?: (paradaId: string) => void
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
  parada,
  esActual,
  seleccionada,
  onSeleccionar,
  onCambiarEstado,
  onRegistrar,
  onEditar,
  onQuitar,
  esUltima,
  otraEnCurso,
}: PropiedadesTarjetaParada) {
  const { t } = useTraduccion()
  const formato = useFormato()

  const esGenerica = parada.tipo === 'parada'
  const v = parada.visita

  // Datos derivados (universal)
  const titulo = esGenerica
    ? (parada.titulo || 'Parada')
    : (v?.contacto_nombre || v?.direccion_texto || 'Sin contacto')
  const direccionTexto = esGenerica
    ? (parada.direccion_texto || null)
    : (v?.direccion_texto || null)
  const direccionLat = esGenerica ? parada.direccion_lat : v?.direccion_lat
  const direccionLng = esGenerica ? parada.direccion_lng : v?.direccion_lng
  const estado = (esGenerica ? (parada.estado || 'programada') : (v?.estado || 'programada')) as EstadoVisita
  const notas = esGenerica ? (parada.motivo || null) : (v?.notas || null)
  const hora = !esGenerica && v?.fecha_programada ? formato.hora(v.fecha_programada) : null

  const colorEstado = COLORES_ESTADO[estado]
  const esCompletada = estado === 'completada'
  const esCancelada = estado === 'cancelada'
  const tieneCoords = direccionLat != null && direccionLng != null
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
            esGenerica
              ? <Coffee size={11} className="text-texto-terciario" />
              : (
                <span className="text-[10px] font-semibold" style={{ color: estaActiva ? colorEstado : 'var(--texto-terciario)' }}>
                  {orden}
                </span>
              )
          )
        )}
      </button>

      {/* Línea debajo del nodo */}
      <div className="w-px h-2" style={{ backgroundColor: 'var(--borde-sutil)' }} />

      {/* Info siempre visible */}
      <button
        onClick={onSeleccionar}
        className={[
          'w-full text-center px-6 py-1.5 transition-colors rounded-boton',
          expandida ? '' : 'hover:bg-superficie-elevada/30',
          esCancelada ? 'opacity-40' : '',
        ].join(' ')}
      >
        <div className="flex items-center justify-center gap-2">
          <p className={`text-sm font-medium text-texto-primario ${esCancelada ? 'line-through' : ''}`}>
            {titulo}
          </p>
          {esGenerica && (
            <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-texto-terciario">
              parada
            </span>
          )}
          {hora && (
            <span className="text-[11px] text-texto-terciario tabular-nums">
              {hora}
            </span>
          )}
        </div>
        {direccionTexto && (esGenerica || v?.contacto_nombre) && (
          <p className="text-xs text-texto-terciario mt-0.5">{direccionTexto}</p>
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
              {/* Notas / motivo */}
              {notas && (
                <div className="flex items-start gap-2 mb-2 px-2">
                  <MessageSquare size={12} className="text-texto-terciario shrink-0 mt-0.5" />
                  <p className="text-xs text-texto-secundario leading-relaxed">{notas}</p>
                </div>
              )}

              {/* ── PARADA GENÉRICA — acciones simplificadas ── */}
              {esGenerica && estado === 'programada' && !bloqueada && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => tieneCoords && abrirNavegacion({ lat: direccionLat!, lng: direccionLng! })}
                    disabled={!tieneCoords}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all disabled:opacity-30"
                  >
                    <Navigation size={16} className="text-[var(--insignia-info)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">Navegar</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'cancelada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <X size={16} className="text-[var(--insignia-peligro)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('comun.cancelar')}</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'en_camino')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <Check size={16} className="text-[var(--insignia-exito)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('recorrido.en_camino')}</span>
                  </button>
                </div>
              )}

              {esGenerica && estado === 'programada' && bloqueada && tieneCoords && (
                <button
                  onClick={() => abrirNavegacion({ lat: direccionLat!, lng: direccionLng! })}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-card border border-borde-sutil text-xs text-texto-terciario hover:bg-superficie-elevada transition-colors"
                >
                  <Navigation size={13} className="text-[var(--insignia-info)]" />
                  <span>Ver en mapa</span>
                </button>
              )}

              {esGenerica && estado === 'en_camino' && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'programada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <RotateCcw size={16} className="text-texto-terciario" />
                    <span className="text-[10px] font-medium text-texto-secundario">Deshacer</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'cancelada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <X size={16} className="text-[var(--insignia-peligro)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('comun.cancelar')}</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'completada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-[var(--insignia-exito)]/30 bg-[var(--insignia-exito)]/10 hover:bg-[var(--insignia-exito)]/20 transition-all"
                  >
                    <Check size={16} className="text-[var(--insignia-exito)]" />
                    <span className="text-[10px] font-medium text-[var(--insignia-exito)]">Completada</span>
                  </button>
                </div>
              )}

              {esGenerica && esCancelada && (
                <button
                  onClick={() => onCambiarEstado(parada.id, 'programada')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all text-xs font-medium text-texto-secundario"
                >
                  <RotateCcw size={14} className="text-texto-marca" />
                  <span>Reactivar parada</span>
                </button>
              )}

              {esGenerica && esCompletada && (
                <button
                  onClick={() => onCambiarEstado(parada.id, 'programada')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all text-xs font-medium text-texto-secundario"
                >
                  <RotateCcw size={14} className="text-texto-terciario" />
                  <span>Reabrir</span>
                </button>
              )}

              {esGenerica && onQuitar && (esCancelada || estado === 'programada' || esCompletada) && (
                <button
                  onClick={() => onQuitar(parada.id)}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-card text-[11px] font-medium text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro/5 transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Eliminar parada</span>
                </button>
              )}

              {/* ── PARADA TIPO VISITA — flujo original ── */}
              {!esGenerica && estado === 'programada' && !bloqueada && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => tieneCoords && abrirNavegacion({ lat: direccionLat!, lng: direccionLng! })}
                    disabled={!tieneCoords}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all disabled:opacity-30"
                  >
                    <Navigation size={16} className="text-[var(--insignia-info)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">Navegar</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'cancelada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <X size={16} className="text-[var(--insignia-peligro)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('comun.cancelar')}</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'en_camino')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <Check size={16} className="text-[var(--insignia-exito)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('recorrido.en_camino')}</span>
                  </button>
                </div>
              )}

              {!esGenerica && estado === 'programada' && bloqueada && tieneCoords && (
                <button
                  onClick={() => abrirNavegacion({ lat: direccionLat!, lng: direccionLng! })}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-card border border-borde-sutil text-xs text-texto-terciario hover:bg-superficie-elevada transition-colors"
                >
                  <Navigation size={13} className="text-[var(--insignia-info)]" />
                  <span>Ver en mapa</span>
                </button>
              )}

              {!esGenerica && estado === 'en_camino' && v && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'programada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <RotateCcw size={16} className="text-texto-terciario" />
                    <span className="text-[10px] font-medium text-texto-secundario">Deshacer</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'cancelada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <X size={16} className="text-[var(--insignia-peligro)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('comun.cancelar')}</span>
                  </button>
                  <button
                    onClick={() => onRegistrar(v.id)}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <Check size={16} className="text-[var(--insignia-exito)]" />
                    <span className="text-[10px] font-medium text-texto-secundario">{t('recorrido.llegue')}</span>
                  </button>
                </div>
              )}

              {!esGenerica && estado === 'en_sitio' && v && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onEditar(v.id)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                    >
                      <Pencil size={14} className="text-texto-marca" />
                      <span className="text-[11px] font-medium text-texto-secundario">Agregar info</span>
                    </button>
                    <button
                      onClick={() => onRegistrar(v.id)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                    >
                      <Check size={14} className="text-[var(--insignia-exito)]" />
                      <span className="text-[11px] font-medium text-texto-secundario">Completar</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onCambiarEstado(parada.id, 'programada')}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-card text-[11px] font-medium text-texto-terciario hover:bg-superficie-elevada transition-colors"
                    >
                      <RotateCcw size={12} />
                      <span>Deshacer</span>
                    </button>
                    <button
                      onClick={() => onCambiarEstado(parada.id, 'cancelada')}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-card text-[11px] font-medium text-texto-terciario hover:bg-superficie-elevada transition-colors"
                    >
                      <X size={12} />
                      <span>{t('comun.cancelar')}</span>
                    </button>
                  </div>
                </div>
              )}

              {!esGenerica && esCancelada && (
                <button
                  onClick={() => onCambiarEstado(parada.id, 'programada')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all text-xs font-medium text-texto-secundario"
                >
                  <RotateCcw size={14} className="text-texto-marca" />
                  <span>Reactivar parada</span>
                </button>
              )}

              {!esGenerica && esCompletada && v && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onEditar(v.id)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all text-xs font-medium text-texto-secundario"
                  >
                    <Pencil size={14} className="text-texto-marca" />
                    <span>Editar registro</span>
                  </button>
                  <button
                    onClick={() => onCambiarEstado(parada.id, 'programada')}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-card border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all text-xs font-medium text-texto-secundario"
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

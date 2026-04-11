'use client'

/**
 * TarjetaParada — Parada en formato timeline estilo Spoke.
 * Compacta en lista, expandible con 3 botones iguales (Navegar, Fallida, Llegué/Completar).
 * Se usa en: ListaParadas dentro del sheet del recorrido.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Navigation, Check, X, MessageSquare, Lock } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { abrirNavegacion } from '@/componentes/mapa/utilidades-mapa'

type EstadoVisita = 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada' | 'reprogramada'

interface Visita {
  id: string
  contacto_nombre: string
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
}

interface PropiedadesTarjetaParada {
  orden: number
  visita: Visita
  esActual: boolean
  seleccionada: boolean
  onSeleccionar: () => void
  onCambiarEstado: (visitaId: string, estado: EstadoVisita) => void
  onRegistrar: (visitaId: string) => void
  esUltima: boolean
  /** true si ya hay otra parada en camino/en sitio — bloquea iniciar esta */
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

  // Esta parada es la que está activa (en_camino o en_sitio)
  const estaActiva = estado === 'en_camino' || estado === 'en_sitio'

  // Si hay otra en curso y esta no es la activa, bloquear acción positiva
  const bloqueada = otraEnCurso && !estaActiva && estado === 'programada'

  // Label y acción del botón positivo según estado
  const labelPositivo = estado === 'en_sitio' ? 'Completar'
    : estado === 'en_camino' ? t('recorrido.llegue')
    : bloqueada ? 'Bloqueada'
    : t('recorrido.en_camino')

  const accionPositivo = () => {
    if (bloqueada) return
    if (estado === 'en_sitio' || estado === 'en_camino') {
      onRegistrar(visita.id)
    } else {
      onCambiarEstado(visita.id, 'en_camino')
    }
  }

  return (
    <div className="flex gap-0">
      {/* Timeline — línea vertical + número */}
      <div className="flex flex-col items-center w-12 shrink-0">
        <div
          className={[
            'flex items-center justify-center rounded-full text-xs font-bold text-white shrink-0 transition-all',
            esActual ? 'size-9' : 'size-7',
          ].join(' ')}
          style={{ backgroundColor: colorEstado }}
        >
          {esCompletada ? <Check size={14} strokeWidth={3} /> : (
            esCancelada ? <X size={14} strokeWidth={3} /> : (
              <span className={esActual ? 'text-sm' : ''}>{String(orden).padStart(2, '0')}</span>
            )
          )}
        </div>
        {!esUltima && <div className="w-px flex-1 min-h-[20px] bg-borde-sutil" />}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 pb-3">
        {/* Row compacta — siempre visible */}
        <button
          onClick={onSeleccionar}
          className={[
            'w-full text-left rounded-xl p-3 transition-colors -mt-1',
            seleccionada ? 'bg-superficie-elevada' : 'hover:bg-superficie-elevada/50',
            esCancelada ? 'opacity-50' : '',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold text-texto-primario ${esCancelada ? 'line-through' : ''}`}>
                {visita.contacto_nombre || visita.direccion_texto}
              </p>
              {/* Dirección — solo si hay nombre de contacto (sino ya se muestra como título) */}
              {visita.contacto_nombre && visita.direccion_texto && (
                <p className="text-xs text-texto-terciario mt-0.5 truncate">
                  {visita.direccion_texto}
                </p>
              )}
            </div>
            {visita.fecha_programada && (
              <span className="text-xs text-texto-terciario shrink-0 tabular-nums">
                {formato.hora(visita.fecha_programada)}
              </span>
            )}
          </div>

          {/* Badge de estado */}
          {estado !== 'programada' && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="size-1.5 rounded-full" style={{ backgroundColor: colorEstado }} />
              <span className="text-xs text-texto-terciario">
                {estado === 'en_camino' ? t('recorrido.en_camino')
                  : estado === 'en_sitio' ? 'En sitio'
                  : estado === 'completada' ? t('recorrido.estados.completado')
                  : estado === 'cancelada' ? 'Cancelada'
                  : 'Reprogramada'}
              </span>
            </div>
          )}

          {/* Notas preview (colapsada) */}
          {visita.notas && !seleccionada && (
            <div className="flex items-start gap-1.5 mt-1.5">
              <MessageSquare size={11} className="text-texto-terciario shrink-0 mt-0.5" />
              <p className="text-xs text-texto-terciario line-clamp-1">{visita.notas}</p>
            </div>
          )}
        </button>

        {/* Detalle expandido */}
        <AnimatePresence>
          {seleccionada && !esCompletada && !esCancelada && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-1 space-y-2.5">
                {/* Notas expandidas */}
                {visita.notas && (
                  <div className="flex items-start gap-2">
                    <MessageSquare size={13} className="text-texto-terciario shrink-0 mt-0.5" />
                    <p className="text-xs text-texto-secundario leading-relaxed">{visita.notas}</p>
                  </div>
                )}

                {/* 3 botones iguales */}
                <div className="grid grid-cols-3 gap-2 pt-0.5">
                  {/* Navegar */}
                  <button
                    onClick={() => tieneCoords && abrirNavegacion({ lat: visita.direccion_lat!, lng: visita.direccion_lng! })}
                    disabled={!tieneCoords}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all disabled:opacity-30"
                  >
                    <Navigation size={16} className="text-[var(--insignia-info)]" />
                    <span className="text-[11px] font-medium text-texto-secundario">Navegar</span>
                  </button>

                  {/* Fallida */}
                  <button
                    onClick={() => onCambiarEstado(visita.id, 'cancelada')}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-borde-sutil bg-superficie-elevada hover:brightness-110 transition-all"
                  >
                    <X size={16} className="text-[var(--insignia-peligro)]" />
                    <span className="text-[11px] font-medium text-texto-secundario">Fallida</span>
                  </button>

                  {/* Acción positiva */}
                  <button
                    onClick={accionPositivo}
                    disabled={bloqueada}
                    className={[
                      'flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border transition-all',
                      bloqueada
                        ? 'border-borde-sutil bg-superficie-elevada opacity-40 cursor-not-allowed'
                        : 'border-borde-sutil bg-superficie-elevada hover:brightness-110',
                    ].join(' ')}
                  >
                    {bloqueada ? (
                      <Lock size={16} className="text-texto-terciario" />
                    ) : (
                      <Check size={16} className="text-[var(--insignia-exito)]" />
                    )}
                    <span className="text-[11px] font-medium text-texto-secundario">{labelPositivo}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export { TarjetaParada, type EstadoVisita, type Visita }

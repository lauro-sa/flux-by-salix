'use client'

/**
 * ResumenDia — Vista de resumen al completar todas las paradas.
 * Muestra: estadísticas del día + tarjeta por cada visita con foto, notas, checklist, temperatura.
 * Editable hasta 48h después de completar. Después es solo lectura.
 * Botón reactivar: permite volver al recorrido activo si necesita ir a otra visita.
 * Se usa en: PaginaRecorrido cuando el recorrido está completado.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2, Clock, MapPin, Route, Pencil, Image as ImageIcon,
  FileText, CheckSquare, Thermometer, RotateCcw, ChevronDown, ChevronUp,
  X, Navigation,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTraduccion } from '@/lib/i18n'
import NextImage from 'next/image'

// ── Tipos ──

interface ItemChecklist {
  texto: string
  completado: boolean
}

// Tipo flexible: acepta la visita tal como viene de la API (tiene todos los campos)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface VisitaResumen {
  id: string
  contacto_nombre: string
  direccion_texto: string | null
  estado: string
  motivo?: string | null
  notas?: string | null
  notas_registro?: string | null
  resultado?: string | null
  temperatura?: string | null | undefined
  checklist?: unknown[] | ItemChecklist[] | null
  duracion_estimada_min?: number | null
  duracion_real_min?: number | null
  fecha_completada?: string | null
  fecha_programada?: string | null
  fecha_inicio?: string | null
  fecha_llegada?: string | null
}

interface ParadaResumen {
  id: string
  orden: number
  visita: VisitaResumen
}

interface FotoVisita {
  url: string
  nombre: string
}

interface PropiedadesResumenDia {
  totalVisitas: number
  completadas: number
  canceladas: number
  duracionTotalMin: number | null
  distanciaTotalKm: number | null
  paradas: ParadaResumen[]
  /** Fecha en que se completó el recorrido (ISO string o YYYY-MM-DD) */
  fechaRecorrido: string
  /** Callback para abrir RegistroVisita en modo editar */
  onEditarVisita: (visitaId: string) => void
  /** Callback para reactivar el recorrido */
  onReactivar: () => void
}

// ── Helpers ──

/** Calcula si han pasado menos de 48h desde la fecha dada */
function dentroDeVentanaEdicion(fechaCompletada: string | null, fechaRecorrido: string): boolean {
  // Usar fecha_completada de la visita, o la fecha del recorrido como fallback
  const ref = fechaCompletada || fechaRecorrido
  if (!ref) return false
  const completado = new Date(ref)
  const ahora = new Date()
  const horas = (ahora.getTime() - completado.getTime()) / (1000 * 60 * 60)
  return horas < 48
}

/** Formato duración legible */
function formatearDuracion(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`
  return `${min}m`
}

/** Color según temperatura/factibilidad */
function colorTemperatura(temp: string | null): { color: string; label: string } {
  switch (temp) {
    case 'caliente': return { color: 'var(--insignia-exito)', label: 'Alta' }
    case 'tibio': return { color: 'var(--insignia-advertencia)', label: 'Media' }
    case 'frio': return { color: 'var(--insignia-peligro)', label: 'Baja' }
    default: return { color: 'var(--texto-terciario)', label: 'Sin definir' }
  }
}

// ── Componente tarjeta de visita ──

function TarjetaVisita({
  parada,
  puedeEditar,
  onEditar,
  fotos,
}: {
  parada: ParadaResumen
  puedeEditar: boolean
  onEditar: () => void
  fotos: FotoVisita[]
}) {
  // Por defecto expandida para mostrar toda la info del resumen
  const [expandida, setExpandida] = useState(true)
  const v = parada.visita
  const esCancelada = v.estado === 'cancelada'
  const esCompletada = v.estado === 'completada'
  const checklistArr = Array.isArray(v.checklist) ? v.checklist as ItemChecklist[] : []
  const checkCompletados = checklistArr.filter(i => i.completado).length
  const checkTotal = checklistArr.length
  const temp = colorTemperatura(v.temperatura ?? null)

  return (
    <div className={`rounded-xl border transition-colors ${
      esCancelada
        ? 'border-[var(--insignia-peligro)]/20 bg-[var(--insignia-peligro)]/[0.03]'
        : esCompletada
          ? 'border-borde-sutil bg-white/[0.03]'
          : 'border-borde-sutil bg-white/[0.02]'
    }`}>
      {/* Header de la tarjeta — siempre visible */}
      <button
        onClick={() => setExpandida(!expandida)}
        className="w-full flex items-center gap-3 p-3.5 text-left"
      >
        {/* Número de orden */}
        <div
          className="flex items-center justify-center size-8 rounded-full border-2 shrink-0 text-xs font-bold"
          style={{
            borderColor: esCancelada ? 'var(--insignia-peligro)' : esCompletada ? 'var(--insignia-exito)' : 'var(--borde-fuerte)',
            backgroundColor: esCancelada ? 'var(--insignia-peligro)' : esCompletada ? 'var(--insignia-exito)' : 'transparent',
            color: (esCancelada || esCompletada) ? 'white' : 'var(--texto-terciario)',
          }}
        >
          {esCancelada ? <X size={12} /> : esCompletada ? <CheckCircle2 size={14} /> : parada.orden}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${esCancelada ? 'line-through text-texto-terciario' : 'text-texto-primario'}`}>
            {v.contacto_nombre}
          </p>
          <p className="text-xs text-texto-terciario truncate mt-0.5">
            {v.direccion_texto || 'Sin dirección'}
          </p>
        </div>

        {/* Indicadores rápidos */}
        <div className="flex items-center gap-2 shrink-0">
          {v.temperatura && (
            <div
              className="size-2 rounded-full"
              style={{ backgroundColor: temp.color }}
              title={`Factibilidad: ${temp.label}`}
            />
          )}
          {fotos.length > 0 && (
            <div className="flex items-center gap-0.5 text-texto-terciario">
              <ImageIcon size={11} />
              <span className="text-[10px]">{fotos.length}</span>
            </div>
          )}
          {v.duracion_real_min != null && v.duracion_real_min > 0 && (
            <span className="text-[10px] text-texto-terciario">{formatearDuracion(v.duracion_real_min)}</span>
          )}
          {expandida ? <ChevronUp size={14} className="text-texto-terciario" /> : <ChevronDown size={14} className="text-texto-terciario" />}
        </div>
      </button>

      {/* Contenido expandible */}
      {expandida && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/[0.05] pt-3">
          {/* Fotos */}
          {fotos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {fotos.map((foto, i) => (
                <div key={i} className="relative size-20 rounded-lg overflow-hidden border border-white/[0.08]">
                  <NextImage src={foto.url} alt={foto.nombre} fill sizes="80px" className="object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* Notas */}
          {(v.notas_registro || v.notas) && (
            <div className="flex gap-2">
              <FileText size={13} className="text-texto-terciario shrink-0 mt-0.5" />
              <p className="text-sm text-texto-secundario">{v.notas_registro || v.notas}</p>
            </div>
          )}

          {/* Temperatura */}
          {v.temperatura && (
            <div className="flex items-center gap-2">
              <Thermometer size={13} className="text-texto-terciario shrink-0" />
              <span className="text-xs font-medium" style={{ color: temp.color }}>
                Factibilidad {temp.label}
              </span>
            </div>
          )}

          {/* Checklist */}
          {checkTotal > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <CheckSquare size={13} className="text-texto-terciario shrink-0" />
                <span className="text-[11px] text-texto-terciario">{checkCompletados}/{checkTotal} completados</span>
              </div>
              <div className="space-y-1 pl-5">
                {checklistArr.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="size-3.5 rounded border flex items-center justify-center shrink-0"
                      style={{
                        borderColor: item.completado ? 'var(--insignia-exito)' : 'var(--borde-fuerte)',
                        backgroundColor: item.completado ? 'var(--insignia-exito)' : 'transparent',
                      }}
                    >
                      {item.completado && <CheckCircle2 size={8} className="text-white" />}
                    </div>
                    <span className={`text-xs ${item.completado ? 'text-texto-terciario line-through' : 'text-texto-secundario'}`}>
                      {item.texto}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duración */}
          {v.duracion_real_min != null && v.duracion_real_min > 0 && (
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-texto-terciario shrink-0" />
              <span className="text-xs text-texto-terciario">
                {formatearDuracion(v.duracion_real_min)} en sitio
                {(v.duracion_estimada_min ?? 0) > 0 && ` (estimado: ${formatearDuracion(v.duracion_estimada_min!)})`}
              </span>
            </div>
          )}

          {/* Sin datos registrados */}
          {!v.notas_registro && !v.notas && !v.temperatura && fotos.length === 0 && checkTotal === 0 && esCompletada && (
            <p className="text-xs text-texto-terciario italic">Sin datos registrados para esta visita</p>
          )}

          {/* Botón editar */}
          {puedeEditar && esCompletada && (
            <button
              onClick={onEditar}
              className="flex items-center gap-1.5 text-xs font-medium text-texto-marca hover:text-texto-marca/80 transition-colors pt-1"
            >
              <Pencil size={12} />
              Editar registro
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──

function ResumenDia({
  totalVisitas,
  completadas,
  canceladas,
  duracionTotalMin,
  distanciaTotalKm,
  paradas,
  fechaRecorrido,
  onEditarVisita,
  onReactivar,
}: PropiedadesResumenDia) {
  const router = useRouter()
  const { t } = useTraduccion()

  // Fotos por visita — se cargan al montar
  const [fotosPorVisita, setFotosPorVisita] = useState<Record<string, FotoVisita[]>>({})

  const cargarFotos = useCallback(async () => {
    const resultado: Record<string, FotoVisita[]> = {}
    // Cargar fotos de todas las visitas completadas en paralelo
    const visitasCompletadas = paradas
      .filter(p => p.visita.estado === 'completada')
      .map(p => p.visita.id)

    const respuestas = await Promise.allSettled(
      visitasCompletadas.map(async (id) => {
        const resp = await fetch(`/api/recorrido/registro?visita_id=${id}`)
        if (!resp.ok) return { id, fotos: [] }
        const data = await resp.json()
        return {
          id,
          fotos: (data.fotos || []).map((f: { url: string; nombre: string }) => ({
            url: f.url,
            nombre: f.nombre,
          })),
        }
      })
    )

    for (const r of respuestas) {
      if (r.status === 'fulfilled') {
        resultado[r.value.id] = r.value.fotos
      }
    }

    setFotosPorVisita(resultado)
  }, [paradas])

  useEffect(() => {
    if (paradas.length > 0) cargarFotos()
  }, [paradas, cargarFotos])

  // Verificar ventana de edición (48h)
  const puedeEditar = dentroDeVentanaEdicion(null, fechaRecorrido)

  return (
    <div className="flex-1 flex flex-col overflow-y-auto overscroll-contain">
      {/* ── Header compacto ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-3 px-4 pt-4 pb-2"
      >
        <CheckCircle2 size={28} strokeWidth={1.5} className="text-[var(--insignia-exito)] shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-texto-primario">{t('recorrido.estados.completado')}</h2>
          {puedeEditar && (
            <p className="text-[11px] text-texto-terciario">Podés editar hasta 48h después</p>
          )}
        </div>
      </motion.div>

      {/* ── Stats inline ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="px-4 pb-3"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--insignia-exito)]/10 border border-[var(--insignia-exito)]/20">
            <Route size={12} className="text-[var(--insignia-exito)]" />
            <span className="text-xs font-medium text-[var(--insignia-exito)]">{completadas} completadas</span>
          </div>

          {canceladas > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--insignia-peligro)]/10 border border-[var(--insignia-peligro)]/20">
              <X size={12} className="text-[var(--insignia-peligro)]" />
              <span className="text-xs font-medium text-[var(--insignia-peligro)]">{canceladas} canceladas</span>
            </div>
          )}

          {distanciaTotalKm != null && distanciaTotalKm > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
              <Route size={12} className="text-texto-terciario" />
              <span className="text-xs font-medium text-texto-secundario">{distanciaTotalKm} km</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Tarjetas de visitas ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="px-4 pb-3 space-y-2"
      >
        {paradas.map((parada, i) => {
          // Calcular tiempo de viaje desde la visita anterior
          // = fecha_inicio de esta visita - fecha_completada de la anterior
          let tiempoViajeMin: number | null = null
          if (i > 0) {
            const anterior = paradas[i - 1].visita
            const actual = parada.visita
            const finAnterior = anterior.fecha_completada
            const inicioActual = actual.fecha_inicio || actual.fecha_llegada
            if (finAnterior && inicioActual) {
              const diff = Math.round((new Date(inicioActual).getTime() - new Date(finAnterior).getTime()) / 60000)
              if (diff > 0) tiempoViajeMin = diff
            }
          }

          return (
            <div key={parada.id}>
              {/* Indicador de viaje entre visitas */}
              {tiempoViajeMin != null && (
                <div className="flex items-center gap-2 py-1.5 px-2">
                  <div className="flex-1 h-px bg-borde-sutil/50" />
                  <div className="flex items-center gap-1 text-texto-terciario">
                    <Navigation size={10} />
                    <span className="text-[10px] font-medium">{formatearDuracion(tiempoViajeMin)} de viaje</span>
                  </div>
                  <div className="flex-1 h-px bg-borde-sutil/50" />
                </div>
              )}
              <TarjetaVisita
                parada={parada}
                puedeEditar={puedeEditar}
                onEditar={() => onEditarVisita(parada.visita.id)}
                fotos={fotosPorVisita[parada.visita.id] || []}
              />
            </div>
          )
        })}
      </motion.div>

      {/* ── Acciones ── */}
      <div className="px-4 pb-8 pt-2 space-y-2 shrink-0">
        {/* Reactivar recorrido — reabre todo y permite editar visitas, fotos, orden */}
        <button
          onClick={onReactivar}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border border-[var(--insignia-advertencia)]/30 text-[var(--insignia-advertencia)] bg-[var(--insignia-advertencia)]/[0.06] hover:bg-[var(--insignia-advertencia)]/[0.12] transition-colors"
        >
          <RotateCcw size={14} />
          <span>Reabrir recorrido</span>
        </button>

        {/* Volver al inicio */}
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: 'var(--texto-marca)' }}
        >
          Volver al inicio
        </button>
      </div>
    </div>
  )
}

export { ResumenDia }

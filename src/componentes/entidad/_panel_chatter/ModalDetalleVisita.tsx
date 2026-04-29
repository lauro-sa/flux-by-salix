'use client'

/**
 * ModalDetalleVisita — Modal de solo lectura con toda la info de una visita.
 * Jerarquía clara: contacto → fecha/visitador → notas → fotos → detalles.
 * Reutilizable desde: EntradaVisita (chatter), BarraKPIs, visitas archivadas.
 */

import {
  MapPin, Clock, CheckSquare, Square,
  Navigation, CalendarClock, User,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { ModalAdaptable } from '@/componentes/ui/ModalAdaptable'
import { useTraduccion } from '@/lib/i18n'
import type { EntradaChatter, AdjuntoChatter } from '@/tipos/chatter'
import Image from 'next/image'

// ─── Temperatura ───
const TEMP: Record<string, { etiqueta: string; color: string }> = {
  frio: { etiqueta: 'Baja', color: 'var(--insignia-peligro)' },
  tibio: { etiqueta: 'Media', color: 'var(--insignia-advertencia)' },
  caliente: { etiqueta: 'Alta', color: 'var(--insignia-exito)' },
}

// ─── Props ───
export interface DatosVisitaDetalle {
  resultado?: string | null
  notas?: string | null
  notas_registro?: string | null
  temperatura?: string | null
  checklist?: { id: string; texto: string; completado: boolean }[]
  direccion_texto?: string | null
  duracion_real_min?: number | null
  duracion_estimada_min?: number | null
  fecha_completada?: string | null
  fecha_programada?: string | null
  tiene_hora_especifica?: boolean | null
  motivo?: string | null
  contacto_nombre?: string | null
  contacto_id?: string | null
  asignado_nombre?: string | null
  editado_por_nombre?: string | null
  registro_lat?: number | null
  registro_lng?: number | null
  registro_precision_m?: number | null
  prioridad?: string | null
  recibe_nombre?: string | null
  recibe_telefono?: string | null
  adjuntos?: AdjuntoChatter[]
}

interface PropsNavegacion {
  indice: number
  total: number
  onAnterior?: () => void
  onSiguiente?: () => void
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  entrada?: EntradaChatter
  datosVisita?: DatosVisitaDetalle
  navegacion?: PropsNavegacion
}

// ─── Helpers ───
// `conHora=false` se usa para visitas programadas solo por día (no contamina con
// "00:00" un timestamp que en realidad no representa una hora elegida por el usuario).
function fechaCorta(iso?: string | null, conHora: boolean = true): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function fechaLarga(iso?: string | null, conHora: boolean = true): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

// ─── Componente ───
export function ModalDetalleVisita({ abierto, onCerrar, entrada, datosVisita, navegacion }: Props) {
  const { t } = useTraduccion()

  const m = entrada?.metadata
  const notasRegistro = datosVisita?.notas_registro ?? datosVisita?.notas ?? m?.visita_notas
  const notasAdmin = datosVisita?.notas_registro ? (datosVisita?.notas || null) : null
  const temperatura = datosVisita?.temperatura ?? m?.visita_temperatura
  const checklist = datosVisita?.checklist ?? m?.visita_checklist ?? []
  const direccion = datosVisita?.direccion_texto ?? m?.visita_direccion
  const duracionReal = datosVisita?.duracion_real_min ?? m?.visita_duracion_real
  const duracionEstimada = datosVisita?.duracion_estimada_min ?? m?.visita_duracion_estimada
  const fechaCompletada = datosVisita?.fecha_completada ?? m?.visita_fecha_completada
  const fechaProgramada = datosVisita?.fecha_programada ?? m?.visita_fecha_programada
  // Para visitas completadas, fecha_completada es timestamp real (siempre con hora real).
  // Para no completadas, mostramos hora solo si la programada tenía hora específica.
  const conHoraEnSubheader = !!fechaCompletada || datosVisita?.tiene_hora_especifica === true
  const conHoraPrincipal = datosVisita?.tiene_hora_especifica === true
  const motivo = datosVisita?.motivo ?? m?.visita_motivo
  const contactoNombre = datosVisita?.contacto_nombre ?? m?.visita_contacto_nombre
  const visitador = datosVisita?.editado_por_nombre ?? datosVisita?.asignado_nombre ?? entrada?.autor_nombre
  const recibe = datosVisita?.recibe_nombre
  const recibeTel = datosVisita?.recibe_telefono

  const adjuntos = datosVisita?.adjuntos ?? entrada?.adjuntos ?? []
  const fotos = adjuntos.filter(a => a.tipo?.startsWith('image/'))
  const completados = checklist.filter(i => i.completado).length
  const totalChecklist = checklist.length
  const temp = temperatura ? TEMP[temperatura] : null

  return (
    <ModalAdaptable
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={t('visitas.detalle_visita')}
      tamano="3xl"
    >
      <div className="space-y-5">

        {/* ── 1. Navegación entre visitas ── */}
        {navegacion && (
          <div className="flex items-center justify-between py-1">
            <button
              onClick={navegacion.onAnterior}
              disabled={!navegacion.onAnterior}
              className="flex items-center gap-1 text-xs font-medium text-texto-secundario hover:text-texto-primario disabled:opacity-25 transition-colors"
            >
              <ChevronLeft size={14} />
              Visita anterior
            </button>
            <span className="text-[11px] text-texto-terciario">{navegacion.indice + 1} de {navegacion.total}</span>
            <button
              onClick={navegacion.onSiguiente}
              disabled={!navegacion.onSiguiente}
              className="flex items-center gap-1 text-xs font-medium text-texto-secundario hover:text-texto-primario disabled:opacity-25 transition-colors"
            >
              Siguiente visita
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ── 2. Header: contacto + meta ── */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-texto-primario">{contactoNombre || t('visitas.visita')}</h3>

          {/* Fecha y visitador */}
          <p className="text-sm text-texto-terciario">
            {fechaCorta(fechaCompletada || fechaProgramada, conHoraEnSubheader)}
            {visitador && <> · {visitador}</>}
          </p>

          {/* Pills: factibilidad + duración */}
          <div className="flex items-center gap-2">
            {temp && (
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  border: `1px solid ${temp.color}`,
                  backgroundColor: `color-mix(in srgb, ${temp.color} 12%, transparent)`,
                  color: temp.color,
                }}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: temp.color }} />
                Factibilidad {temp.etiqueta}
              </span>
            )}
            {duracionReal != null && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-texto-secundario">
                <Clock size={11} />
                {duracionReal} min en sitio
                {duracionEstimada != null && <span className="text-texto-terciario"> / {duracionEstimada} est.</span>}
              </span>
            )}
          </div>
        </div>

        <div className="h-px bg-white/[0.07]" />

        {/* ── 3. Notas + Fotos — lado a lado ── */}
        <div className="flex gap-5">
          {/* Notas a la izquierda */}
          <div className="flex-1 min-w-0 space-y-3">
            {notasRegistro && (
              <p className="text-sm text-texto-primario leading-relaxed whitespace-pre-wrap">{notasRegistro}</p>
            )}
            {notasAdmin && (
              <div className="p-2.5 rounded-card bg-[var(--insignia-info)]/[0.06] border border-[var(--insignia-info)]/15">
                <p className="text-[10px] font-medium text-[var(--insignia-info)] uppercase tracking-wider mb-1">Indicaciones</p>
                <p className="text-xs text-texto-terciario whitespace-pre-wrap">{notasAdmin}</p>
              </div>
            )}
          </div>

          {/* Fotos a la derecha — miniaturas compactas */}
          {fotos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 shrink-0 content-start" style={{ maxWidth: '140px' }}>
              {fotos.map((foto, i) => (
                <a
                  key={i}
                  href={foto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative size-16 rounded-card overflow-hidden border border-white/[0.06] hover:border-texto-marca/40 transition-colors"
                >
                  <Image
                    src={foto.url}
                    alt={foto.nombre}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* ── 5. Checklist ── */}
        {totalChecklist > 0 && (
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
              Checklist ({completados}/{totalChecklist})
            </p>
            <div className="space-y-1">
              {checklist.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-card bg-white/[0.02]"
                >
                  {item.completado
                    ? <CheckSquare size={14} className="text-[var(--insignia-exito)] shrink-0" />
                    : <Square size={14} className="text-texto-terciario shrink-0" />
                  }
                  <span className={`text-sm ${item.completado ? 'text-texto-terciario line-through' : 'text-texto-primario'}`}>
                    {item.texto}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 6. Detalles — info secundaria compacta ── */}
        <div className="rounded-card bg-white/[0.02] border border-white/[0.05] p-4 space-y-2.5">
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Detalles</p>

          {motivo && (
            <div className="flex items-center gap-2.5">
              <Navigation size={13} className="text-texto-terciario shrink-0" />
              <span className="text-xs text-texto-terciario">Motivo:</span>
              <span className="text-xs text-texto-secundario">{motivo}</span>
            </div>
          )}

          {direccion && (
            <div className="flex items-start gap-2.5">
              <MapPin size={13} className="text-texto-terciario shrink-0 mt-0.5" />
              <span className="text-xs text-texto-secundario">{direccion}</span>
            </div>
          )}

          {fechaProgramada && (
            <div className="flex items-center gap-2.5">
              <CalendarClock size={13} className="text-texto-terciario shrink-0" />
              <span className="text-xs text-texto-terciario">Programada:</span>
              <span className="text-xs text-texto-secundario">
                {fechaLarga(fechaProgramada, conHoraPrincipal)}
                {!conHoraPrincipal && <span className="text-texto-terciario opacity-70"> · sin hora</span>}
              </span>
            </div>
          )}

          {recibe && (
            <div className="flex items-center gap-2.5">
              <User size={13} className="text-texto-terciario shrink-0" />
              <span className="text-xs text-texto-terciario">Recibió:</span>
              <span className="text-xs text-texto-secundario">{recibe}{recibeTel && ` · ${recibeTel}`}</span>
            </div>
          )}
        </div>

      </div>
    </ModalAdaptable>
  )
}

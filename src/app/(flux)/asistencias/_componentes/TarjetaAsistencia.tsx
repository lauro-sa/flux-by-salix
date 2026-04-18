'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle2, AlertTriangle, Clock, XCircle, Coffee, Footprints,
  Calendar, UtensilsCrossed, Palmtree, MapPin, Activity, Pencil,
} from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'
import { ETIQUETA_METODO, formatearPuntualidad } from '@/lib/constantes/asistencias'

// ─── Tipos ───────────────────────────────────────────────────

interface RegistroAsistencia {
  id: string
  miembro_nombre: string
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  inicio_almuerzo: string | null
  fin_almuerzo: string | null
  salida_particular: string | null
  vuelta_particular: string | null
  estado: string
  tipo: string
  metodo_registro: string
  metodo_salida?: string | null
  puntualidad_min?: number | null
  ubicacion_entrada?: Record<string, unknown> | null
  tiempo_activo_min?: number | null
  total_heartbeats?: number | null
  notas?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────

function fmtHora(iso: string | null, formato: string = '24h'): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  if (formato === '12h') {
    const h = d.getHours() % 12 || 12
    const m = String(d.getMinutes()).padStart(2, '0')
    const ampm = d.getHours() < 12 ? 'AM' : 'PM'
    return `${h}:${m} ${ampm}`
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtFecha(fecha: string, locale: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function fmtDuracion(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m > 0 ? `${h}h ${m} min` : `${h}h`
}

function fmtDurCorta(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function msToMin(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000))
}

function inicial(nombre: string): string {
  return nombre.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function formatearUbicacion(ub: Record<string, unknown> | null | undefined): string | null {
  if (!ub) return null
  const partes = [ub.direccion, ub.barrio, ub.ciudad].filter(Boolean)
  if (partes.length) return partes.join(', ')
  if (ub.lat && ub.lng) return `${ub.lat}, ${ub.lng}`
  return null
}

// Usa formatearPuntualidad de constantes/asistencias

// ─── Config estados ──────────────────────────────────────────

const ESTADO_CFG: Record<string, { etiqueta: string; color: string; fondo: string; icono: React.ReactNode }> = {
  activo:       { etiqueta: 'En turno', color: 'text-asistencia-presente', fondo: 'bg-asistencia-presente-fondo border-asistencia-presente/30', icono: <Clock size={11} /> },
  cerrado:      { etiqueta: 'Cerrado', color: 'text-asistencia-presente/70', fondo: 'bg-asistencia-presente-fondo border-asistencia-presente/20', icono: <CheckCircle2 size={11} /> },
  auto_cerrado: { etiqueta: 'Sin salida', color: 'text-asistencia-tarde', fondo: 'bg-asistencia-tarde-fondo border-asistencia-tarde/30', icono: <AlertTriangle size={11} /> },
  ausente:      { etiqueta: 'Ausente', color: 'text-asistencia-ausente', fondo: 'bg-asistencia-ausente-fondo border-asistencia-ausente/30', icono: <XCircle size={11} /> },
  feriado:      { etiqueta: 'Feriado', color: 'text-asistencia-feriado', fondo: 'bg-asistencia-feriado-fondo border-asistencia-feriado/30', icono: <Palmtree size={11} /> },
  almuerzo:     { etiqueta: 'Almorzando', color: 'text-asistencia-almuerzo', fondo: 'bg-asistencia-almuerzo-fondo border-asistencia-almuerzo/30', icono: <Coffee size={11} /> },
  particular:   { etiqueta: 'Trámite', color: 'text-asistencia-particular', fondo: 'bg-asistencia-particular-fondo border-asistencia-particular/30', icono: <Footprints size={11} /> },
}

const COLORES_AVATAR = [
  'bg-insignia-primario/25 text-insignia-primario',
  'bg-insignia-exito/25 text-insignia-exito',
  'bg-insignia-advertencia/25 text-insignia-advertencia',
  'bg-insignia-peligro/25 text-insignia-peligro',
  'bg-insignia-violeta/25 text-insignia-violeta',
  'bg-insignia-cyan/25 text-insignia-cyan',
]

const ICONO_METODO: Record<string, React.ReactNode> = {
  manual: <Pencil size={13} />,
  automatico: <Activity size={13} />,
  sistema: <Clock size={13} />,
}

// ─── Segmentos de la barra de tiempo ─────────────────────────

interface Segmento {
  tipo: 'trabajo' | 'almuerzo' | 'tramite'
  minutos: number
  color: string
}

function calcularSegmentos(r: RegistroAsistencia): Segmento[] {
  if (!r.hora_entrada) return []
  const entrada = new Date(r.hora_entrada).getTime()
  const salida = r.hora_salida ? new Date(r.hora_salida).getTime() : Date.now()
  const pausas: { inicio: number; fin: number; tipo: 'almuerzo' | 'tramite' }[] = []

  if (r.inicio_almuerzo && r.fin_almuerzo) {
    pausas.push({ inicio: new Date(r.inicio_almuerzo).getTime(), fin: new Date(r.fin_almuerzo).getTime(), tipo: 'almuerzo' })
  }
  if (r.salida_particular && r.vuelta_particular) {
    pausas.push({ inicio: new Date(r.salida_particular).getTime(), fin: new Date(r.vuelta_particular).getTime(), tipo: 'tramite' })
  }
  pausas.sort((a, b) => a.inicio - b.inicio)

  const segmentos: { inicio: number; fin: number; tipo: 'trabajo' | 'almuerzo' | 'tramite' }[] = []
  let cursor = entrada
  for (const pausa of pausas) {
    if (pausa.inicio > cursor) segmentos.push({ inicio: cursor, fin: pausa.inicio, tipo: 'trabajo' })
    segmentos.push({ inicio: pausa.inicio, fin: pausa.fin, tipo: pausa.tipo })
    cursor = pausa.fin
  }
  if (cursor < salida) segmentos.push({ inicio: cursor, fin: salida, tipo: 'trabajo' })

  const colores = { trabajo: 'bg-asistencia-presente/30', almuerzo: 'bg-asistencia-almuerzo/40', tramite: 'bg-asistencia-particular/40' }
  return segmentos.map(s => ({
    tipo: s.tipo,
    minutos: Math.max(1, Math.round((s.fin - s.inicio) / 60000)),
    color: colores[s.tipo],
  }))
}

// ─── Componente ──────────────────────────────────────────────

export function TarjetaAsistencia({ registro }: { registro: RegistroAsistencia }) {
  const { formatoHora, locale } = useFormato()
  const r = registro
  const cfg = ESTADO_CFG[r.estado] || ESTADO_CFG.cerrado
  const enCurso = ['activo', 'almuerzo', 'particular'].includes(r.estado)

  // Tick cada 30s para actualizar duración en vivo
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!enCurso) return
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [enCurso])

  // Calcular minutos netos
  const salidaCalc = r.hora_salida || (enCurso && r.hora_entrada ? new Date().toISOString() : null)
  const minBrutos = r.hora_entrada && salidaCalc ? msToMin(r.hora_entrada, salidaCalc) : 0
  const minAlmuerzo = r.inicio_almuerzo && r.fin_almuerzo ? msToMin(r.inicio_almuerzo, r.fin_almuerzo) : 0
  const minTramite = r.salida_particular && r.vuelta_particular ? msToMin(r.salida_particular, r.vuelta_particular) : 0
  const minNetos = Math.max(0, minBrutos - minAlmuerzo - minTramite)
  const dur = fmtDuracion(minNetos)

  const hash = r.miembro_nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const colorAvatar = COLORES_AVATAR[hash % COLORES_AVATAR.length]
  const colorDurTxt = r.estado === 'auto_cerrado' || r.tipo === 'tardanza' ? 'text-asistencia-tarde' : 'text-asistencia-presente'

  // Segmentos de la barra
  const segmentos = calcularSegmentos(r)
  const totalMinSegmentos = segmentos.reduce((s, seg) => s + seg.minutos, 0) || 1

  // Datos extra
  const ubicacion = formatearUbicacion(r.ubicacion_entrada)
  const puntualidad = formatearPuntualidad(r.puntualidad_min)
  const etiquetaMetodo = ETIQUETA_METODO[r.metodo_registro] || r.metodo_registro
  const etiquetaSalida = r.metodo_salida ? (ETIQUETA_METODO[r.metodo_salida] || r.metodo_salida) : null
  const tipoLabel = r.tipo === 'tardanza' ? 'Tardanza' : r.tipo === 'flexible' ? 'Flexible' : r.tipo === 'ausencia' ? 'Ausencia' : 'Normal'

  // Uso del software
  const tiempoActivo = r.tiempo_activo_min ?? 0
  const totalHeartbeats = r.total_heartbeats ?? 0
  const pctSoftware = minBrutos > 0 ? Math.min(100, Math.round((tiempoActivo / minBrutos) * 100)) : 0

  return (
    <div className="flex flex-col w-full">
      {/* ── Header: avatar + nombre + fecha + badge ── */}
      <div className="flex items-center justify-between gap-2 px-5 pt-[18px] pb-3.5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`size-[38px] rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0 ${colorAvatar}`}>
            {inicial(r.miembro_nombre)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-texto-primario truncate">{r.miembro_nombre}</p>
            <p className="flex items-center gap-1 text-[11px] text-texto-terciario/50 mt-0.5">
              <Calendar size={11} />
              {fmtFecha(r.fecha, locale)}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-[5px] rounded-full text-[11px] font-medium border shrink-0 ${cfg.fondo} ${cfg.color}`}>
          {cfg.icono}
          {cfg.etiqueta}
        </span>
      </div>

      {/* ── Bloque de tiempo ── */}
      {r.estado !== 'ausente' && r.estado !== 'feriado' && r.hora_entrada ? (
        <div className="px-5 py-4 border-b border-white/[0.07]">
          {/* Hora entrada → salida · duración */}
          <div className="flex items-baseline gap-2.5 mb-2">
            <span className="text-[32px] font-semibold text-texto-primario tracking-tight leading-none font-[system-ui]">
              {fmtHora(r.hora_entrada, formatoHora)}
            </span>
            <span className="text-xl text-texto-terciario/30">→</span>
            <span className="text-xl font-medium text-texto-terciario/50 tracking-tight">
              {enCurso ? '…' : fmtHora(r.hora_salida, formatoHora)}
            </span>
            <span className="text-xs text-texto-terciario/50 ml-1">· {dur}</span>
          </div>

          {/* Barra segmentada + tags de duración */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 px-2 py-[3px] rounded-boton bg-asistencia-presente-fondo border border-asistencia-presente/25">
              <Calendar size={11} className="text-asistencia-presente" />
              <span className="text-[11px] font-medium text-asistencia-presente">{dur}</span>
            </div>
            <span className={`text-xs font-medium ${colorDurTxt}`}>{dur} netos</span>

            {minAlmuerzo > 0 && (
              <span className="flex items-center gap-1 text-xs text-asistencia-tarde/80">
                <UtensilsCrossed size={11} />
                {fmtDurCorta(minAlmuerzo)}
              </span>
            )}
            {minTramite > 0 && (
              <span className="flex items-center gap-1 text-xs text-asistencia-particular/80">
                <Footprints size={11} />
                {fmtDurCorta(minTramite)}
              </span>
            )}
          </div>
        </div>
      ) : r.estado === 'feriado' ? (
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <p className="text-xs text-asistencia-feriado/80">{r.notas || 'Feriado'}</p>
        </div>
      ) : r.estado === 'ausente' ? (
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <p className="text-xs text-asistencia-ausente/60">Sin registro de asistencia</p>
        </div>
      ) : null}

      {/* ── Grid de info: Entrada | Salida | Puntualidad | Tipo ── */}
      {r.hora_entrada && (
        <div className="grid grid-cols-2">
          {/* Entrada */}
          <div className="px-5 py-3 border-b border-r border-white/[0.07]">
            <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Entrada</p>
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-boton bg-asistencia-presente-fondo flex items-center justify-center shrink-0">
                {ICONO_METODO[r.metodo_registro] || <Pencil size={13} />}
              </div>
              <div>
                <p className="text-[13px] text-texto-primario/75">{etiquetaMetodo}</p>
                <p className="text-[10px] text-texto-terciario/40">Web</p>
              </div>
            </div>
          </div>

          {/* Salida */}
          <div className="px-5 py-3 border-b border-white/[0.07]">
            <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Salida</p>
            {r.hora_salida && !enCurso ? (
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-boton bg-asistencia-presente-fondo flex items-center justify-center shrink-0">
                  {ICONO_METODO[r.metodo_salida || 'manual'] || <Pencil size={13} />}
                </div>
                <div>
                  <p className="text-[13px] text-texto-primario/75">{etiquetaSalida || 'Manual'}</p>
                  <p className="text-[10px] text-texto-terciario/40">Web</p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-texto-terciario/40">— Sin registrar</p>
            )}
          </div>

          {/* Puntualidad */}
          <div className="px-5 py-3 border-b border-r border-white/[0.07]">
            <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Puntualidad</p>
            {puntualidad ? (
              <p className={`text-[13px] font-medium ${puntualidad.color}`}>{puntualidad.texto}</p>
            ) : (
              <p className="text-[13px] text-texto-terciario/40">—</p>
            )}
          </div>

          {/* Tipo */}
          <div className="px-5 py-3 border-b border-white/[0.07]">
            <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Tipo</p>
            <p className="text-[13px] text-texto-primario/75">{tipoLabel}</p>
          </div>
        </div>
      )}

      {/* ── Ubicación ── */}
      {ubicacion && (
        <div className="px-5 py-3 border-b border-white/[0.07]">
          <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Ubicación</p>
          <p className="flex items-center gap-1.5 text-[13px] text-texto-primario/75">
            <MapPin size={13} className="text-texto-terciario/40 shrink-0" />
            {ubicacion}
          </p>
        </div>
      )}

      {/* ── Uso del software ── */}
      {totalHeartbeats > 0 && (
        <div className="px-5 py-3 border-b border-white/[0.07]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-texto-terciario/40" />
              <span className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider">Uso del software</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-texto-terciario/40">{totalHeartbeats} señales</span>
              <span className="text-[13px] font-medium text-insignia-info">{fmtDuracion(tiempoActivo)}</span>
            </div>
          </div>
          <div className="w-full h-1.5 rounded bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded bg-gradient-to-r from-insignia-info to-texto-marca transition-all duration-500"
              style={{ width: `${pctSoftware}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

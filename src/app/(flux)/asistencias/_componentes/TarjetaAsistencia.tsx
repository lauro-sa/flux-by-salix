'use client'

import { CheckCircle2, AlertTriangle, Clock, XCircle, Coffee, Footprints, Calendar, UtensilsCrossed } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

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

function fmtHoraCorta(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtFecha(fecha: string, locale: string): string {
  const d = new Date(fecha + 'T12:00:00')
  const dia = d.toLocaleDateString(locale, { weekday: 'short' }).replace(/^\w/, c => c.toUpperCase())
  const num = d.getDate()
  const mes = d.toLocaleDateString(locale, { month: 'long' }).replace(/^\w/, c => c.toUpperCase())
  return `${dia} ${num} De ${mes}`
}

function fmtDuracion(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
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

// ─── Config estados ──────────────────────────────────────────

const ESTADO_CFG: Record<string, { etiqueta: string; color: string; fondo: string; icono: React.ReactNode }> = {
  activo:       { etiqueta: 'En turno', color: 'text-emerald-400', fondo: 'bg-emerald-500/15 border-emerald-500/30', icono: <Clock size={11} /> },
  cerrado:      { etiqueta: 'Cerrado', color: 'text-emerald-400/70', fondo: 'bg-emerald-500/10 border-emerald-500/20', icono: <CheckCircle2 size={11} /> },
  auto_cerrado: { etiqueta: 'Sin salida', color: 'text-amber-400', fondo: 'bg-amber-500/15 border-amber-500/30', icono: <AlertTriangle size={11} /> },
  ausente:      { etiqueta: 'Ausente', color: 'text-red-400', fondo: 'bg-red-500/15 border-red-500/30', icono: <XCircle size={11} /> },
  almuerzo:     { etiqueta: 'Almorzando', color: 'text-amber-400', fondo: 'bg-amber-500/15 border-amber-500/30', icono: <Coffee size={11} /> },
  particular:   { etiqueta: 'Trámite', color: 'text-sky-400', fondo: 'bg-sky-500/15 border-sky-500/30', icono: <Footprints size={11} /> },
}

const COLORES_AVATAR = [
  'bg-indigo-500/25 text-indigo-400',
  'bg-emerald-500/25 text-emerald-400',
  'bg-amber-500/25 text-amber-400',
  'bg-red-500/25 text-red-400',
  'bg-purple-500/25 text-purple-400',
  'bg-cyan-500/25 text-cyan-400',
]

// ─── Segmentos de la barra de tiempo ─────────────────────────

interface Segmento {
  tipo: 'trabajo' | 'almuerzo' | 'tramite'
  minutos: number
  color: string
  icono?: string
}

function calcularSegmentos(r: RegistroAsistencia): Segmento[] {
  if (!r.hora_entrada) return []
  const entrada = new Date(r.hora_entrada).getTime()
  const salida = r.hora_salida ? new Date(r.hora_salida).getTime() : Date.now()
  const totalMin = Math.max(1, Math.round((salida - entrada) / 60000))

  const segmentos: { inicio: number; fin: number; tipo: 'trabajo' | 'almuerzo' | 'tramite' }[] = []

  // Recolectar pausas
  const pausas: { inicio: number; fin: number; tipo: 'almuerzo' | 'tramite' }[] = []

  if (r.inicio_almuerzo && r.fin_almuerzo) {
    pausas.push({
      inicio: new Date(r.inicio_almuerzo).getTime(),
      fin: new Date(r.fin_almuerzo).getTime(),
      tipo: 'almuerzo',
    })
  }

  if (r.salida_particular && r.vuelta_particular) {
    pausas.push({
      inicio: new Date(r.salida_particular).getTime(),
      fin: new Date(r.vuelta_particular).getTime(),
      tipo: 'tramite',
    })
  }

  // Ordenar pausas por inicio
  pausas.sort((a, b) => a.inicio - b.inicio)

  // Construir segmentos
  let cursor = entrada
  for (const pausa of pausas) {
    if (pausa.inicio > cursor) {
      segmentos.push({ inicio: cursor, fin: pausa.inicio, tipo: 'trabajo' })
    }
    segmentos.push({ inicio: pausa.inicio, fin: pausa.fin, tipo: pausa.tipo })
    cursor = pausa.fin
  }
  if (cursor < salida) {
    segmentos.push({ inicio: cursor, fin: salida, tipo: 'trabajo' })
  }

  // Convertir a minutos y colores
  const colores = { trabajo: 'bg-emerald-500/30', almuerzo: 'bg-amber-500/40', tramite: 'bg-sky-500/40' }

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

  // Calcular minutos netos
  const minBrutos = r.hora_entrada && r.hora_salida ? msToMin(r.hora_entrada, r.hora_salida) : 0
  const minAlmuerzo = r.inicio_almuerzo && r.fin_almuerzo ? msToMin(r.inicio_almuerzo, r.fin_almuerzo) : 0
  const minTramite = r.salida_particular && r.vuelta_particular ? msToMin(r.salida_particular, r.vuelta_particular) : 0
  const minNetos = Math.max(0, minBrutos - minAlmuerzo - minTramite)
  const dur = fmtDuracion(minNetos)

  const hash = r.miembro_nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const colorAvatar = COLORES_AVATAR[hash % COLORES_AVATAR.length]
  const colorDurTxt = r.estado === 'auto_cerrado' || r.tipo === 'tardanza' ? 'text-amber-400' : 'text-emerald-400'

  // Segmentos de la barra
  const segmentos = calcularSegmentos(r)
  const totalMinSegmentos = segmentos.reduce((s, seg) => s + seg.minutos, 0) || 1

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Header: avatar + nombre + badge */}
      <div className="flex items-center justify-between gap-2 pr-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colorAvatar}`}>
            {inicial(r.miembro_nombre)}
          </div>
          <span className="font-semibold text-texto-primario text-sm truncate">{r.miembro_nombre}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${cfg.fondo} ${cfg.color}`}>
          {cfg.icono}
          {cfg.etiqueta}
        </span>
      </div>

      {/* Fecha */}
      <p className="text-xs text-texto-terciario">{fmtFecha(r.fecha, locale)}</p>

      {/* Horarios + duración */}
      {r.estado !== 'ausente' && r.hora_entrada ? (
        <>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-lg font-mono font-semibold text-texto-primario tracking-tight">
              {fmtHora(r.hora_entrada, formatoHora)}
            </span>
            <span className="text-texto-terciario text-base">→</span>
            <span className="text-lg font-mono font-semibold text-texto-primario tracking-tight">
              {r.hora_salida ? fmtHora(r.hora_salida, formatoHora) : '…'}
            </span>
            <span className={`text-sm font-medium ${colorDurTxt}`}>
              · {dur}
            </span>
          </div>

          {/* Barra segmentada de tiempo */}
          <div className="w-full h-5 rounded-full bg-superficie-elevada/30 overflow-hidden flex">
            {segmentos.map((seg, i) => {
              const pct = (seg.minutos / totalMinSegmentos) * 100
              return (
                <div
                  key={i}
                  className={`h-full ${seg.color} flex items-center justify-center overflow-hidden transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${pct}%` }}
                  title={`${seg.tipo === 'trabajo' ? 'Trabajo' : seg.tipo === 'almuerzo' ? 'Almuerzo' : 'Trámite'}: ${fmtDurCorta(seg.minutos)}`}
                >
                  {pct > 8 && (
                    <span className="text-[8px] font-semibold text-texto-secundario whitespace-nowrap flex items-center gap-0.5">
                      {seg.tipo === 'almuerzo' && <span>🍽</span>}
                      {seg.tipo === 'tramite' && <span>🚶</span>}
                      {seg.tipo === 'trabajo' && <Calendar size={7} />}
                      {fmtDurCorta(seg.minutos)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Detalle: horas netas + almuerzo + trámite */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className={`font-medium ${colorDurTxt}`}>{dur} netos</span>

            {r.inicio_almuerzo && r.fin_almuerzo && (
              <span className="flex items-center gap-1 text-amber-400/80">
                <UtensilsCrossed size={11} />
                {fmtHoraCorta(r.inicio_almuerzo)}–{fmtHoraCorta(r.fin_almuerzo)} · {fmtDurCorta(minAlmuerzo)}
              </span>
            )}

            {r.salida_particular && r.vuelta_particular && (
              <span className="flex items-center gap-1 text-sky-400/80">
                <Footprints size={11} />
                {fmtHoraCorta(r.salida_particular)}–{fmtHoraCorta(r.vuelta_particular)} · {fmtDurCorta(minTramite)}
              </span>
            )}
          </div>
        </>
      ) : r.estado === 'activo' && r.hora_entrada ? (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-mono font-semibold text-texto-primario tracking-tight">
              {fmtHora(r.hora_entrada, formatoHora)}
            </span>
            <span className="text-texto-terciario text-base">→</span>
            <span className="text-lg font-mono text-texto-terciario tracking-tight">…</span>
          </div>
          <div className="w-full h-5 rounded-full bg-superficie-elevada/30 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500/25 transition-all duration-500 flex items-center justify-center" style={{ width: '100%' }}>
              <Calendar size={8} className="text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-texto-terciario">En jornada...</p>
        </>
      ) : (
        <p className="text-xs text-red-400/60 py-2">Sin registro de asistencia</p>
      )}
    </div>
  )
}

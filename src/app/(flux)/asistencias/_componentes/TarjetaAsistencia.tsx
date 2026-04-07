'use client'

import { CheckCircle2, AlertTriangle, Clock, XCircle, Coffee, Footprints, Calendar } from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────

interface RegistroAsistencia {
  id: string
  miembro_nombre: string
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  inicio_almuerzo: string | null
  fin_almuerzo: string | null
  estado: string
  tipo: string
  metodo_registro: string
}

// ─── Helpers ─────────────────────────────────────────────────

function fmtHora24(iso: string | null): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtFecha(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  const dia = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace(/^\w/, c => c.toUpperCase())
  const num = d.getDate()
  const mes = d.toLocaleDateString('es-AR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())
  return `${dia} ${num} De ${mes}`
}

function calcMin(entrada: string | null, salida: string | null, inicioAlm: string | null, finAlm: string | null): number {
  if (!entrada) return 0
  const fin = salida ? new Date(salida).getTime() : Date.now()
  let min = Math.round((fin - new Date(entrada).getTime()) / 60000)
  if (inicioAlm && finAlm) {
    min -= Math.round((new Date(finAlm).getTime() - new Date(inicioAlm).getTime()) / 60000)
  }
  return Math.max(0, min)
}

function fmtDuracion(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function inicial(nombre: string): string {
  return nombre.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// ─── Config de estados ───────────────────────────────────────

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

const JORNADA_REF = 8 * 60

// ─── Componente ──────────────────────────────────────────────

export function TarjetaAsistencia({ registro }: { registro: RegistroAsistencia }) {
  const r = registro
  const cfg = ESTADO_CFG[r.estado] || ESTADO_CFG.cerrado
  const min = calcMin(r.hora_entrada, r.hora_salida, r.inicio_almuerzo, r.fin_almuerzo)
  const dur = fmtDuracion(min)
  const pct = Math.min(100, Math.round((min / JORNADA_REF) * 100))

  const hash = r.miembro_nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const colorAvatar = COLORES_AVATAR[hash % COLORES_AVATAR.length]

  // Color barra (transparente para que el texto sea legible)
  const colorBarra = r.estado === 'ausente' ? 'bg-red-500/25'
    : r.estado === 'auto_cerrado' ? 'bg-amber-500/25'
    : r.tipo === 'tardanza' ? 'bg-amber-500/25'
    : r.estado === 'activo' ? 'bg-emerald-500/25'
    : 'bg-emerald-500/25'

  // Color duración texto
  const colorDurTxt = r.estado === 'auto_cerrado' || r.tipo === 'tardanza' ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Header: avatar + nombre + badge (pr-6 para no chocar con checkbox) */}
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
      <p className="text-xs text-texto-terciario">{fmtFecha(r.fecha)}</p>

      {/* Horarios + duración en una línea */}
      {r.estado !== 'ausente' && r.hora_entrada ? (
        <>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-lg font-mono font-semibold text-texto-primario tracking-tight">
              {fmtHora24(r.hora_entrada)}
            </span>
            <span className="text-texto-terciario text-base">→</span>
            <span className="text-lg font-mono font-semibold text-texto-primario tracking-tight">
              {r.hora_salida ? fmtHora24(r.hora_salida) : '…'}
            </span>
            <span className={`text-sm font-medium ${colorDurTxt}`}>
              · {dur}
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="w-full h-5 rounded-full bg-superficie-elevada/30 overflow-hidden">
            <div
              className={`h-full rounded-full ${colorBarra} transition-all duration-500 flex items-center justify-center`}
              style={{ width: `${Math.max(pct, 15)}%` }}
            >
              <span className="text-[9px] font-semibold whitespace-nowrap flex items-center gap-0.5 text-texto-secundario">
                <Calendar size={8} /> {dur}
              </span>
            </div>
          </div>

          {/* Horas netas */}
          <p className={`text-xs font-medium ${colorDurTxt} -mt-0.5`}>
            {dur} netos
          </p>
        </>
      ) : r.estado === 'activo' && r.hora_entrada ? (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-mono font-semibold text-texto-primario tracking-tight">
              {fmtHora24(r.hora_entrada)}
            </span>
            <span className="text-texto-terciario text-base">→</span>
            <span className="text-lg font-mono text-texto-terciario tracking-tight">…</span>
          </div>
          <div className="w-full h-5 rounded-full bg-superficie-elevada/30 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500/25 transition-all duration-500 flex items-center justify-center" style={{ width: '100%' }}>
              <Calendar size={8} className="text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-texto-terciario -mt-0.5">En jornada...</p>
        </>
      ) : (
        <p className="text-xs text-red-400/60 py-2">Sin registro de asistencia</p>
      )}
    </div>
  )
}

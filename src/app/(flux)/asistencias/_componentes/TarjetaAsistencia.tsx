'use client'

import { CheckCircle2, AlertTriangle, Clock, XCircle, Coffee, Footprints } from 'lucide-react'

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

function formatearHora(iso: string | null): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatearFechaLarga(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase())
}

function calcularMinutos(entrada: string | null, salida: string | null, inicioAlm: string | null, finAlm: string | null): number {
  if (!entrada) return 0
  const fin = salida ? new Date(salida).getTime() : Date.now()
  let min = Math.round((fin - new Date(entrada).getTime()) / 60000)
  if (inicioAlm && finAlm) {
    min -= Math.round((new Date(finAlm).getTime() - new Date(inicioAlm).getTime()) / 60000)
  }
  return Math.max(0, min)
}

function formatearDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function iniciales(nombre: string): string {
  return nombre.split(' ').map(p => p[0]).filter(Boolean).slice(0, 1).join('').toUpperCase()
}

// Estado config
const ESTADO_CONFIG: Record<string, { etiqueta: string; color: string; fondo: string; icono: React.ReactNode }> = {
  activo:       { etiqueta: 'En turno', color: 'text-sky-400', fondo: 'bg-sky-500/15', icono: <Clock size={12} /> },
  cerrado:      { etiqueta: 'Cerrado', color: 'text-emerald-400', fondo: 'bg-emerald-500/15', icono: <CheckCircle2 size={12} /> },
  auto_cerrado: { etiqueta: 'Sin salida', color: 'text-amber-400', fondo: 'bg-amber-500/15', icono: <AlertTriangle size={12} /> },
  ausente:      { etiqueta: 'Ausente', color: 'text-red-400', fondo: 'bg-red-500/15', icono: <XCircle size={12} /> },
  almuerzo:     { etiqueta: 'Almorzando', color: 'text-amber-400', fondo: 'bg-amber-500/15', icono: <Coffee size={12} /> },
  particular:   { etiqueta: 'Trámite', color: 'text-sky-400', fondo: 'bg-sky-500/15', icono: <Footprints size={12} /> },
}

const COLORES_AVATAR = [
  'bg-indigo-500/20 text-indigo-400',
  'bg-emerald-500/20 text-emerald-400',
  'bg-amber-500/20 text-amber-400',
  'bg-red-500/20 text-red-400',
  'bg-purple-500/20 text-purple-400',
  'bg-cyan-500/20 text-cyan-400',
]

// Barra de progreso: porcentaje sobre 8h (jornada típica)
const JORNADA_REFERENCIA_MIN = 8 * 60

// ─── Componente ──────────────────────────────────────────────

export function TarjetaAsistencia({ registro }: { registro: RegistroAsistencia }) {
  const r = registro
  const estadoCfg = ESTADO_CONFIG[r.estado] || ESTADO_CONFIG.cerrado
  const minutos = calcularMinutos(r.hora_entrada, r.hora_salida, r.inicio_almuerzo, r.fin_almuerzo)
  const duracion = formatearDuracion(minutos)
  const porcentaje = Math.min(100, Math.round((minutos / JORNADA_REFERENCIA_MIN) * 100))

  // Color avatar basado en hash del nombre
  const hashNombre = r.miembro_nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const colorAvatar = COLORES_AVATAR[hashNombre % COLORES_AVATAR.length]

  // Color de la barra según estado
  const colorBarra = r.estado === 'ausente' ? 'bg-red-400'
    : r.estado === 'auto_cerrado' ? 'bg-amber-400'
    : r.tipo === 'tardanza' ? 'bg-amber-400'
    : 'bg-emerald-400'

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Header: avatar + nombre + badge estado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`size-10 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${colorAvatar}`}>
            {iniciales(r.miembro_nombre)}
          </div>
          <span className="font-semibold text-texto-primario">{r.miembro_nombre}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${estadoCfg.fondo} ${estadoCfg.color}`}>
          {estadoCfg.icono}
          {estadoCfg.etiqueta}
        </span>
      </div>

      {/* Fecha */}
      <p className="text-sm text-texto-secundario -mt-1">
        {formatearFechaLarga(r.fecha)}
      </p>

      {/* Horarios grandes */}
      {r.estado !== 'ausente' && r.hora_entrada && (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-texto-primario tracking-tight">
              {formatearHora(r.hora_entrada)}
            </span>
            <span className="text-texto-terciario text-lg">→</span>
            <span className="text-2xl font-mono font-bold text-texto-primario tracking-tight">
              {r.hora_salida ? formatearHora(r.hora_salida) : '--:--'}
            </span>
            <span className={`text-sm font-medium ml-1 ${
              r.tipo === 'tardanza' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              · {duracion}
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="w-full">
            <div className="w-full h-6 rounded-full bg-superficie-elevada/60 overflow-hidden flex items-center relative">
              <div
                className={`h-full rounded-full ${colorBarra} transition-all duration-500 flex items-center justify-center`}
                style={{ width: `${Math.max(porcentaje, 8)}%` }}
              >
                <span className="text-[10px] font-semibold text-white/90 whitespace-nowrap px-2">
                  📅 {duracion}
                </span>
              </div>
            </div>
          </div>

          {/* Horas netas */}
          <p className="text-sm font-medium text-emerald-400 -mt-1">
            {duracion} netos
          </p>
        </>
      )}

      {/* Ausente */}
      {r.estado === 'ausente' && (
        <div className="flex items-center justify-center py-4">
          <span className="text-red-400/60 text-sm">Sin registro de asistencia</span>
        </div>
      )}
    </div>
  )
}

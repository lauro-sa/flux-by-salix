'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, UserCheck, UserX, Clock, Monitor, Pencil,
  AlertTriangle, Coffee, Footprints, CheckCircle2,
} from 'lucide-react'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'
import { Boton } from '@/componentes/ui/Boton'
import { formatearPuntualidad } from '@/lib/constantes/asistencias'

// ─── Tipos ───────────────────────────────────────────────────

interface AsistenciaHoy {
  presentes: number
  ausentes: number
  tardanzas: number
  total: number
}

interface DetalleMiembro {
  miembro_id: string
  usuario_id: string
  nombre: string
  estado: string
  tipo: string
  hora_entrada: string | null
  hora_salida: string | null
  puntualidad_min: number | null
  metodo_registro: string
}

interface Props {
  hoy: AsistenciaHoy
  detalle_hoy: DetalleMiembro[]
  semana: Record<string, { presentes: number; ausentes: number; tardanzas: number }>
  usuario_id: string
}

// ─── Helpers ─────────────────────────────────────────────────

function fmtHora(iso: string | null): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function inicial(nombre: string): string {
  return nombre.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const COLORES_AVATAR = [
  'bg-indigo-500/25 text-indigo-400',
  'bg-emerald-500/25 text-emerald-400',
  'bg-amber-500/25 text-amber-400',
  'bg-red-500/25 text-red-400',
  'bg-purple-500/25 text-purple-400',
  'bg-cyan-500/25 text-cyan-400',
]

const ICONO_ESTADO: Record<string, React.ReactNode> = {
  activo: <CheckCircle2 size={11} className="text-emerald-400" />,
  cerrado: <CheckCircle2 size={11} className="text-emerald-400/60" />,
  almuerzo: <Coffee size={11} className="text-amber-400" />,
  particular: <Footprints size={11} className="text-sky-400" />,
  auto_cerrado: <AlertTriangle size={11} className="text-amber-400" />,
  ausente: <UserX size={11} className="text-red-400" />,
}

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: 'En turno',
  cerrado: 'Cerrado',
  almuerzo: 'Almorzando',
  particular: 'Trámite',
  auto_cerrado: 'Sin salida',
  ausente: 'Ausente',
}

// ─── Componente ──────────────────────────────────────────────

export function WidgetAsistencia({ hoy, detalle_hoy, semana, usuario_id }: Props) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<'todos' | 'tardanzas' | 'ausentes'>('todos')

  if (hoy.total === 0 && Object.keys(semana).length === 0) return null

  // Mi fichaje
  const miFichaje = detalle_hoy.find(d => d.usuario_id === usuario_id)
  const pctPresentes = hoy.total > 0 ? Math.round((hoy.presentes / hoy.total) * 100) : 0

  // Filtrar lista del equipo
  const listaFiltrada = filtro === 'tardanzas'
    ? detalle_hoy.filter(d => d.tipo === 'tardanza')
    : filtro === 'ausentes'
      ? detalle_hoy.filter(d => d.estado === 'ausente')
      : detalle_hoy

  // Ordenar: activos primero, luego tardanzas, luego ausentes
  const listaOrdenada = [...listaFiltrada].sort((a, b) => {
    const orden: Record<string, number> = { activo: 0, almuerzo: 1, particular: 2, cerrado: 3, auto_cerrado: 4, ausente: 5 }
    return (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9)
  })

  // ─── Pestaña: Mi jornada ───
  const contenidoMio = (
    <div className="space-y-3">
      {miFichaje ? (
        <>
          {/* Estado + hora */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`size-2.5 rounded-full ${
                miFichaje.estado === 'activo' ? 'bg-emerald-400' :
                miFichaje.estado === 'almuerzo' ? 'bg-amber-400' :
                miFichaje.estado === 'cerrado' ? 'bg-texto-terciario' : 'bg-red-400'
              }`} />
              <span className="text-sm font-medium text-texto-primario">
                {ETIQUETA_ESTADO[miFichaje.estado] || miFichaje.estado}
              </span>
            </div>
            <span className="text-xs text-texto-terciario flex items-center gap-1">
              {miFichaje.metodo_registro === 'automatico' ? <Monitor size={11} /> : <Pencil size={11} />}
              {miFichaje.metodo_registro === 'automatico' ? 'Auto' : 'Manual'}
            </span>
          </div>

          {/* Horarios grandes */}
          <div className="text-center py-2">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-2xl font-bold text-texto-primario tabular-nums">{fmtHora(miFichaje.hora_entrada)}</span>
              <span className="text-texto-terciario/40">→</span>
              <span className="text-2xl font-bold text-texto-terciario/50 tabular-nums">
                {miFichaje.hora_salida && !['activo', 'almuerzo', 'particular'].includes(miFichaje.estado)
                  ? fmtHora(miFichaje.hora_salida)
                  : '…'
                }
              </span>
            </div>
            {/* Duración */}
            {miFichaje.hora_entrada && (() => {
              const entrada = new Date(miFichaje.hora_entrada!).getTime()
              const salida = miFichaje.hora_salida ? new Date(miFichaje.hora_salida).getTime() : Date.now()
              const min = Math.max(0, Math.round((salida - entrada) / 60000))
              const h = Math.floor(min / 60)
              const m = min % 60
              return (
                <div className="flex items-baseline justify-center gap-0.5 mt-1">
                  {h > 0 && <><span className="text-3xl font-bold text-texto-primario">{h}</span><span className="text-lg text-texto-terciario/50">h</span></>}
                  <span className="text-3xl font-bold text-texto-primario">{String(m).padStart(h > 0 ? 2 : 1, '0')}</span>
                  <span className="text-lg text-texto-terciario/50">m</span>
                </div>
              )
            })()}
          </div>

          {/* Puntualidad */}
          {miFichaje.puntualidad_min != null && miFichaje.puntualidad_min !== 0 && (() => {
            const p = formatearPuntualidad(miFichaje.puntualidad_min)
            return p ? (
              <p className={`text-xs text-center font-medium ${p.color}`}>{p.texto}</p>
            ) : null
          })()}
        </>
      ) : (
        <div className="text-center py-6">
          <UserX size={24} className="mx-auto text-texto-terciario/30 mb-2" />
          <p className="text-sm text-texto-terciario">Sin fichaje hoy</p>
          <p className="text-xxs text-texto-terciario/50 mt-1">Tu entrada se registrará automáticamente</p>
        </div>
      )}
    </div>
  )

  // ─── Pestaña: Equipo ───
  const contenidoEquipo = (
    <div className="space-y-3">
      {/* Resumen con ring + stats */}
      <div className="flex items-center gap-5">
        {/* Ring */}
        <div className="relative size-16 flex items-center justify-center shrink-0">
          <svg className="size-16 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--superficie-hover)" strokeWidth="3.5" />
            <circle
              cx="18" cy="18" r="14" fill="none"
              stroke="var(--insignia-exito-texto)"
              strokeWidth="3.5"
              strokeDasharray={`${pctPresentes} ${100 - pctPresentes}`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <span className="absolute text-sm font-bold text-texto-primario">{pctPresentes}%</span>
        </div>

        {/* Stats inline */}
        <div className="flex-1 grid grid-cols-3 gap-2">
          <button
            onClick={() => setFiltro(f => f === 'todos' ? 'todos' : 'todos')}
            className={`text-center py-1.5 rounded-lg transition-colors ${filtro === 'todos' ? 'bg-emerald-500/10' : 'hover:bg-superficie-hover/50'}`}
          >
            <span className="text-lg font-bold text-emerald-400">{hoy.presentes}</span>
            <p className="text-xxs text-texto-terciario">Ok</p>
          </button>
          <button
            onClick={() => setFiltro(f => f === 'tardanzas' ? 'todos' : 'tardanzas')}
            className={`text-center py-1.5 rounded-lg transition-colors ${filtro === 'tardanzas' ? 'bg-amber-500/10' : 'hover:bg-superficie-hover/50'}`}
          >
            <span className="text-lg font-bold text-amber-400">{hoy.tardanzas}</span>
            <p className="text-xxs text-texto-terciario">Tarde</p>
          </button>
          <button
            onClick={() => setFiltro(f => f === 'ausentes' ? 'todos' : 'ausentes')}
            className={`text-center py-1.5 rounded-lg transition-colors ${filtro === 'ausentes' ? 'bg-red-500/10' : 'hover:bg-superficie-hover/50'}`}
          >
            <span className="text-lg font-bold text-red-400">{hoy.ausentes}</span>
            <p className="text-xxs text-texto-terciario">Ausente</p>
          </button>
        </div>
      </div>

      {/* Lista de miembros */}
      <div className="space-y-0.5 max-h-[200px] overflow-y-auto -mx-1 px-1">
        {listaOrdenada.map((d, i) => {
          const hash = d.nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
          const colorAv = COLORES_AVATAR[hash % COLORES_AVATAR.length]
          const punt = formatearPuntualidad(d.puntualidad_min)

          return (
            <div
              key={d.miembro_id}
              className="flex items-center gap-2 py-1.5 px-1.5 rounded-lg hover:bg-superficie-hover/30 transition-colors"
            >
              {/* Avatar */}
              <div className={`size-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${colorAv}`}>
                {inicial(d.nombre)}
              </div>

              {/* Nombre + estado */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-texto-primario truncate">{d.nombre}</p>
                <div className="flex items-center gap-1">
                  {ICONO_ESTADO[d.estado]}
                  <span className="text-[10px] text-texto-terciario">
                    {d.estado === 'ausente' ? 'Ausente' : fmtHora(d.hora_entrada)}
                  </span>
                  {punt && d.puntualidad_min !== 0 && (
                    <span className={`text-[10px] ${punt.color}`}>· {punt.texto}</span>
                  )}
                </div>
              </div>

              {/* Hora salida o estado */}
              <div className="text-right shrink-0">
                {d.estado !== 'ausente' && (
                  <span className="text-[11px] text-texto-terciario tabular-nums">
                    {d.hora_salida && !['activo', 'almuerzo', 'particular'].includes(d.estado)
                      ? fmtHora(d.hora_salida)
                      : '—'
                    }
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {listaOrdenada.length === 0 && (
          <p className="text-xs text-texto-terciario text-center py-3">
            {filtro === 'tardanzas' ? 'Sin tardanzas hoy' : filtro === 'ausentes' ? 'Sin ausencias hoy' : 'Sin registros'}
          </p>
        )}
      </div>
    </div>
  )

  // ─── Pestaña: Semana ───
  const totalSemana = Object.values(semana).reduce(
    (acc, m) => ({
      presentes: acc.presentes + m.presentes,
      ausentes: acc.ausentes + m.ausentes,
      tardanzas: acc.tardanzas + m.tardanzas,
    }),
    { presentes: 0, ausentes: 0, tardanzas: 0 }
  )
  const totalRegistros = totalSemana.presentes + totalSemana.ausentes + totalSemana.tardanzas
  const pctSemana = totalRegistros > 0 ? Math.round((totalSemana.presentes / totalRegistros) * 100) : 0

  const contenidoSemana = (
    <div className="space-y-3">
      {/* Barra apilada */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-texto-terciario">Asistencia semanal</span>
          <span className="text-texto-primario font-semibold">{pctSemana}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-superficie-hover overflow-hidden flex">
          {totalRegistros > 0 && (
            <>
              <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${(totalSemana.presentes / totalRegistros) * 100}%` }} />
              <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${(totalSemana.tardanzas / totalRegistros) * 100}%` }} />
              <div className="h-full bg-red-400/60 transition-all duration-500" style={{ width: `${(totalSemana.ausentes / totalRegistros) * 100}%` }} />
            </>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="py-2 rounded-lg bg-superficie-hover/50">
          <span className="text-lg font-bold text-emerald-400">{totalSemana.presentes}</span>
          <p className="text-xxs text-texto-terciario">Presentes</p>
        </div>
        <div className="py-2 rounded-lg bg-superficie-hover/50">
          <span className="text-lg font-bold text-amber-400">{totalSemana.tardanzas}</span>
          <p className="text-xxs text-texto-terciario">Tardanzas</p>
        </div>
        <div className="py-2 rounded-lg bg-superficie-hover/50">
          <span className="text-lg font-bold text-red-400">{totalSemana.ausentes}</span>
          <p className="text-xxs text-texto-terciario">Ausentes</p>
        </div>
      </div>

      <p className="text-xxs text-texto-terciario text-center">
        {Object.keys(semana).length} miembros · {totalRegistros} registros
      </p>
    </div>
  )

  return (
    <TarjetaConPestanas
      titulo="Asistencia"
      pestanas={[
        { etiqueta: 'Mi jornada', contenido: contenidoMio },
        { etiqueta: 'Equipo', contenido: contenidoEquipo },
        { etiqueta: 'Semana', contenido: contenidoSemana },
      ]}
      acciones={
        <Boton variante="fantasma" tamano="xs" iconoDerecho={<ArrowRight size={12} />} onClick={() => router.push('/asistencias')}>
          Ver todo
        </Boton>
      }
    />
  )
}

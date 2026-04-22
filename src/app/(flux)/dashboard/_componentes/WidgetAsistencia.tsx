'use client'

import { useRouter } from 'next/navigation'
import { Monitor, Pencil, ArrowRight } from 'lucide-react'
import { formatearPuntualidad } from '@/lib/constantes/asistencias'

// ─── Tipos ───────────────────────────────────────────────────

interface AsistenciaHoy {
  presentes: number
  ausentes: number
  tardanzas: number
  total: number
}

interface DetalleMiembro {
  id: string
  miembro_id: string
  usuario_id: string
  nombre: string
  estado: string
  tipo: string
  hora_entrada: string | null
  hora_salida: string | null
  puntualidad_min: number | null
  metodo_registro: string
  sector: string | null
  puesto: string | null
  rol: string | null
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

function fmtDuracion(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`
}

function calcMinTrabajados(d: DetalleMiembro): number {
  if (!d.hora_entrada) return 0
  const entrada = new Date(d.hora_entrada).getTime()
  const estaAbierto = ['activo', 'almuerzo', 'particular'].includes(d.estado)
  const salida = estaAbierto ? Date.now() : (d.hora_salida ? new Date(d.hora_salida).getTime() : Date.now())
  return Math.max(0, Math.round((salida - entrada) / 60000))
}

const COLORES_AVATAR = [
  '#5B47E0', '#AB47BC', '#26A69A', '#F0923A',
  '#E2534A', '#3B82F6', '#8B5CF6', '#EC4899',
]

const JORNADA_MIN = 9 * 60

// ─── Componente ──────────────────────────────────────────────

export function WidgetAsistencia({ hoy, detalle_hoy, semana, usuario_id }: Props) {
  const router = useRouter()

  if (hoy.total === 0 && Object.keys(semana).length === 0) return null

  const miFichaje = detalle_hoy.find(d => d.usuario_id === usuario_id)
  const miMin = miFichaje ? calcMinTrabajados(miFichaje) : 0
  const miPct = Math.min(100, Math.round((miMin / JORNADA_MIN) * 100))

  // Ordenar por jerarquía: rol → sector → nombre
  const PESO_ROL: Record<string, number> = { propietario: 0, administrador: 1, gerente: 2, supervisor: 3, colaborador: 4 }
  const equipo = [...detalle_hoy].sort((a, b) => {
    const ra = PESO_ROL[a.rol || 'colaborador'] ?? 3
    const rb = PESO_ROL[b.rol || 'colaborador'] ?? 3
    if (ra !== rb) return ra - rb
    const sa = a.sector || 'zzz'
    const sb = b.sector || 'zzz'
    if (sa !== sb) return sa.localeCompare(sb)
    return a.nombre.localeCompare(b.nombre)
  })

  const totalSemana = Object.values(semana).reduce(
    (acc, m) => ({ presentes: acc.presentes + m.presentes, ausentes: acc.ausentes + m.ausentes, tardanzas: acc.tardanzas + m.tardanzas }),
    { presentes: 0, ausentes: 0, tardanzas: 0 }
  )
  const totalReg = totalSemana.presentes + totalSemana.ausentes + totalSemana.tardanzas
  const pctSemana = totalReg > 0 ? Math.round((totalSemana.presentes / totalReg) * 100) : 0

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <span className="text-[13px] font-medium text-texto-secundario">Asistencia</span>
        <button
          onClick={() => router.push('/asistencias')}
          className="text-[11px] text-texto-marca/60 hover:text-texto-marca transition-colors flex items-center gap-1"
        >
          Ver todo <ArrowRight size={10} />
        </button>
      </div>

      {/* ── Cuerpo: 2 columnas en desktop ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr]">

        {/* ═══ COLUMNA IZQUIERDA: Mi jornada ═══ */}
        <div className="px-4 pb-3 flex flex-col">
          {miFichaje ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className={`size-[7px] rounded-full ${
                    miFichaje.estado === 'activo' ? 'bg-asistencia-presente shadow-[0_0_5px_var(--asistencia-presente-fondo)]' :
                    miFichaje.estado === 'almuerzo' ? 'bg-asistencia-almuerzo' :
                    miFichaje.estado === 'cerrado' ? 'bg-texto-terciario' : 'bg-asistencia-ausente'
                  }`} />
                  <span className="text-xs font-medium text-texto-secundario">
                    {miFichaje.estado === 'activo' ? 'En turno' : miFichaje.estado === 'almuerzo' ? 'Almorzando' :
                     miFichaje.estado === 'particular' ? 'Trámite' : miFichaje.estado === 'cerrado' ? 'Cerrado' : miFichaje.estado}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-texto-terciario/40">
                  {miFichaje.metodo_registro === 'automatico' ? <Monitor size={11} /> : <Pencil size={11} />}
                  {miFichaje.metodo_registro === 'automatico' ? 'Auto' : 'Manual'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[22px] font-semibold text-texto-primario tracking-tight tabular-nums">{fmtHora(miFichaje.hora_entrada)}</span>
                <span className="text-sm text-texto-terciario/30">→</span>
                <span className="text-sm text-texto-terciario/50 tabular-nums">18:00</span>
                <span className="text-[11px] text-texto-terciario/40 ml-1">
                  · <strong className="text-texto-terciario/70 font-medium">{fmtDuracion(miMin)}</strong> trabajadas
                </span>
              </div>

              <div className="mt-2.5">
                <div className="h-[5px] rounded-sm bg-white/[0.07] overflow-hidden">
                  <div className="h-full rounded-sm bg-asistencia-presente transition-all duration-500" style={{ width: `${miPct}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  {[9, 11, 13, 15, 17].map(h => (
                    <span key={h} className="text-[9px] text-texto-terciario/25 tabular-nums">{h}</span>
                  ))}
                </div>
              </div>

              {/* Puntualidad si aplica */}
              {miFichaje.puntualidad_min != null && miFichaje.puntualidad_min !== 0 && (() => {
                const p = formatearPuntualidad(miFichaje.puntualidad_min)
                return p ? (
                  <span className={`inline-block text-[10px] font-medium px-1.5 py-px rounded mt-2 ${
                    miFichaje.puntualidad_min! > 0 ? 'bg-asistencia-tarde-fondo text-asistencia-tarde' : 'bg-asistencia-presente-fondo text-asistencia-presente'
                  }`}>{p.texto}</span>
                ) : null
              })()}
            </>
          ) : (
            <p className="text-xs text-texto-terciario py-4">Sin fichaje hoy — se registrará automáticamente</p>
          )}

          {/* ── Esta semana (debajo de mi jornada, pegado al fondo) ── */}
          {totalReg > 0 && (
            <div className="mt-auto pt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-medium text-texto-terciario/30 uppercase tracking-wider whitespace-nowrap">Esta semana</span>
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-texto-terciario/50">
                  {Object.keys(semana).length} miembros · {totalReg} reg.
                </span>
                <span className="text-xs font-medium text-texto-terciario/70">{pctSemana}%</span>
              </div>
              <div className="h-1.5 rounded-sm bg-white/[0.07] flex overflow-hidden">
                <div className="h-full bg-asistencia-presente transition-all" style={{ width: `${(totalSemana.presentes / totalReg) * 100}%` }} />
                <div className="h-full bg-asistencia-tarde transition-all" style={{ width: `${(totalSemana.tardanzas / totalReg) * 100}%` }} />
                <div className="h-full bg-asistencia-ausente transition-all" style={{ width: `${(totalSemana.ausentes / totalReg) * 100}%` }} />
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-[10px] text-texto-terciario/40">
                  <span className="size-[6px] rounded-full bg-asistencia-presente" />{totalSemana.presentes}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-texto-terciario/40">
                  <span className="size-[6px] rounded-full bg-asistencia-tarde" />{totalSemana.tardanzas}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-texto-terciario/40">
                  <span className="size-[6px] rounded-full bg-asistencia-ausente" />{totalSemana.ausentes}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Divisor vertical (solo desktop) */}
        <div className="hidden md:block bg-white/[0.07]" />

        {/* ═══ COLUMNA DERECHA: Equipo hoy ═══ */}
        {detalle_hoy.length > 0 && (
          <div className="border-t md:border-t-0 border-white/[0.07]">
            {/* Divider con label */}
            <div className="flex items-center gap-2 px-4 pt-2 pb-1">
              <span className="text-[10px] font-medium text-texto-terciario/30 uppercase tracking-wider whitespace-nowrap">Equipo hoy</span>
              <div className="flex-1 h-px bg-white/[0.07]" />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center px-4 pb-2">
              <div className="text-center py-1">
                <div className="text-base font-semibold tabular-nums text-asistencia-presente">{hoy.presentes}</div>
                <div className="text-[10px] text-texto-terciario/40">Ok</div>
              </div>
              <div className="w-px h-7 bg-white/[0.07]" />
              <div className="text-center py-1">
                <div className="text-base font-semibold tabular-nums text-asistencia-tarde">{hoy.tardanzas}</div>
                <div className="text-[10px] text-texto-terciario/40">Tarde</div>
              </div>
              <div className="w-px h-7 bg-white/[0.07]" />
              <div className="text-center py-1">
                <div className="text-base font-semibold tabular-nums text-asistencia-ausente">{hoy.ausentes}</div>
                <div className="text-[10px] text-texto-terciario/40">Ausente</div>
              </div>
              <div className="w-px h-7 bg-white/[0.07]" />
              <div className="text-center py-1">
                <div className="text-base font-semibold tabular-nums text-texto-terciario/50">{hoy.total}</div>
                <div className="text-[10px] text-texto-terciario/40">Total</div>
              </div>
            </div>

            {/* Lista miembros — 2 columnas en desktop */}
            <div className="pb-1.5 grid grid-cols-1 sm:grid-cols-2">
              {equipo.map((d, i) => {
                const colorAv = COLORES_AVATAR[i % COLORES_AVATAR.length]
                const min = calcMinTrabajados(d)
                const pct = Math.min(100, Math.round((min / JORNADA_MIN) * 100))
                const punt = formatearPuntualidad(d.puntualidad_min)

                let badgeTxt = ''
                let badgeColor = ''
                if (d.estado === 'ausente') {
                  badgeTxt = 'Ausente'
                  badgeColor = 'bg-asistencia-ausente-fondo text-asistencia-ausente'
                } else if (d.puntualidad_min != null && d.puntualidad_min !== 0 && punt) {
                  badgeTxt = punt.texto
                  badgeColor = d.puntualidad_min > 0 ? 'bg-asistencia-tarde-fondo text-asistencia-tarde' : 'bg-asistencia-presente-fondo text-asistencia-presente'
                } else if (d.puntualidad_min === 0) {
                  badgeTxt = 'Puntual'
                  badgeColor = 'bg-asistencia-presente-fondo text-asistencia-presente'
                }

                const barColor = d.estado === 'ausente' ? 'bg-asistencia-ausente/40' :
                  d.tipo === 'tardanza' ? 'bg-asistencia-tarde' : 'bg-asistencia-presente'

                return (
                  <div
                    key={d.miembro_id}
                    className="flex items-center gap-2.5 px-4 py-[6px] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => router.push(`/asistencias?detalle=${d.id}`)}
                  >
                    <div
                      className="size-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                      style={{ backgroundColor: colorAv }}
                    >
                      {inicial(d.nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-texto-primario/75">{d.nombre}</span>
                        {d.puesto && <span className="text-[10px] text-texto-terciario/30 truncate hidden sm:inline">· {d.puesto}</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[11px] text-texto-terciario/40 tabular-nums">
                          {d.estado === 'ausente' ? '—' : fmtHora(d.hora_entrada)}
                        </span>
                        {badgeTxt && (
                          <span className={`text-[10px] font-medium px-1.5 py-px rounded ${badgeColor}`}>
                            {badgeTxt}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <div className="w-12 h-[3px] rounded-sm bg-white/[0.07] overflow-hidden">
                        <div className={`h-full rounded-sm ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Padding inferior */}
    </div>
  )
}

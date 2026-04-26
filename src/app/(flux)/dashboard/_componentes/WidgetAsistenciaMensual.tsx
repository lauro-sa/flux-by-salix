'use client'

/**
 * WidgetAsistenciaMensual — Resumen de asistencia del equipo navegable mes a mes.
 *
 * Hero: total presentes/tardanzas/ausentes del mes + % puntualidad.
 * Lista: por miembro, días trabajados, tardanzas, ausencias, horas totales.
 * Navegación: flechas ← Hoy → para cambiar de mes.
 *
 * Usa endpoint dedicado `/api/dashboard/asistencia-mes?mes=YYYY-MM` para
 * no cargar histórico al inicio del dashboard.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ArrowRight, UserCheck, UserX, Clock, RotateCw } from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'
import { useEmpresa } from '@/hooks/useEmpresa'
import { MESES_LARGOS, leerCacheLocal, guardarCacheLocal } from './compartidos'

// TTL del caché local — mes en curso refresca seguido (asistencias entran a lo
// largo del día), meses pasados/futuros casi no cambian.
const TTL_MES_EN_CURSO = 10 * 60 * 1000        // 10 minutos
const TTL_MES_OTRO = 24 * 60 * 60 * 1000       // 24 horas

interface FilaMiembro {
  miembro_id: string
  nombre: string
  rol: string | null
  sector: string | null
  puesto: string | null
  dias_presente: number
  dias_tardanza: number
  dias_ausente: number
  minutos_trabajados: number
}

interface DatosMes {
  mes: string
  dias_laborales: number
  cant_miembros: number
  presentes_total: number
  tardanzas_total: number
  ausentes_total: number
  minutos_total: number
  pct_puntualidad: number
  filas: FilaMiembro[]
}

function formatoHoras(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function WidgetAsistenciaMensual() {
  const router = useRouter()
  const hoy = new Date()
  const claveHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const { empresa } = useEmpresa()
  const empresaId = (empresa as { id?: string } | null)?.id ?? ''
  const [mesSel, setMesSel] = useState(claveHoy)
  const [datos, setDatos] = useState<DatosMes | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const [forzarRecarga, setForzarRecarga] = useState(0)

  const claveCache = empresaId ? `flux:asistencia-mes:${empresaId}:${mesSel}` : ''

  useEffect(() => {
    if (!empresaId) return
    let cancelado = false

    const esCurso = mesSel === claveHoy
    const ttl = esCurso ? TTL_MES_EN_CURSO : TTL_MES_OTRO
    if (forzarRecarga === 0) {
      const cacheado = leerCacheLocal<DatosMes>(claveCache, ttl)
      if (cacheado) {
        setDatos(cacheado)
        setCargando(false)
        return
      }
    }

    if (datos) setRefrescando(true); else setCargando(true)
    fetch(`/api/dashboard/asistencia-mes?mes=${mesSel}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (cancelado || !d) return
        setDatos(d)
        guardarCacheLocal(claveCache, d)
      })
      .catch(() => {})
      .finally(() => {
        if (cancelado) return
        setCargando(false)
        setRefrescando(false)
      })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSel, empresaId, forzarRecarga, claveCache, claveHoy])

  const cambiarMes = (delta: number) => {
    const [a, m] = mesSel.split('-').map(Number)
    const f = new Date(a, m - 1 + delta, 1)
    setMesSel(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`)
    setVerTodos(false)
  }

  const [anioSel, mesNumSel] = mesSel.split('-').map(Number)
  const nombreMes = MESES_LARGOS[mesNumSel - 1]

  const filas = datos?.filas || []
  const VISIBLES_INICIAL = 5
  const filasVisibles = verTodos ? filas : filas.slice(0, VISIBLES_INICIAL)
  const ocultos = filas.length - filasVisibles.length

  // Color del % de puntualidad
  const pct = datos?.pct_puntualidad || 0
  const colorPct = pct >= 90 ? 'text-insignia-exito-texto'
    : pct >= 70 ? 'text-insignia-advertencia-texto'
    : 'text-insignia-peligro-texto'

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
      {/* Header con navegación de mes */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-borde-sutil">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            className="size-7 rounded-full border border-borde-sutil flex items-center justify-center text-texto-terciario hover:text-texto-primario hover:border-borde-fuerte transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMesSel(claveHoy)}
            className={`text-xs font-semibold uppercase tracking-widest px-2 py-1 transition-colors ${
              mesSel === claveHoy ? 'text-texto-marca' : 'text-texto-secundario hover:text-texto-primario'
            }`}
          >
            {nombreMes} {anioSel}
          </button>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            className="size-7 rounded-full border border-borde-sutil flex items-center justify-center text-texto-terciario hover:text-texto-primario hover:border-borde-fuerte transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-xxs uppercase tracking-widest text-texto-terciario">
            Asistencia equipo
          </span>
          <button
            type="button"
            onClick={() => setForzarRecarga((n) => n + 1)}
            disabled={refrescando || cargando}
            aria-label="Refrescar"
            title="Refrescar datos"
            className="size-6 rounded-full flex items-center justify-center text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover/60 transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            <RotateCw size={12} className={refrescando ? 'animate-spin' : ''} />
          </button>
          <InfoBoton
            titulo="Asistencia del equipo"
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Te muestra <strong className="text-texto-primario">cómo viene la asistencia de tu
                    equipo</strong> en el mes elegido: cuántos presentes, tardanzas y faltas, más el
                    detalle individual por persona.
                  </p>
                ),
              },
              {
                titulo: 'Las métricas',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-insignia-exito-texto">Presentes:</strong> días que cada
                      persona vino a tiempo.
                    </li>
                    <li>
                      <strong className="text-insignia-advertencia-texto">Tardanzas:</strong> días que
                      vino pero llegó tarde.
                    </li>
                    <li>
                      <strong className="text-insignia-peligro-texto">Ausentes:</strong> días que faltó
                      sin justificar (o con ausencia registrada).
                    </li>
                    <li>
                      <strong className="text-texto-primario">Horas:</strong> tiempo total trabajado en
                      el mes (entre entrada y salida, sin contar almuerzos).
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Qué es la puntualidad',
                contenido: (
                  <p>
                    Es el porcentaje de días que tu equipo llegó <strong className="text-texto-primario">a
                    tiempo</strong> sobre los días que asistió. Si tenés 100 días de asistencia y 10
                    fueron con tardanza, tu puntualidad es 90%.
                  </p>
                ),
              },
              {
                titulo: 'Cómo leerlo',
                contenido: (
                  <ul className="space-y-1.5 list-disc pl-4">
                    <li>Usá las flechas para navegar entre meses anteriores.</li>
                    <li>Los miembros que no tuvieron registros en el mes no aparecen en la lista.</li>
                    <li>Si la puntualidad cae mes a mes, hay un problema operativo —revisar.</li>
                  </ul>
                ),
              },
              {
                titulo: 'Cruzá con otros widgets',
                contenido: (
                  <ul className="space-y-2 list-none">
                    <li>
                      <strong className="text-texto-primario">Con &quot;Sueldos&quot;:</strong>{' '}
                      <span className="text-texto-terciario">la asistencia impacta directamente en la
                      nómina (el sistema descuenta días no trabajados).</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Órdenes de trabajo&quot;:</strong>{' '}
                      <span className="text-texto-terciario">si bajás en personal disponible y suben
                      las OT, hay riesgo de cuello de botella.</span>
                    </li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* Hero: KPIs del mes */}
      {cargando && !datos ? (
        <div className="px-4 sm:px-5 py-12 text-center text-xs text-texto-terciario">
          Cargando…
        </div>
      ) : datos ? (
        <>
          <div className="px-4 sm:px-5 py-4 sm:py-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <UserCheck size={11} className="text-insignia-exito-texto" />
                <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium">Presentes</p>
              </div>
              <p className="text-2xl sm:text-3xl font-light tabular-nums text-insignia-exito-texto leading-none">
                {datos.presentes_total}
              </p>
              <p className="text-xxs text-texto-terciario mt-1">a tiempo</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Clock size={11} className="text-insignia-advertencia-texto" />
                <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium">Tardanzas</p>
              </div>
              <p className="text-2xl sm:text-3xl font-light tabular-nums text-insignia-advertencia-texto leading-none">
                {datos.tardanzas_total}
              </p>
              <p className="text-xxs text-texto-terciario mt-1">llegaron tarde</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <UserX size={11} className="text-insignia-peligro-texto" />
                <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium">Ausentes</p>
              </div>
              <p className="text-2xl sm:text-3xl font-light tabular-nums text-insignia-peligro-texto leading-none">
                {datos.ausentes_total}
              </p>
              <p className="text-xxs text-texto-terciario mt-1">faltas</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium mb-1">
                Puntualidad
              </p>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl sm:text-3xl font-light tabular-nums leading-none ${colorPct}`}>
                  {datos.pct_puntualidad}
                </span>
                <span className={`text-base sm:text-lg font-light ${colorPct}`}>%</span>
              </div>
              <p className="text-xxs text-texto-terciario mt-1 tabular-nums">
                {datos.cant_miembros} {datos.cant_miembros === 1 ? 'persona' : 'personas'}
              </p>
            </div>
          </div>

          {/* Lista por miembro */}
          {filas.length > 0 ? (
            <div className="border-t border-borde-sutil/60 px-4 sm:px-5 py-4">
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-2">
                Detalle por persona
              </p>

              {/* Header de columnas (desktop) */}
              <div className="hidden sm:grid grid-cols-[1fr_60px_60px_60px_70px] gap-3 px-3 pb-2 border-b border-borde-sutil/40 text-[10px] uppercase tracking-widest text-texto-terciario">
                <span>Miembro</span>
                <span className="text-right">Presente</span>
                <span className="text-right">Tarde</span>
                <span className="text-right">Faltas</span>
                <span className="text-right">Horas</span>
              </div>

              <div className="divide-y divide-borde-sutil/30">
                {filasVisibles.map((f) => (
                  <div
                    key={f.miembro_id}
                    className="px-3 py-2.5 flex flex-col sm:grid sm:grid-cols-[1fr_60px_60px_60px_70px] sm:items-center gap-2 sm:gap-3"
                  >
                    {/* Miembro */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-texto-primario truncate">{f.nombre}</p>
                      {(() => {
                        // Subtítulo: puesto · sector si existen, sino rol formateado
                        const partes = [f.puesto, f.sector].filter(Boolean)
                        const subtitulo = partes.length > 0
                          ? partes.join(' · ')
                          : f.rol
                            ? f.rol.charAt(0).toUpperCase() + f.rol.slice(1).replace('_', ' ')
                            : null
                        return subtitulo
                          ? <p className="text-xxs text-texto-terciario truncate">{subtitulo}</p>
                          : null
                      })()}
                    </div>

                    {/* Stats: en mobile como pills, en desktop como columnas */}
                    <div className="flex items-center gap-2 sm:hidden text-xxs flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-insignia-exito/30 bg-insignia-exito/[0.04]">
                        <span className="font-medium tabular-nums text-insignia-exito-texto">{f.dias_presente}</span>
                        <span className="text-texto-terciario">presente</span>
                      </span>
                      {f.dias_tardanza > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-insignia-advertencia/30 bg-insignia-advertencia/[0.04]">
                          <span className="font-medium tabular-nums text-insignia-advertencia-texto">{f.dias_tardanza}</span>
                          <span className="text-texto-terciario">tarde</span>
                        </span>
                      )}
                      {f.dias_ausente > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-insignia-peligro/30 bg-insignia-peligro/[0.04]">
                          <span className="font-medium tabular-nums text-insignia-peligro-texto">{f.dias_ausente}</span>
                          <span className="text-texto-terciario">faltas</span>
                        </span>
                      )}
                      {f.minutos_trabajados > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-borde-sutil">
                          <span className="font-medium tabular-nums text-texto-primario">{formatoHoras(f.minutos_trabajados)}</span>
                        </span>
                      )}
                    </div>

                    <span className="hidden sm:block text-right text-sm text-insignia-exito-texto tabular-nums font-medium">
                      {f.dias_presente}
                    </span>
                    <span className="hidden sm:block text-right text-sm text-insignia-advertencia-texto tabular-nums font-medium">
                      {f.dias_tardanza > 0 ? f.dias_tardanza : '—'}
                    </span>
                    <span className="hidden sm:block text-right text-sm text-insignia-peligro-texto tabular-nums font-medium">
                      {f.dias_ausente > 0 ? f.dias_ausente : '—'}
                    </span>
                    <span className="hidden sm:block text-right text-xs text-texto-secundario tabular-nums">
                      {f.minutos_trabajados > 0 ? formatoHoras(f.minutos_trabajados) : '—'}
                    </span>
                  </div>
                ))}
              </div>

              {ocultos > 0 && (
                <button
                  type="button"
                  onClick={() => setVerTodos(true)}
                  className="w-full text-center mt-3 text-xs text-texto-terciario hover:text-texto-marca transition-colors"
                >
                  + {ocultos} {ocultos === 1 ? 'persona más' : 'personas más'}
                </button>
              )}
              {verTodos && filas.length > VISIBLES_INICIAL && (
                <button
                  type="button"
                  onClick={() => setVerTodos(false)}
                  className="w-full text-center mt-3 text-xs text-texto-terciario hover:text-texto-marca transition-colors"
                >
                  Ver menos
                </button>
              )}
            </div>
          ) : (
            <div className="px-4 sm:px-5 py-12 text-center text-xs text-texto-terciario">
              No hay registros de asistencia en {nombreMes} {anioSel}.
            </div>
          )}
        </>
      ) : (
        <div className="px-4 sm:px-5 py-12 text-center text-xs text-texto-terciario">
          No se pudieron cargar los datos.
        </div>
      )}

      {/* Footer */}
      <button
        type="button"
        onClick={() => router.push('/asistencias')}
        className="w-full px-4 sm:px-5 py-2.5 border-t border-borde-sutil/60 text-xxs text-texto-terciario hover:text-texto-marca transition-colors inline-flex items-center justify-center gap-1"
      >
        Ver asistencias detalladas <ArrowRight className="size-3" />
      </button>
    </div>
  )
}

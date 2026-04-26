'use client'

/**
 * WidgetSueldos — Resumen de nómina del mes con navegación + detalle por persona.
 *
 * Hero: A pagar al día / Pagado / Estimado del mes / Adelantos.
 * Lista: cada miembro agrupado, con sus pagos del mes (pueden ser semanales,
 * quincenales, mensuales según compensacion_frecuencia). Click expande detalle.
 *
 * Endpoint dedicado `/api/dashboard/sueldos-mes?mes=YYYY-MM`.
 * Permiso: `nomina:ver_todos`.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  ArrowRight, Wallet, Check, TrendingDown, RotateCw,
} from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'
import { useEmpresa } from '@/hooks/useEmpresa'
import { MESES_LARGOS, formatoCompacto, fmtFechaCorta, leerCacheLocal, guardarCacheLocal } from './compartidos'

// TTL del caché local: el mes en curso refresca seguido (puede cambiar al
// cargar un pago / asistencia), mientras que meses pasados o futuros casi
// no cambian — los cacheamos un día para evitar fetches innecesarios.
const TTL_MES_EN_CURSO = 10 * 60 * 1000        // 10 minutos
const TTL_MES_OTRO = 24 * 60 * 60 * 1000       // 24 horas

const ETIQUETA_FRECUENCIA: Record<string, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  eventual: 'Eventual',
}

const ETIQUETA_TIPO: Record<string, string> = {
  fijo: 'Sueldo fijo',
  por_dia: 'Por día',
  por_hora: 'Por hora',
}

type EstadoPago = 'pagado' | 'parcial' | 'pendiente' | 'a_favor'

interface DetallePago {
  pago_id: string
  concepto: string | null
  fecha_inicio_periodo: string | null
  fecha_fin_periodo: string | null
  fecha_pago: string | null
  sugerido: number
  abonado: number
  pendiente: number
  a_favor: number
  estado: EstadoPago
  dias_habiles: number | null
  dias_trabajados: number | null
  dias_ausentes: number | null
  tardanzas: number | null
  notas: string | null
}

interface ResumenAdelanto {
  cant_adelantos: number
  monto_total: number
  monto_descontado: number
  monto_pendiente: number
  cuotas_pendientes: number
  adelantos: Array<{
    id: string
    descripcion: string | null
    monto_total: number
    monto_descontado: number
    monto_pendiente: number
    cuotas_totales: number | null
    cuotas_descontadas: number | null
    cuotas_pendientes: number
    estado: string
    frecuencia_descuento: string | null
    fecha_solicitud: string | null
  }>
}

interface FilaMiembro {
  miembro_id: string
  nombre: string
  rol: string | null
  puesto: string | null
  sector: string | null
  compensacion_tipo: string | null
  compensacion_frecuencia: string | null
  compensacion_monto: number | null
  cant_pagos: number
  sugerido: number
  abonado: number
  pendiente: number
  a_favor: number
  estado: EstadoPago
  pagos: DetallePago[]
  // Proyección del mes (basada en frecuencia + compensación)
  sugerido_cargado: number
  periodos_esperados: number
  periodos_faltantes: number
  tiene_proyeccion: boolean
  // Devengado al día de hoy
  sugerido_a_la_fecha: number
  pendiente_a_la_fecha: number
  adelantos: ResumenAdelanto | null
  adelanto_descontado_mes: number
  cuotas_descontadas_mes: number
}

interface DatosMes {
  mes: string
  /** Proyección total del mes (al cierre) */
  sugerido_total: number
  /** Lo devengado al día de hoy (cuánto debería estar pagado) */
  sugerido_a_la_fecha_total: number
  pendiente_a_la_fecha_total: number
  cant_pendientes_a_la_fecha: number
  abonado_total: number
  pendiente_total: number
  a_favor_total: number
  cant_miembros: number
  cant_pendientes: number
  cant_pagados: number
  cant_pagos_total: number
  /** Contexto temporal del mes consultado */
  es_mes_pasado: boolean
  es_mes_futuro: boolean
  es_mes_en_curso: boolean
  adelantos_activos_personas: number
  adelantos_monto_total: number
  adelantos_pendiente_total: number
  miembros: FilaMiembro[]
  _debug?: {
    empresa_id_actual: string
    total_pagos_traidos_total?: number
    total_pagos_empresa: number
    meses_con_pagos: string[]
    error_query?: string | null
    muestra_global?: Array<{
      empresa_id: string | null
      fecha_fin_periodo: string | null
      monto_sugerido: string | number | null
      eliminado: boolean | null
      coincide_empresa: boolean
    }>
  }
}

interface Props {
  formatoMoneda: (n: number) => string
}

const COLORES_ESTADO: Record<EstadoPago, { texto: string; bg: string; borde: string; etiqueta: string }> = {
  pagado: {
    texto: 'text-insignia-exito-texto',
    bg: 'bg-insignia-exito/[0.08]',
    borde: 'border-insignia-exito/30',
    etiqueta: 'Pagado',
  },
  parcial: {
    texto: 'text-insignia-advertencia-texto',
    bg: 'bg-insignia-advertencia/[0.08]',
    borde: 'border-insignia-advertencia/30',
    etiqueta: 'Parcial',
  },
  pendiente: {
    texto: 'text-insignia-peligro-texto',
    bg: 'bg-insignia-peligro/[0.08]',
    borde: 'border-insignia-peligro/30',
    etiqueta: 'Pendiente',
  },
  a_favor: {
    texto: 'text-texto-marca',
    bg: 'bg-texto-marca/[0.08]',
    borde: 'border-texto-marca/30',
    etiqueta: 'A favor',
  },
}

export function WidgetSueldos({ formatoMoneda }: Props) {
  const router = useRouter()
  const hoy = new Date()
  const claveHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const { empresa } = useEmpresa()
  const empresaId = (empresa as { id?: string } | null)?.id ?? ''
  const [mesSel, setMesSel] = useState(claveHoy)
  const [datos, setDatos] = useState<DatosMes | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  // Bumpear este número fuerza un refetch ignorando el caché local.
  const [forzarRecarga, setForzarRecarga] = useState(0)

  const claveCache = empresaId ? `flux:sueldos-mes:${empresaId}:${mesSel}` : ''

  useEffect(() => {
    if (!empresaId) return
    let cancelado = false

    // Si no es un refresh manual, intentamos servir desde caché local.
    // El TTL depende del mes: el mes en curso vence rápido (puede cambiar
    // con asistencias del día), los demás se cachean por un día.
    const esCurso = mesSel === claveHoy
    const ttl = esCurso ? TTL_MES_EN_CURSO : TTL_MES_OTRO
    if (forzarRecarga === 0) {
      const cacheado = leerCacheLocal<DatosMes>(claveCache, ttl)
      if (cacheado) {
        setDatos(cacheado)
        setError(null)
        setCargando(false)
        return
      }
    }

    if (datos) setRefrescando(true); else setCargando(true)
    setError(null)
    fetch(`/api/dashboard/sueldos-mes?mes=${mesSel}`)
      .then(async (r) => {
        if (cancelado) return
        if (!r.ok) {
          const errorData = await r.json().catch(() => null)
          setError(errorData?.error || `Error ${r.status}`)
          setDatos(null)
          return
        }
        const d = await r.json()
        if (cancelado) return
        setDatos(d)
        guardarCacheLocal(claveCache, d)
      })
      .catch((err) => {
        if (!cancelado) setError(err?.message || 'Error de red')
      })
      .finally(() => {
        if (cancelado) return
        setCargando(false)
        setRefrescando(false)
      })
    return () => { cancelado = true }
    // datos se omite a propósito: no queremos refetchear cuando setDatos cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSel, empresaId, forzarRecarga, claveCache, claveHoy])

  const cambiarMes = (delta: number) => {
    const [a, m] = mesSel.split('-').map(Number)
    const f = new Date(a, m - 1 + delta, 1)
    setMesSel(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`)
    setExpandidos(new Set())
  }

  const toggle = (miembroId: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(miembroId)) next.delete(miembroId)
      else next.add(miembroId)
      return next
    })
  }

  const [anioSel, mesNumSel] = mesSel.split('-').map(Number)
  const nombreMes = MESES_LARGOS[mesNumSel - 1]

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
          <Wallet size={14} className="hidden sm:block text-texto-marca" />
          <span className="hidden sm:inline text-xxs uppercase tracking-widest text-texto-terciario">
            Sueldos
          </span>
          {/* Refrescar manualmente — útil cuando cargás un pago/adelanto en otra
              pestaña y querés ver el resultado sin esperar el TTL del caché. */}
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
            titulo="Sueldos del mes"
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Te muestra <strong className="text-texto-primario">cuánto le tenés que pagar a tu
                    equipo</strong> en el mes elegido y cuánto ya pagaste. Cada empleado puede cobrar con
                    distinta frecuencia (semanal, quincenal, mensual o eventual), así que verás todos
                    los pagos del mes agrupados por persona.
                  </p>
                ),
              },
              {
                titulo: 'Los 4 indicadores del cabezal',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-texto-primario">A pagar al día:</strong> lo que YA tendrías
                      que haber pagado a la fecha de hoy según lo trabajado y los períodos cerrados
                      (no incluye el resto del mes).
                    </li>
                    <li>
                      <strong className="text-insignia-exito-texto">Pagado:</strong> lo que ya
                      transferiste al empleado en pagos cargados.
                    </li>
                    <li>
                      <strong className="text-texto-primario">Estimado del mes:</strong> proyección del
                      total a pagar al cierre del mes si trabaja todos los días esperados.
                    </li>
                    <li>
                      <strong className="text-texto-marca">Adelantos:</strong> saldo pendiente de
                      adelantos vivos del equipo (lo que se va a descontar en próximos pagos).
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Cómo se calcula al día',
                contenido: (
                  <ul className="space-y-1.5 list-disc pl-4">
                    <li>
                      <strong className="text-texto-primario">Sueldo fijo:</strong> proporcional a los
                      días transcurridos del mes (ej: día 15 = 50% del sueldo).
                    </li>
                    <li>
                      <strong className="text-texto-primario">Por día:</strong> cantidad de jornales
                      trabajados según asistencias hasta hoy × monto del jornal.
                    </li>
                    <li>
                      <strong className="text-texto-primario">Por hora:</strong> horas netas trabajadas
                      según asistencias hasta hoy × monto por hora.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Frecuencia de pago',
                contenido: (
                  <p>
                    Cada empleado tiene una <strong className="text-texto-primario">frecuencia de
                    pago</strong> configurada (semanal, quincenal, mensual o eventual). En un mes puede
                    haber 4-5 pagos a un empleado semanal, 2 a uno quincenal, 1 a uno mensual.
                  </p>
                ),
              },
              {
                titulo: 'Adelantos',
                contenido: (
                  <p>
                    Si le diste un adelanto a algún empleado, queda registrado y se descuenta en cuotas
                    de los próximos pagos. Acá ves cuánto le adeudás a la empresa cada uno y cuánto se
                    descontó este mes.
                  </p>
                ),
              },
              {
                titulo: 'Cómo leerlo',
                contenido: (
                  <ul className="space-y-1.5 list-disc pl-4">
                    <li>Click en una persona para ver el detalle de cada pago del mes.</li>
                    <li>Las personas pendientes aparecen primero (urgencia).</li>
                    <li>El número &quot;Adelanto descontado&quot; te dice cuánto le sacaste este mes para devolver el adelanto.</li>
                    <li>Si &quot;A pagar al día&quot; dice ✓ al día, no debés nada hasta hoy (aunque después del mes vaya a haber más).</li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
      </div>

      {error && !cargando ? (
        <div className="px-4 sm:px-5 py-12 text-center">
          <p className="text-xs text-insignia-peligro-texto font-medium mb-1">Error al cargar</p>
          <p className="text-xxs text-texto-terciario">{error}</p>
        </div>
      ) : cargando && !datos ? (
        <div className="px-4 sm:px-5 py-12 text-center text-xs text-texto-terciario">Cargando…</div>
      ) : datos ? (
        <>
          {/* Hero: 4 KPIs.
              Para el mes en curso: priorizar la deuda *al día de hoy* (lo devengado
              menos lo pagado). Para mes pasado/futuro, "al día" = total del mes. */}
          <div className="px-4 sm:px-5 py-4 sm:py-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* A pagar al día — lo devengado hasta hoy menos lo pagado */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium mb-1.5">
                {datos.es_mes_pasado ? 'A pagar' : datos.es_mes_futuro ? 'A pagar' : 'A pagar al día'}
              </p>
              {datos.pendiente_a_la_fecha_total > 0 ? (
                <>
                  <p
                    className="text-2xl sm:text-3xl font-light tabular-nums text-texto-primario leading-none whitespace-nowrap"
                    title={formatoMoneda(datos.pendiente_a_la_fecha_total)}
                  >
                    {formatoCompacto(datos.pendiente_a_la_fecha_total, formatoMoneda)}
                  </p>
                  <p className="text-xxs text-texto-terciario mt-2 tabular-nums">
                    <span className="text-insignia-peligro-texto font-medium">{datos.cant_pendientes_a_la_fecha}</span>
                    {' de '}
                    <span className="font-medium">{datos.cant_miembros}</span>
                    {' '}{datos.cant_miembros === 1 ? 'persona' : 'personas'}
                  </p>
                </>
              ) : datos.es_mes_futuro ? (
                <>
                  <p className="text-2xl sm:text-3xl font-light text-texto-terciario leading-none">—</p>
                  <p className="text-xxs text-texto-terciario mt-2">Mes futuro</p>
                </>
              ) : (
                <>
                  <p className="text-2xl sm:text-3xl font-light text-insignia-exito-texto leading-none">
                    ✓ al día
                  </p>
                  <p className="text-xxs text-texto-terciario mt-2">
                    {datos.cant_miembros} {datos.cant_miembros === 1 ? 'persona pagada' : 'personas pagadas'}
                  </p>
                </>
              )}
            </div>

            {/* Pagado — lo que ya transferiste */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium mb-1.5">
                Pagado
              </p>
              <p
                className="text-2xl sm:text-3xl font-light tabular-nums text-insignia-exito-texto leading-none whitespace-nowrap"
                title={formatoMoneda(datos.abonado_total)}
              >
                {formatoCompacto(datos.abonado_total, formatoMoneda)}
              </p>
              <p className="text-xxs text-texto-terciario mt-2 tabular-nums">
                {datos.es_mes_futuro
                  ? 'aún sin pagos'
                  : <>de {formatoCompacto(datos.sugerido_a_la_fecha_total, formatoMoneda)} al día</>}
              </p>
            </div>

            {/* Estimado del mes — proyección al cierre */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium mb-1.5">
                Estimado del mes
              </p>
              <p
                className="text-2xl sm:text-3xl font-light tabular-nums text-texto-primario leading-none whitespace-nowrap"
                title={formatoMoneda(datos.sugerido_total)}
              >
                {formatoCompacto(datos.sugerido_total, formatoMoneda)}
              </p>
              <p className="text-xxs text-texto-terciario mt-2">
                {datos.es_mes_pasado ? 'total del mes' : datos.es_mes_futuro ? 'estimado total' : 'al cierre del mes'}
              </p>
            </div>

            {/* Adelantos activos */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-texto-terciario font-medium mb-1.5">
                Adelantos
              </p>
              {datos.adelantos_activos_personas > 0 ? (
                <>
                  <p
                    className="text-2xl sm:text-3xl font-light tabular-nums text-texto-marca leading-none whitespace-nowrap"
                    title={formatoMoneda(datos.adelantos_pendiente_total)}
                  >
                    {formatoCompacto(datos.adelantos_pendiente_total, formatoMoneda)}
                  </p>
                  <p className="text-xxs text-texto-terciario mt-2 tabular-nums">
                    <span className="font-medium text-texto-secundario">{datos.adelantos_activos_personas}</span>
                    {' '}{datos.adelantos_activos_personas === 1 ? 'persona' : 'personas'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl sm:text-3xl font-light text-texto-terciario leading-none">—</p>
                  <p className="text-xxs text-texto-terciario mt-2">Sin adelantos activos</p>
                </>
              )}
            </div>
          </div>

          {/* Lista por miembro */}
          {datos.miembros.length > 0 ? (
            <div className="border-t border-borde-sutil/60 px-4 sm:px-5 py-4">
              <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-2.5">
                Detalle por persona
              </p>
              <div className="space-y-1.5">
                {datos.miembros.map((m) => {
                  const colorEst = COLORES_ESTADO[m.estado]
                  const expandido = expandidos.has(m.miembro_id)
                  const tieneDetalle = m.pagos.length > 0
                    || (m.adelantos && m.adelantos.adelantos.length > 0)
                    || m.tiene_proyeccion
                    || m.adelanto_descontado_mes > 0

                  return (
                    <div
                      key={m.miembro_id}
                      className="rounded-lg border border-borde-sutil bg-superficie-app/40 hover:bg-superficie-app/70 transition-colors"
                    >
                      {/* Fila principal */}
                      <button
                        type="button"
                        onClick={() => tieneDetalle && toggle(m.miembro_id)}
                        className="w-full px-3 py-2.5 text-left flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center gap-2 sm:gap-4"
                        disabled={!tieneDetalle}
                      >
                        {/* Miembro: nombre + frecuencia/puesto */}
                        <div className="min-w-0 flex items-start gap-2">
                          {tieneDetalle && (
                            <span className="hidden sm:inline-flex shrink-0 mt-0.5 text-texto-terciario">
                              {expandido ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-texto-primario truncate">{m.nombre}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xxs text-texto-terciario flex-wrap">
                              {m.compensacion_frecuencia && (
                                <span>{ETIQUETA_FRECUENCIA[m.compensacion_frecuencia] || m.compensacion_frecuencia}</span>
                              )}
                              {m.compensacion_tipo && (
                                <>
                                  <span className="opacity-50">·</span>
                                  <span>{ETIQUETA_TIPO[m.compensacion_tipo] || m.compensacion_tipo}</span>
                                </>
                              )}
                              {m.cant_pagos > 0 && (
                                <>
                                  <span className="opacity-50">·</span>
                                  <span>{m.cant_pagos} {m.cant_pagos === 1 ? 'pago' : 'pagos'}</span>
                                </>
                              )}
                              {m.puesto && (
                                <>
                                  <span className="opacity-50">·</span>
                                  <span>{m.puesto}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Adelanto descontado del mes (si hay) */}
                        {m.adelanto_descontado_mes > 0 ? (
                          <div className="hidden sm:flex items-center gap-1 text-xxs text-texto-marca">
                            <TrendingDown className="size-3" />
                            <span className="font-medium tabular-nums" title={formatoMoneda(m.adelanto_descontado_mes)}>
                              −{formatoCompacto(m.adelanto_descontado_mes, formatoMoneda)}
                            </span>
                          </div>
                        ) : (
                          <div className="hidden sm:block" />
                        )}

                        {/* Montos: lo importante = pendiente o a favor */}
                        <div className="flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0 text-xs sm:text-right tabular-nums">
                          {m.sugerido === 0 && m.abonado === 0 ? (
                            m.adelantos && m.adelantos.cant_adelantos > 0 ? (
                              <span className="text-xxs text-texto-terciario whitespace-nowrap">Sin pago este mes</span>
                            ) : (
                              <span className="text-texto-terciario">—</span>
                            )
                          ) : m.estado === 'a_favor' ? (
                            <>
                              <span className="text-texto-marca font-semibold whitespace-nowrap" title={formatoMoneda(m.a_favor)}>
                                +{formatoCompacto(m.a_favor, formatoMoneda)}
                              </span>
                              <span className="text-xxs text-texto-terciario whitespace-nowrap">
                                {formatoCompacto(m.abonado, formatoMoneda)} pagado
                              </span>
                            </>
                          ) : m.estado === 'pendiente' ? (
                            <>
                              <span className="text-insignia-peligro-texto font-semibold whitespace-nowrap" title={formatoMoneda(m.pendiente)}>
                                {formatoCompacto(m.pendiente, formatoMoneda)}
                              </span>
                              <span className="text-xxs text-texto-terciario whitespace-nowrap">
                                {m.tiene_proyeccion && m.cant_pagos === 0 ? 'estimado del mes' : 'a pagar'}
                              </span>
                            </>
                          ) : m.estado === 'parcial' ? (
                            <>
                              <span className="text-insignia-advertencia-texto font-semibold whitespace-nowrap" title={formatoMoneda(m.pendiente)}>
                                Falta {formatoCompacto(m.pendiente, formatoMoneda)}
                              </span>
                              <span className="text-xxs text-texto-terciario whitespace-nowrap">
                                {formatoCompacto(m.abonado, formatoMoneda)} de {formatoCompacto(m.sugerido, formatoMoneda)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-insignia-exito-texto font-semibold whitespace-nowrap" title={formatoMoneda(m.abonado)}>
                                {formatoCompacto(m.abonado, formatoMoneda)}
                              </span>
                              <span className="text-xxs text-texto-terciario whitespace-nowrap">
                                pagado
                              </span>
                            </>
                          )}
                          {/* Indicador de períodos faltantes por cargar */}
                          {m.tiene_proyeccion && m.cant_pagos > 0 && m.periodos_faltantes > 0 && (
                            <span className="text-[10px] text-texto-marca/80 whitespace-nowrap">
                              + {m.periodos_faltantes} {m.periodos_faltantes === 1 ? 'período' : 'períodos'} por cargar
                            </span>
                          )}
                        </div>

                        {/* Estado */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xxs font-medium whitespace-nowrap ${colorEst.bg} ${colorEst.borde} ${colorEst.texto}`}>
                          {colorEst.etiqueta}
                        </span>
                      </button>

                      {/* Detalle expandido */}
                      {expandido && (
                        <div className="border-t border-borde-sutil/40 px-3 py-2.5 space-y-3 bg-superficie-app/20">
                          {/* Aviso de proyección: avisa qué falta cargar este mes */}
                          {m.tiene_proyeccion && m.periodos_faltantes > 0 && (
                            <div className="rounded-md border border-dashed border-texto-marca/30 bg-texto-marca/[0.04] px-3 py-2">
                              <p className="text-xs font-medium text-texto-marca">
                                {m.cant_pagos === 0
                                  ? `Sin pagos cargados todavía este mes`
                                  : `Falta cargar ${m.periodos_faltantes} ${m.periodos_faltantes === 1 ? 'período' : 'períodos'} de pago`}
                              </p>
                              <p className="text-xxs text-texto-terciario mt-0.5">
                                Estimado del mes: <span className="text-texto-secundario font-medium tabular-nums">{formatoMoneda(m.sugerido)}</span>
                                {m.cant_pagos > 0 && (
                                  <>
                                    {' · '}
                                    cargado: <span className="text-texto-secundario font-medium tabular-nums">{formatoMoneda(m.sugerido_cargado)}</span>
                                  </>
                                )}
                                {m.compensacion_frecuencia && (
                                  <>
                                    {' · '}
                                    {ETIQUETA_FRECUENCIA[m.compensacion_frecuencia] || m.compensacion_frecuencia}
                                  </>
                                )}
                              </p>
                            </div>
                          )}
                          {/* Pagos del mes */}
                          {m.pagos.length > 0 && (
                            <div>
                              <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1.5">
                                Pagos del mes
                              </p>
                              <div className="space-y-1.5">
                                {m.pagos.map((p) => {
                                  const colorPago = COLORES_ESTADO[p.estado]
                                  return (
                                    <div
                                      key={p.pago_id}
                                      className={`rounded-md border ${colorPago.borde} ${colorPago.bg}/30 px-3 py-2 flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center gap-2 sm:gap-3`}
                                    >
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-texto-primario truncate">
                                          {p.concepto || `Período ${fmtFechaCorta(p.fecha_inicio_periodo)} – ${fmtFechaCorta(p.fecha_fin_periodo)}`}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-xxs text-texto-terciario flex-wrap">
                                          <span>{fmtFechaCorta(p.fecha_inicio_periodo)} – {fmtFechaCorta(p.fecha_fin_periodo)}</span>
                                          {p.dias_trabajados != null && p.dias_habiles != null && (
                                            <>
                                              <span className="opacity-50">·</span>
                                              <span>{p.dias_trabajados}/{p.dias_habiles} días</span>
                                            </>
                                          )}
                                          {p.tardanzas != null && p.tardanzas > 0 && (
                                            <>
                                              <span className="opacity-50">·</span>
                                              <span className="text-insignia-advertencia-texto">{p.tardanzas} tardanzas</span>
                                            </>
                                          )}
                                          {p.dias_ausentes != null && p.dias_ausentes > 0 && (
                                            <>
                                              <span className="opacity-50">·</span>
                                              <span className="text-insignia-peligro-texto">{p.dias_ausentes} faltas</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-xs text-right tabular-nums whitespace-nowrap">
                                        <p className="text-texto-primario font-medium">{formatoMoneda(p.sugerido)}</p>
                                        <p className="text-xxs text-texto-terciario">sugerido</p>
                                      </div>
                                      <div className="text-xs text-right tabular-nums whitespace-nowrap">
                                        <p className="text-insignia-exito-texto font-medium">{formatoMoneda(p.abonado)}</p>
                                        <p className="text-xxs text-texto-terciario">pagado</p>
                                      </div>
                                      {/* Diferencia: pendiente, a favor o pagado al día */}
                                      <div className="text-xs text-right tabular-nums whitespace-nowrap">
                                        {p.estado === 'a_favor' ? (
                                          <>
                                            <p className="text-texto-marca font-medium">+{formatoMoneda(p.a_favor)}</p>
                                            <p className="text-xxs text-texto-terciario">a favor</p>
                                          </>
                                        ) : p.estado === 'pendiente' ? (
                                          <>
                                            <p className="text-insignia-peligro-texto font-medium">{formatoMoneda(p.pendiente)}</p>
                                            <p className="text-xxs text-texto-terciario">pendiente</p>
                                          </>
                                        ) : p.estado === 'parcial' ? (
                                          <>
                                            <p className="text-insignia-advertencia-texto font-medium">{formatoMoneda(p.pendiente)}</p>
                                            <p className="text-xxs text-texto-terciario">falta</p>
                                          </>
                                        ) : (
                                          <>
                                            <p className="text-insignia-exito-texto font-medium inline-flex items-center gap-1">
                                              <Check className="size-3" strokeWidth={3} />
                                              <span>OK</span>
                                            </p>
                                            <p className="text-xxs text-texto-terciario">al día</p>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Adelantos: siempre se muestra para confirmar si pidió o no en el período */}
                          <div>
                            <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1.5">
                              Adelantos
                              {m.adelanto_descontado_mes > 0 && (
                                <span className="text-texto-marca normal-case tracking-normal font-medium">
                                  {' · '}
                                  descontado este mes: {formatoMoneda(m.adelanto_descontado_mes)}
                                  {m.cuotas_descontadas_mes > 0 && (
                                    <> ({m.cuotas_descontadas_mes} {m.cuotas_descontadas_mes === 1 ? 'cuota' : 'cuotas'})</>
                                  )}
                                </span>
                              )}
                            </p>
                            {m.adelantos && m.adelantos.adelantos.length > 0 ? (
                              <div className="space-y-1.5">
                                {m.adelantos.adelantos.map((a) => {
                                  const pedidoEsteMes = a.fecha_solicitud?.slice(0, 7) === mesSel
                                  return (
                                    <div
                                      key={a.id}
                                      className="rounded-md border border-texto-marca/25 bg-texto-marca/[0.04] px-3 py-2 flex items-start justify-between gap-3"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="text-xs font-medium text-texto-primario truncate">
                                            {a.descripcion || 'Adelanto'}
                                          </p>
                                          {pedidoEsteMes && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-texto-marca/15 text-texto-marca text-[10px] font-semibold uppercase tracking-wide">
                                              Pedido este mes
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xxs text-texto-terciario mt-0.5">
                                          {a.cuotas_totales != null && (
                                            <>
                                              {a.cuotas_descontadas || 0}/{a.cuotas_totales} cuotas
                                            </>
                                          )}
                                          {a.frecuencia_descuento && (
                                            <>
                                              {' · '}
                                              {ETIQUETA_FRECUENCIA[a.frecuencia_descuento] || a.frecuencia_descuento}
                                            </>
                                          )}
                                        </p>
                                      </div>
                                      <div className="text-right tabular-nums shrink-0">
                                        <p className="text-xs text-texto-marca font-semibold whitespace-nowrap">
                                          {formatoMoneda(a.monto_pendiente)}
                                        </p>
                                        <p className="text-xxs text-texto-terciario whitespace-nowrap">
                                          de {formatoMoneda(a.monto_total)}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-xxs text-texto-terciario italic px-1">
                                Sin adelantos activos
                                {m.adelanto_descontado_mes === 0 ? ' ni descuentos en este período' : ''}.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="px-4 sm:px-5 py-12 text-center text-xs text-texto-terciario space-y-3">
              <p>No hay pagos de nómina cargados en {nombreMes} {anioSel}.</p>
              {datos._debug && datos._debug.total_pagos_empresa > 0 && (
                <div className="text-xxs text-texto-terciario/80 max-w-md mx-auto">
                  <p className="mb-1">
                    Tu empresa tiene{' '}
                    <span className="font-semibold text-texto-secundario">
                      {datos._debug.total_pagos_empresa}
                    </span>{' '}
                    {datos._debug.total_pagos_empresa === 1 ? 'pago cargado' : 'pagos cargados'} en total
                    {datos._debug.meses_con_pagos.length > 0 && '. Meses con pagos:'}
                  </p>
                  {datos._debug.meses_con_pagos.length > 0 && (
                    <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
                      {datos._debug.meses_con_pagos.slice(0, 6).map((m) => {
                        const [a, mm] = m.split('-').map(Number)
                        const nombre = MESES_LARGOS[mm - 1]?.slice(0, 3)
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMesSel(m)}
                            className="px-2 py-1 rounded-full border border-borde-sutil text-xxs hover:border-texto-marca hover:text-texto-marca transition-colors"
                          >
                            {nombre} {a}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {datos._debug && datos._debug.total_pagos_empresa === 0 && (
                <div className="text-xxs text-texto-terciario/70 max-w-md mx-auto space-y-2">
                  <p>
                    Tu empresa todavía no tiene pagos de nómina cargados. Cargá uno desde{' '}
                    <button
                      type="button"
                      onClick={() => router.push('/asistencias/nomina')}
                      className="text-texto-marca hover:underline"
                    >
                      Asistencias → Nómina
                    </button>.
                  </p>
                  {datos._debug.muestra_global && datos._debug.muestra_global.length > 0 && (
                    <div className="text-left mt-3 p-3 rounded border border-insignia-advertencia/30 bg-insignia-advertencia/[0.04]">
                      <p className="text-insignia-advertencia-texto font-medium mb-1">
                        ⚠ Diagnóstico: hay {datos._debug.muestra_global.length}+ pagos en la base pero ninguno coincide con tu empresa actual.
                      </p>
                      <p className="text-texto-terciario mb-2">
                        Tu empresa actual: <code className="text-texto-secundario">{datos._debug.empresa_id_actual}</code>
                      </p>
                      <p className="text-texto-terciario mb-1">Empresas con pagos cargados:</p>
                      <ul className="space-y-0.5">
                        {Array.from(new Set(datos._debug.muestra_global.map((p) => p.empresa_id))).map((eid) => (
                          <li key={eid}>
                            <code className="text-texto-secundario">{eid}</code>
                            {eid === datos._debug?.empresa_id_actual && (
                              <span className="text-insignia-exito-texto ml-2">← coincide</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
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
        onClick={() => router.push('/asistencias/nomina')}
        className="w-full px-4 sm:px-5 py-2.5 border-t border-borde-sutil/60 text-xxs text-texto-terciario hover:text-texto-marca transition-colors inline-flex items-center justify-center gap-1"
      >
        Ver nómina detallada <ArrowRight className="size-3" />
      </button>
    </div>
  )
}

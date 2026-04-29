'use client'

/**
 * Métricas operativas del miembro: visitas, presupuestos, órdenes, actividades,
 * recorridos, pagos cobrados, mensajes WhatsApp, contactos.
 *
 * Muestra:
 *   - Tarjetas del mes actual con comparativa al mes anterior (clickeables → drill-down al listado)
 *   - Selector de año para ver histórico (default: últimos 12 meses)
 *   - Gráfico mensual con selector de métrica
 *   - Tarjeta lateral con histórico total acumulado
 *
 * Datos: GET /api/miembros/[id]/metricas?anio=YYYY
 */

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  MapPin, FileText, Wrench, ListChecks, Route, MessageCircle,
  Wallet, Users,
  TrendingUp, TrendingDown, Minus, Loader2, ChevronRight, Calendar,
} from 'lucide-react'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Select } from '@/componentes/ui/Select'
import { useFormato } from '@/hooks/useFormato'

type SerieMes = {
  mes: string
  total?: number
  completadas?: number
  aceptados?: number
  monto?: number
  monto_aceptado?: number
  completados?: number
  visitas_completadas?: number
  kms?: number
  horas?: number
}

interface Metricas {
  sin_cuenta: boolean
  meses_serie?: string[]
  anio_filtrado?: number | null
  visitas?: {
    acumulado: { total: number; completadas: number }
    mes_actual: { total: number; completadas: number }
    mes_anterior: { total: number; completadas: number }
    serie_mensual: SerieMes[]
  }
  presupuestos?: {
    acumulado: { total: number; aceptados: number; monto: number }
    mes_actual: { total: number; aceptados: number; monto: number; monto_aceptado: number }
    mes_anterior: { total: number; aceptados: number; monto: number; monto_aceptado: number }
    serie_mensual: SerieMes[]
  }
  ordenes?: {
    acumulado: { total: number; completadas: number }
    mes_actual: { total: number; completadas: number; horas: number }
    mes_anterior: { total: number; completadas: number; horas: number }
    serie_mensual: SerieMes[]
  }
  actividades?: {
    acumulado: { total: number; completadas: number }
    mes_actual: { total: number; completadas: number }
    mes_anterior: { total: number; completadas: number }
    serie_mensual: SerieMes[]
  }
  recorridos?: {
    acumulado: { total: number; completados: number }
    mes_actual: { total: number; completados: number; visitas_completadas: number; kms: number; minutos: number }
    mes_anterior: { total: number; completados: number; visitas_completadas: number; kms: number; minutos: number }
    serie_mensual: SerieMes[]
  }
  pagos?: {
    acumulado: { total: number; monto: number }
    mes_actual: { total: number; monto: number }
    mes_anterior: { total: number; monto: number }
    serie_mensual: SerieMes[]
  }
  whatsapp?: {
    acumulado: { total: number }
    mes_actual: { total: number }
    mes_anterior: { total: number }
    serie_mensual: SerieMes[]
  }
  contactos?: {
    acumulado: { total: number }
  }
}

type ClaveMetrica = 'visitas' | 'presupuestos' | 'ordenes' | 'actividades' | 'recorridos' | 'pagos' | 'whatsapp'

export function SeccionMetricasOperativas({ miembroId, usuarioId }: { miembroId: string; usuarioId?: string | null }) {
  const fmt = useFormato()
  const router = useRouter()
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metricaActiva, setMetricaActiva] = useState<ClaveMetrica>('visitas')
  const [anioSeleccionado, setAnioSeleccionado] = useState<number | null>(null) // null = últimos 12 meses

  useEffect(() => {
    setCargando(true)
    setError(null)
    const url = anioSeleccionado
      ? `/api/miembros/${miembroId}/metricas?anio=${anioSeleccionado}`
      : `/api/miembros/${miembroId}/metricas?meses=12`
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setMetricas)
      .catch(e => setError(typeof e === 'string' ? e : 'Error al cargar métricas'))
      .finally(() => setCargando(false))
  }, [miembroId, anioSeleccionado])

  // Generar lista de años disponibles (año actual + 4 anteriores)
  const anioActual = new Date().getFullYear()
  const aniosDisponibles = Array.from({ length: 5 }, (_, i) => anioActual - i)

  // Drill-down: navega al listado con filtro por usuario
  const irAListado = (clave: ClaveMetrica) => {
    if (!usuarioId) return
    const rutas: Record<ClaveMetrica, string> = {
      visitas: `/visitas?asignado_a=${usuarioId}`,
      presupuestos: `/presupuestos?creado_por=${usuarioId}`,
      ordenes: `/ordenes?asignado_a=${usuarioId}`,
      actividades: `/actividades?creado_por=${usuarioId}`,
      recorridos: `/recorrido?asignado_a=${usuarioId}`,
      pagos: `/presupuestos?creado_por=${usuarioId}`,
      whatsapp: `/whatsapp`,
    }
    router.push(rutas[clave])
  }

  if (cargando) {
    return (
      <Tarjeta titulo="Actividad operativa">
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-texto-terciario" />
        </div>
      </Tarjeta>
    )
  }

  if (error || !metricas) {
    return (
      <Tarjeta titulo="Actividad operativa">
        <p className="text-sm text-texto-terciario py-2">No se pudieron cargar las métricas.</p>
      </Tarjeta>
    )
  }

  if (metricas.sin_cuenta) {
    return (
      <Tarjeta titulo="Actividad operativa" subtitulo="Este miembro no tiene cuenta Flux activa.">
        <div className="text-xs text-texto-terciario py-1">Las métricas aparecen cuando el usuario empieza a usar el sistema.</div>
      </Tarjeta>
    )
  }

  const variacion = (actual: number, anterior: number) => {
    if (anterior === 0) return actual === 0 ? 0 : 100
    return Math.round(((actual - anterior) / anterior) * 100)
  }

  const v = metricas.visitas
  const p = metricas.presupuestos
  const o = metricas.ordenes
  const a = metricas.actividades
  const r = metricas.recorridos
  const pg = metricas.pagos
  const wa = metricas.whatsapp
  const c = metricas.contactos

  return (
    <div className="space-y-5">
      {/* Tarjetas mes actual con comparativa */}
      <Tarjeta
        titulo="Actividad operativa"
        subtitulo="Este mes vs. mes anterior. Click en una tarjeta para cambiar el gráfico."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TarjetaMetrica
            etiqueta="Visitas"
            valor={v?.mes_actual.total ?? 0}
            subvalor={`${v?.mes_actual.completadas ?? 0} completadas`}
            cambio={variacion(v?.mes_actual.total ?? 0, v?.mes_anterior.total ?? 0)}
            icono={<MapPin size={14} />}
            activo={metricaActiva === 'visitas'}
            onClick={() => setMetricaActiva('visitas')}
            onAbrirListado={usuarioId ? () => irAListado('visitas') : undefined}
          />
          <TarjetaMetrica
            etiqueta="Presupuestos"
            valor={p?.mes_actual.total ?? 0}
            subvalor={p?.mes_actual.monto ? fmt.moneda(p.mes_actual.monto) : 'sin emitir'}
            cambio={variacion(p?.mes_actual.total ?? 0, p?.mes_anterior.total ?? 0)}
            icono={<FileText size={14} />}
            activo={metricaActiva === 'presupuestos'}
            onClick={() => setMetricaActiva('presupuestos')}
            onAbrirListado={usuarioId ? () => irAListado('presupuestos') : undefined}
          />
          <TarjetaMetrica
            etiqueta="Órdenes"
            valor={o?.mes_actual.total ?? 0}
            subvalor={`${o?.mes_actual.horas ?? 0} hs trabajadas`}
            cambio={variacion(o?.mes_actual.total ?? 0, o?.mes_anterior.total ?? 0)}
            icono={<Wrench size={14} />}
            activo={metricaActiva === 'ordenes'}
            onClick={() => setMetricaActiva('ordenes')}
            onAbrirListado={usuarioId ? () => irAListado('ordenes') : undefined}
          />
          <TarjetaMetrica
            etiqueta="Actividades"
            valor={a?.mes_actual.total ?? 0}
            subvalor={`${a?.mes_actual.completadas ?? 0} completadas`}
            cambio={variacion(a?.mes_actual.total ?? 0, a?.mes_anterior.total ?? 0)}
            icono={<ListChecks size={14} />}
            activo={metricaActiva === 'actividades'}
            onClick={() => setMetricaActiva('actividades')}
            onAbrirListado={usuarioId ? () => irAListado('actividades') : undefined}
          />
          <TarjetaMetrica
            etiqueta="Recorridos"
            valor={r?.mes_actual.total ?? 0}
            subvalor={`${r?.mes_actual.kms ?? 0} km`}
            cambio={variacion(r?.mes_actual.total ?? 0, r?.mes_anterior.total ?? 0)}
            icono={<Route size={14} />}
            activo={metricaActiva === 'recorridos'}
            onClick={() => setMetricaActiva('recorridos')}
            onAbrirListado={usuarioId ? () => irAListado('recorridos') : undefined}
          />
          <TarjetaMetrica
            etiqueta="Cobrado"
            valor={pg?.mes_actual.total ?? 0}
            subvalor={pg?.mes_actual.monto ? fmt.moneda(pg.mes_actual.monto) : 'sin pagos'}
            cambio={variacion(pg?.mes_actual.monto ?? 0, pg?.mes_anterior.monto ?? 0)}
            icono={<Wallet size={14} />}
            activo={metricaActiva === 'pagos'}
            onClick={() => setMetricaActiva('pagos')}
            onAbrirListado={usuarioId ? () => irAListado('pagos') : undefined}
          />
          <TarjetaMetrica
            etiqueta="WhatsApp"
            valor={wa?.mes_actual.total ?? 0}
            subvalor="mensajes enviados"
            cambio={variacion(wa?.mes_actual.total ?? 0, wa?.mes_anterior.total ?? 0)}
            icono={<MessageCircle size={14} />}
            activo={metricaActiva === 'whatsapp'}
            onClick={() => setMetricaActiva('whatsapp')}
            onAbrirListado={usuarioId ? () => irAListado('whatsapp') : undefined}
          />
          <TarjetaMetricaSimple
            etiqueta="Contactos"
            valor={c?.acumulado.total ?? 0}
            subvalor="vinculados al miembro"
            icono={<Users size={14} />}
          />
        </div>
      </Tarjeta>

      {/* Gráfico mensual + acumulado */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        <Tarjeta
          titulo={etiquetaMetrica(metricaActiva)}
          subtitulo={anioSeleccionado ? `Año ${anioSeleccionado}` : 'Últimos 12 meses'}
          acciones={
            <div className="w-56 shrink-0">
              <Select
                valor={anioSeleccionado ? String(anioSeleccionado) : 'recientes'}
                onChange={(v) => setAnioSeleccionado(v === 'recientes' ? null : parseInt(v, 10))}
                opciones={[
                  { valor: 'recientes', etiqueta: 'Últimos 12 meses', icono: <Calendar size={13} /> },
                  ...aniosDisponibles.map(a => ({ valor: String(a), etiqueta: String(a), icono: <Calendar size={13} /> })),
                ]}
              />
            </div>
          }
        >
          <GraficoMensual metricas={metricas} clave={metricaActiva} fmt={fmt} />
        </Tarjeta>

        <div className="space-y-3 lg:w-72">
          <Tarjeta titulo="Histórico total" compacta>
            <div className="space-y-2.5">
              <FilaTotal icono={<MapPin size={13} />} etiqueta="Visitas" valor={v?.acumulado.total ?? 0} sub={`${v?.acumulado.completadas ?? 0} completadas`} />
              <FilaTotal
                icono={<FileText size={13} />}
                etiqueta="Presupuestos"
                valor={p?.acumulado.total ?? 0}
                sub={p?.acumulado.monto ? fmt.moneda(p.acumulado.monto) : `${p?.acumulado.aceptados ?? 0} aceptados`}
              />
              <FilaTotal
                icono={<Wrench size={13} />}
                etiqueta="Órdenes"
                valor={o?.acumulado.total ?? 0}
                sub={`${o?.acumulado.completadas ?? 0} completadas`}
              />
              <FilaTotal icono={<ListChecks size={13} />} etiqueta="Actividades" valor={a?.acumulado.total ?? 0} sub={`${a?.acumulado.completadas ?? 0} completadas`} />
              <FilaTotal icono={<Route size={13} />} etiqueta="Recorridos" valor={r?.acumulado.total ?? 0} sub={`${r?.acumulado.completados ?? 0} completados`} />
              <FilaTotal
                icono={<Wallet size={13} />}
                etiqueta="Pagos cobrados"
                valor={pg?.acumulado.total ?? 0}
                sub={pg?.acumulado.monto ? fmt.moneda(pg.acumulado.monto) : 'sin cobros'}
              />
              <FilaTotal icono={<MessageCircle size={13} />} etiqueta="WhatsApp" valor={wa?.acumulado.total ?? 0} sub="mensajes enviados" />
              <FilaTotal icono={<Users size={13} />} etiqueta="Contactos" valor={c?.acumulado.total ?? 0} sub="vinculados" />
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-componentes ─── */

function TarjetaMetrica({ etiqueta, valor, subvalor, cambio, icono, activo, onClick, onAbrirListado }: {
  etiqueta: string
  valor: number
  subvalor: string
  cambio: number
  icono: React.ReactNode
  activo: boolean
  onClick: () => void
  onAbrirListado?: () => void
}) {
  const colorCambio = cambio > 0 ? 'text-insignia-exito' : cambio < 0 ? 'text-insignia-peligro' : 'text-texto-terciario'
  const IconoCambio = cambio > 0 ? TrendingUp : cambio < 0 ? TrendingDown : Minus

  return (
    <div
      className={`relative group rounded-card border transition-all ${
        activo
          ? 'bg-superficie-elevada border-texto-marca/40 ring-1 ring-texto-marca/20'
          : 'bg-superficie-tarjeta border-borde-sutil hover:border-borde-fuerte'
      }`}
    >
      <button onClick={onClick} className="text-left p-4 w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide">{etiqueta}</span>
          <div className="size-7 rounded-card bg-superficie-app flex items-center justify-center text-texto-secundario">
            {icono}
          </div>
        </div>
        <p className="text-2xl font-bold text-texto-primario tabular-nums">{valor}</p>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-xs text-texto-terciario truncate">{subvalor}</span>
          <span className={`text-xs flex items-center gap-0.5 font-medium ${colorCambio}`}>
            <IconoCambio size={11} />
            {cambio > 0 ? '+' : ''}{cambio}%
          </span>
        </div>
      </button>
      {onAbrirListado && (
        <button
          onClick={onAbrirListado}
          title="Ver listado"
          className="absolute bottom-1.5 right-1.5 size-6 rounded-full flex items-center justify-center text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}

// Variante sin comparativa ni gráfico (para métricas tipo contadores totales)
function TarjetaMetricaSimple({ etiqueta, valor, subvalor, icono }: {
  etiqueta: string
  valor: number
  subvalor: string
  icono: React.ReactNode
}) {
  return (
    <div className="rounded-card p-4 bg-superficie-tarjeta border border-borde-sutil">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide">{etiqueta}</span>
        <div className="size-7 rounded-card bg-superficie-app flex items-center justify-center text-texto-secundario">
          {icono}
        </div>
      </div>
      <p className="text-2xl font-bold text-texto-primario tabular-nums">{valor}</p>
      <p className="text-xs text-texto-terciario truncate mt-1">{subvalor}</p>
    </div>
  )
}

function FilaTotal({ icono, etiqueta, valor, sub }: { icono: React.ReactNode; etiqueta: string; valor: number; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="size-7 rounded-card bg-superficie-app flex items-center justify-center text-texto-terciario shrink-0">
        {icono}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-texto-secundario font-medium">{etiqueta}</p>
        <p className="text-xs text-texto-terciario/70 truncate">{sub}</p>
      </div>
      <p className="text-base font-bold text-texto-primario tabular-nums">{valor.toLocaleString('es-AR')}</p>
    </div>
  )
}

function GraficoMensual({ metricas, clave, fmt }: { metricas: Metricas; clave: ClaveMetrica; fmt: ReturnType<typeof useFormato> }) {
  const [mesHover, setMesHover] = useState<string | null>(null)

  const datos = useMemo(() => {
    const grupo = metricas[clave]
    if (!grupo || !grupo.serie_mensual) return [] as Array<{ mes: string; valor: number; monto: number; etiquetaMes: string; subtitulo: string }>

    return grupo.serie_mensual.map(s => {
      let valor = s.total ?? 0
      let monto = 0
      let subtitulo = ''
      if (clave === 'presupuestos') {
        monto = s.monto ?? 0
        subtitulo = `${s.aceptados ?? 0} aceptados`
      } else if (clave === 'pagos') {
        monto = s.monto ?? 0
        subtitulo = monto > 0 ? fmt.moneda(monto) : ''
      } else if (clave === 'recorridos') {
        subtitulo = `${s.visitas_completadas ?? 0} visitas · ${s.kms ?? 0} km`
      } else if (clave === 'ordenes') {
        subtitulo = `${s.completadas ?? 0} completadas · ${s.horas ?? 0} hs`
      } else if (clave === 'whatsapp') {
        subtitulo = 'mensajes'
      } else {
        subtitulo = `${s.completadas ?? 0} completadas`
      }
      return { mes: s.mes, valor, monto, etiquetaMes: formatearMesCorto(s.mes), subtitulo }
    })
  }, [metricas, clave, fmt])

  const maxValor = Math.max(...datos.map(d => d.valor), 1)
  const datoHover = datos.find(d => d.mes === mesHover)

  if (datos.length === 0) {
    return <p className="text-sm text-texto-terciario py-4">Sin datos.</p>
  }

  return (
    <div className="space-y-3">
      {/* Tooltip flotante */}
      <div className="h-9 flex items-center">
        {datoHover ? (
          <div className="text-sm">
            <span className="font-medium text-texto-primario">{formatearMesLargo(datoHover.mes)}: </span>
            <span className="text-texto-secundario">{datoHover.valor} {clave}</span>
            {datoHover.subtitulo && (
              <span className="text-texto-terciario"> · {datoHover.subtitulo}</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-texto-terciario/60">Pasá el mouse sobre una barra para ver el detalle.</p>
        )}
      </div>

      <div className="flex items-end gap-1.5 h-40">
        {datos.map(d => {
          const altura = d.valor === 0 ? 0 : Math.max((d.valor / maxValor) * 100, 4)
          const esActivo = d.mes === mesHover
          return (
            <div
              key={d.mes}
              className="flex-1 h-full flex items-end cursor-pointer group relative"
              onMouseEnter={() => setMesHover(d.mes)}
              onMouseLeave={() => setMesHover(null)}
            >
              {/* Hit-area transparente cubriendo toda la columna para hover */}
              <div className="absolute inset-0" />
              <div
                className={`w-full rounded-sm transition-all relative ${
                  esActivo ? 'bg-texto-marca' : 'bg-texto-marca/50 group-hover:bg-texto-marca/80'
                }`}
                style={{ height: d.valor === 0 ? '2px' : `${altura}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-1.5">
        {datos.map(d => (
          <div
            key={d.mes}
            className={`flex-1 text-[10px] text-center uppercase tracking-wide truncate ${
              d.mes === mesHover ? 'text-texto-primario font-semibold' : 'text-texto-terciario'
            }`}
          >
            {d.etiquetaMes}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Helpers ─── */

function etiquetaMetrica(clave: ClaveMetrica): string {
  switch (clave) {
    case 'visitas': return 'Visitas asignadas por mes'
    case 'presupuestos': return 'Presupuestos creados por mes'
    case 'ordenes': return 'Órdenes asignadas por mes'
    case 'actividades': return 'Actividades creadas por mes'
    case 'recorridos': return 'Recorridos por mes'
    case 'pagos': return 'Pagos cobrados por mes'
    case 'whatsapp': return 'Mensajes WhatsApp enviados por mes'
  }
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function formatearMesCorto(yyyymm: string): string {
  const [, mm] = yyyymm.split('-')
  const idx = parseInt(mm, 10) - 1
  return MESES_CORTOS[idx] || mm
}

function formatearMesLargo(yyyymm: string): string {
  const [yyyy, mm] = yyyymm.split('-')
  const idx = parseInt(mm, 10) - 1
  return `${MESES_LARGOS[idx] || mm} ${yyyy}`
}

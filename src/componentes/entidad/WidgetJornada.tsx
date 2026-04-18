'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Clock, Play, Square, UtensilsCrossed, Footprints,
  CornerDownLeft, MapPin, Loader2, MonitorCheck,
} from 'lucide-react'
import { PopoverAdaptable as Popover } from '@/componentes/ui/PopoverAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'
import { OPENSTREETMAP_REVERSE } from '@/lib/constantes/api-urls'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Tipos ───────────────────────────────────────────────────

interface TurnoHoy {
  id: string
  estado: string
  hora_entrada: string | null
  hora_salida: string | null
  inicio_almuerzo: string | null
  fin_almuerzo: string | null
  salida_particular: string | null
  vuelta_particular: string | null
  tipo: string
  ubicacion_entrada: Record<string, unknown> | null
}

interface ConfigFichaje {
  fichaje_auto_habilitado: boolean
  descontar_almuerzo: boolean
  duracion_almuerzo_min: number
}

// ─── Helpers ─────────────────────────────────────────────────

function formatearHora(iso: string | null, locale: string = 'es-AR', hour12 = false): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12 })
}

function calcularMinutosTrabajados(turno: TurnoHoy): number {
  if (!turno.hora_entrada) return 0
  const entrada = new Date(turno.hora_entrada).getTime()

  // Si el turno está abierto, siempre calcular hasta ahora (no usar hora_salida del snapshot)
  const estaAbierto = ['activo', 'almuerzo', 'particular'].includes(turno.estado)
  const fin = estaAbierto ? Date.now() : (turno.hora_salida ? new Date(turno.hora_salida).getTime() : Date.now())
  let min = Math.round((fin - entrada) / 60000)

  // Descontar almuerzo
  if (turno.inicio_almuerzo && turno.fin_almuerzo) {
    const almMin = Math.round((new Date(turno.fin_almuerzo).getTime() - new Date(turno.inicio_almuerzo).getTime()) / 60000)
    min -= almMin
  } else if (turno.inicio_almuerzo && !turno.fin_almuerzo && turno.estado === 'almuerzo') {
    const almMin = Math.round((Date.now() - new Date(turno.inicio_almuerzo).getTime()) / 60000)
    min -= almMin
  }

  // Descontar trámite (salida particular)
  if (turno.salida_particular && turno.vuelta_particular) {
    const partMin = Math.round((new Date(turno.vuelta_particular).getTime() - new Date(turno.salida_particular).getTime()) / 60000)
    min -= partMin
  } else if (turno.salida_particular && !turno.vuelta_particular && turno.estado === 'particular') {
    const partMin = Math.round((Date.now() - new Date(turno.salida_particular).getTime()) / 60000)
    min -= partMin
  }

  return Math.max(0, min)
}

function formatearDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: 'En turno',
  almuerzo: 'Almorzando',
  particular: 'En trámite',
  cerrado: 'Jornada cerrada',
  auto_cerrado: 'Cerrada auto',
  ausente: 'Ausente',
}

const COLOR_ESTADO: Record<string, string> = {
  activo: 'bg-insignia-exito',
  almuerzo: 'bg-insignia-advertencia',
  particular: 'bg-insignia-info',
  cerrado: 'bg-texto-terciario',
}

// ─── Barra de timeline del día ──────────────────────────────

interface SegmentoTimeline {
  inicio: number // minutos desde medianoche
  fin: number
  tipo: 'trabajo' | 'almuerzo' | 'particular' | 'inactivo' | 'extra'
}

const COLORES_SEGMENTO: Record<string, string> = {
  trabajo: 'var(--insignia-exito)',
  almuerzo: 'var(--insignia-advertencia)',
  particular: 'var(--insignia-info)',
  inactivo: 'var(--borde-sutil)',
  extra: 'var(--insignia-advertencia)',
}

function minutosDesdeMedianoche(iso: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function construirSegmentos(
  turno: TurnoHoy,
  horarioEsperado: { desde: string; hasta: string } | null = null,
): SegmentoTimeline[] {
  if (!turno.hora_entrada) return []
  const segmentos: SegmentoTimeline[] = []
  const entrada = minutosDesdeMedianoche(turno.hora_entrada)
  // Si el turno está abierto, siempre usar hora actual (no el snapshot de hora_salida)
  const estaAbierto = ['activo', 'almuerzo', 'particular'].includes(turno.estado)
  const minutosAhora = Math.floor((Date.now() - new Date(new Date().toDateString()).getTime()) / 60000)
  const salida = estaAbierto
    ? minutosAhora
    : (turno.hora_salida ? minutosDesdeMedianoche(turno.hora_salida) : minutosAhora)

  // Límite del horario esperado para marcar extra
  const limiteHorario = horarioEsperado ? parseHHMM(horarioEsperado.hasta) : null

  // Construir segmentos cronológicamente
  let cursor = entrada

  // Si hubo almuerzo
  if (turno.inicio_almuerzo) {
    const inicioAlm = minutosDesdeMedianoche(turno.inicio_almuerzo)
    if (inicioAlm > cursor) {
      segmentos.push({ inicio: cursor, fin: inicioAlm, tipo: 'trabajo' })
    }
    const finAlm = turno.fin_almuerzo
      ? minutosDesdeMedianoche(turno.fin_almuerzo)
      : turno.estado === 'almuerzo'
        ? Math.floor((Date.now() - new Date(new Date().toDateString()).getTime()) / 60000)
        : inicioAlm
    segmentos.push({ inicio: inicioAlm, fin: finAlm, tipo: 'almuerzo' })
    cursor = finAlm
  }

  // Si hubo trámite
  if (turno.salida_particular) {
    const inicioPartic = minutosDesdeMedianoche(turno.salida_particular)
    if (inicioPartic > cursor) {
      segmentos.push({ inicio: cursor, fin: inicioPartic, tipo: 'trabajo' })
    }
    const finPartic = turno.vuelta_particular
      ? minutosDesdeMedianoche(turno.vuelta_particular)
      : turno.estado === 'particular'
        ? Math.floor((Date.now() - new Date(new Date().toDateString()).getTime()) / 60000)
        : inicioPartic
    segmentos.push({ inicio: inicioPartic, fin: finPartic, tipo: 'particular' })
    cursor = finPartic
  }

  // Trabajo restante después del último break hasta ahora/salida
  if (cursor < salida && turno.estado !== 'almuerzo' && turno.estado !== 'particular') {
    segmentos.push({ inicio: cursor, fin: salida, tipo: 'trabajo' })
  }

  // Si no hubo breaks, toda la jornada es trabajo
  if (segmentos.length === 0) {
    segmentos.push({ inicio: entrada, fin: salida, tipo: 'trabajo' })
  }

  // Partir segmentos de trabajo en trabajo+extra si se pasa del horario
  if (limiteHorario !== null) {
    const segmentosFinales: SegmentoTimeline[] = []
    for (const seg of segmentos) {
      if (seg.tipo === 'trabajo' && seg.fin > limiteHorario && seg.inicio < limiteHorario) {
        // Partir: trabajo hasta el límite, extra después
        segmentosFinales.push({ inicio: seg.inicio, fin: limiteHorario, tipo: 'trabajo' })
        segmentosFinales.push({ inicio: limiteHorario, fin: seg.fin, tipo: 'extra' })
      } else if (seg.tipo === 'trabajo' && seg.inicio >= limiteHorario) {
        // Todo el segmento es extra
        segmentosFinales.push({ ...seg, tipo: 'extra' })
      } else {
        segmentosFinales.push(seg)
      }
    }
    return segmentosFinales
  }

  return segmentos
}

function BarraTimeline({ turno, horarioEsperado, hour12 }: {
  turno: TurnoHoy
  horarioEsperado: { desde: string; hasta: string } | null
  hour12: boolean
  tick?: number // fuerza re-render periódico
}) {
  const segmentos = construirSegmentos(turno, horarioEsperado)
  if (segmentos.length === 0) return null

  // Rango de la barra: usar horario esperado como base, expandir si hay actividad fuera
  const horarioDesdeMin = horarioEsperado ? parseHHMM(horarioEsperado.desde) : null
  const horarioHastaMin = horarioEsperado ? parseHHMM(horarioEsperado.hasta) : null

  const primerSegMin = segmentos[0].inicio
  const ultimoSegMin = segmentos[segmentos.length - 1].fin

  // El rango visible es el mayor entre horario esperado y actividad real
  const rangoInicio = Math.min(primerSegMin, horarioDesdeMin ?? primerSegMin)
  const rangoFin = Math.max(ultimoSegMin, horarioHastaMin ?? ultimoSegMin)
  const rangoTotal = Math.max(rangoFin - rangoInicio, 1)

  // Generar marcadores de hora completa dentro del rango
  // Incluir extremos redondeados a hora completa si coinciden
  const primeraHora = Math.ceil(rangoInicio / 60) * 60
  const marcadores: number[] = []
  for (let h = primeraHora; h <= rangoFin; h += 60) {
    marcadores.push(h)
  }

  const pctPos = (min: number) => ((min - rangoInicio) / rangoTotal) * 100

  const formatMin = (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    if (hour12) {
      const periodo = h >= 12 ? 'PM' : 'AM'
      const h12v = h === 0 ? 12 : h > 12 ? h - 12 : h
      return `${h12v}:${String(m).padStart(2, '0')} ${periodo}`
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const formatHora = (min: number) => {
    const h = Math.floor(min / 60)
    if (hour12) {
      const periodo = h >= 12 ? 'p' : 'a'
      const h12v = h === 0 ? 12 : h > 12 ? h - 12 : h
      return `${h12v}${periodo}`
    }
    return `${h}`
  }

  return (
    <div className="space-y-0.5">
      {/* Barra + marcadores integrados */}
      <div className="relative">
        {/* La barra */}
        <div className="relative h-4 rounded-full overflow-hidden bg-superficie-hover/60">
          {/* Segmentos de actividad */}
          {segmentos.map((seg, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 transition-all"
              style={{
                left: `${pctPos(seg.inicio)}%`,
                width: `${Math.max(pctPos(seg.fin) - pctPos(seg.inicio), 1)}%`,
                backgroundColor: COLORES_SEGMENTO[seg.tipo],
                opacity: seg.tipo === 'trabajo' || seg.tipo === 'extra' ? 1 : 0.75,
                borderRadius: i === 0 ? '9999px 0 0 9999px' :
                  i === segmentos.length - 1 ? '0 9999px 9999px 0' : '0',
              }}
            />
          ))}

          {/* Divisiones por hora (encima de los segmentos para que siempre se vean) */}
          {marcadores.map((m) => {
            const pos = pctPos(m)
            if (pos <= 1 || pos >= 99) return null
            return (
              <div
                key={m}
                className="absolute top-0 bottom-0 w-px bg-texto-terciario/30"
                style={{ left: `${pos}%` }}
              />
            )
          })}
        </div>

        {/* Etiquetas de hora debajo — pares con número, impares solo tick */}
        <div className="flex justify-between mt-1 px-0.5">
          {marcadores.map((m, i) => (
            <span key={m} className="text-xxs tabular-nums leading-none text-texto-terciario/50 text-center" style={{ width: 0 }}>
              {i % 2 === 0 ? formatHora(m) : '·'}
            </span>
          ))}
        </div>
      </div>

      {/* Leyenda compacta */}
      <div className="flex items-center justify-center gap-3 text-xxs text-texto-terciario pt-0.5">
        {segmentos.some(s => s.tipo === 'trabajo') && (
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: COLORES_SEGMENTO.trabajo }} />
            Trabajo
          </span>
        )}
        {segmentos.some(s => s.tipo === 'almuerzo') && (
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: COLORES_SEGMENTO.almuerzo }} />
            Almuerzo
          </span>
        )}
        {segmentos.some(s => s.tipo === 'particular') && (
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: COLORES_SEGMENTO.particular }} />
            Trámite
          </span>
        )}
        {segmentos.some(s => s.tipo === 'extra') && (
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: COLORES_SEGMENTO.extra }} />
            Extra
          </span>
        )}
      </div>
    </div>
  )
}

/** Parsea "HH:MM" a minutos desde medianoche */
function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// ─── Geolocalización ────────────────────────────────────────

async function obtenerUbicacion(): Promise<Record<string, unknown> | null> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 60000 })
    })

    const { latitude, longitude } = pos.coords
    const ubicacion: Record<string, unknown> = { lat: latitude, lng: longitude }

    // Geocoding inverso con Nominatim (gratis, sin API key)
    try {
      const res = await fetch(
        `${OPENSTREETMAP_REVERSE}?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=17`,
        { headers: { 'Accept-Language': 'es' } }
      )
      if (res.ok) {
        const geo = await res.json()
        const addr = geo.address || {}
        const calle = addr.road || addr.pedestrian || addr.footway || ''
        // Redondear número a centena
        const numero = addr.house_number ? Math.floor(parseInt(addr.house_number) / 100) * 100 : null
        const barrio = addr.suburb || addr.neighbourhood || addr.city_district || ''
        const ciudad = addr.city || addr.town || addr.village || ''

        ubicacion.direccion = numero ? `${calle} ${numero}` : calle
        ubicacion.barrio = barrio
        ubicacion.ciudad = ciudad
      }
    } catch {
      // Geocoding falló, guardamos solo coords
    }

    return ubicacion
  } catch {
    return null
  }
}

// ─── Componente principal ────────────────────────────────────

function WidgetJornada() {
  const { locale, formatoHora: fmtHora } = useFormato()
  const hour12 = fmtHora === '12h'
  const [abierto, setAbierto] = useState(false)
  const [turno, setTurno] = useState<TurnoHoy | null>(null)
  const [metodoFichaje, setMetodoFichaje] = useState<string | null>(null)
  const [, setConfig] = useState<ConfigFichaje | null>(null)
  const [horarioHoy, setHorarioHoy] = useState<{ desde: string; hasta: string } | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ejecutando, setEjecutando] = useState(false)
  const [minutosVivos, setMinutosVivos] = useState(0)
  const [tick, setTick] = useState(0) // fuerza re-render de la barra cada 30s
  const intervaloRef = useRef<ReturnType<typeof setInterval>>(null)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/asistencias/fichar')
      if (!res.ok) return
      const data = await res.json()
      setTurno(data.turno || null)
      setMetodoFichaje(data.metodo_fichaje)
      setConfig(data.config)
      setHorarioHoy(data.horario_hoy || null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Re-cargar datos del turno cada 5 minutos para sincronizar con heartbeats
  useEffect(() => {
    const intervalo = setInterval(() => { cargar() }, 5 * 60 * 1000)
    return () => clearInterval(intervalo)
  }, [cargar])

  // Timer que actualiza duración en vivo
  useEffect(() => {
    if (turno && ['activo', 'almuerzo', 'particular'].includes(turno.estado)) {
      setMinutosVivos(calcularMinutosTrabajados(turno))
      intervaloRef.current = setInterval(() => {
        setMinutosVivos(calcularMinutosTrabajados(turno))
        setTick(t => t + 1) // fuerza re-render de la barra timeline
      }, 30000) // actualizar cada 30s
      return () => { if (intervaloRef.current) clearInterval(intervaloRef.current) }
    } else if (turno) {
      setMinutosVivos(calcularMinutosTrabajados(turno))
    }
  }, [turno])

  const fichar = useCallback(async (accion: string) => {
    setEjecutando(true)

    // Actualización optimista: cambiar el estado del turno inmediatamente
    setTurno(prev => {
      if (!prev) return prev
      const ahora = new Date().toISOString()
      switch (accion) {
        case 'almuerzo':
          return { ...prev, estado: 'almuerzo', inicio_almuerzo: ahora }
        case 'volver_almuerzo':
          return { ...prev, estado: 'activo', fin_almuerzo: ahora }
        case 'particular':
          return { ...prev, estado: 'particular', salida_particular: ahora }
        case 'volver_particular':
          return { ...prev, estado: 'activo', vuelta_particular: ahora }
        case 'salida':
          return { ...prev, estado: 'cerrado', hora_salida: ahora }
        default:
          return prev
      }
    })

    try {
      // Lanzar geolocalización en paralelo con el POST (no bloquea)
      const ubicacionPromesa = obtenerUbicacion()

      const res = await fetch('/api/asistencias/fichar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, metodo: 'manual' }),
      })

      if (res.ok) {
        // Enviar ubicación en segundo plano si se obtuvo
        ubicacionPromesa.then(async (ubicacion) => {
          if (!ubicacion) return
          const data = await res.clone().json().catch(() => null)
          const fichajeId = data?.registro?.id
          if (!fichajeId) return
          // Actualizar ubicación en el registro ya creado
          const campoUbicacion = accion === 'salida' ? 'ubicacion_salida' : 'ubicacion_entrada'
          fetch('/api/asistencias/fichar/ubicacion', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fichaje_id: fichajeId, campo: campoUbicacion, ubicacion }),
          }).catch(() => {})
        }).catch(() => {})

        await cargar()
      } else {
        // Revertir UI optimista si falló
        await cargar()
      }
    } catch {
      // Revertir UI optimista si hubo error
      await cargar()
    } finally {
      setEjecutando(false)
    }
  }, [cargar])

  const esAutomatico = metodoFichaje === 'automatico'
  const estaAbierto = turno && ['activo', 'almuerzo', 'particular'].includes(turno.estado)
  const estaCerrado = turno && ['cerrado', 'auto_cerrado'].includes(turno.estado)

  // Color del indicador en el botón del header
  const colorIndicador = !turno ? '' : estaAbierto ? COLOR_ESTADO[turno.estado] || '' : ''

  // Calcular minutos extra (pasado del horario previsto)
  const minutosEsperados = horarioHoy
    ? parseHHMM(horarioHoy.hasta) - parseHHMM(horarioHoy.desde)
    : null
  const minutosExtra = minutosEsperados !== null && minutosVivos > minutosEsperados
    ? minutosVivos - minutosEsperados
    : 0

  // Duración estilizada grande: "3h 46m"
  const duracionGrande = (() => {
    const h = Math.floor(minutosVivos / 60)
    const m = minutosVivos % 60
    const colorNum = minutosExtra > 0 ? 'text-insignia-advertencia' : 'text-texto-primario'
    const colorLetter = minutosExtra > 0 ? 'text-insignia-advertencia/50' : 'text-texto-terciario/50'
    return (
      <div className="flex items-baseline justify-center gap-0.5">
        {h > 0 && (
          <>
            <span className={`text-4xl font-bold tabular-nums ${colorNum}`}>{h}</span>
            <span className={`text-xl font-medium ${colorLetter}`}>h</span>
          </>
        )}
        <span className={`text-4xl font-bold tabular-nums ${colorNum}`}>{String(m).padStart(h > 0 ? 2 : 1, '0')}</span>
        <span className={`text-xl font-medium ${colorLetter}`}>m</span>
      </div>
    )
  })()

  // Info line compacta
  const lineaInfo = (() => {
    if (!turno?.hora_entrada) return null
    const partes: string[] = []
    partes.push(`Entrada: ${formatearHora(turno.hora_entrada, locale, hour12)}`)
    if (estaAbierto && horarioHoy) {
      partes.push(`Fin previsto: ${horarioHoy.hasta}`)
    } else if (estaCerrado && turno.hora_salida) {
      partes.push(`Salida: ${formatearHora(turno.hora_salida, locale, hour12)}`)
    }
    if (turno.inicio_almuerzo) {
      partes.push(`Almuerzo: ${formatearHora(turno.inicio_almuerzo, locale, hour12)}`)
    }
    return partes.join('  ·  ')
  })()

  return (
    <Popover
      abierto={abierto}
      onCambio={setAbierto}
      alineacion="fin"
      ancho={380}
      offset={10}
      tituloMovil="Jornada"
      contenido={
        <div>
          {cargando ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-texto-terciario" />
            </div>
          ) : (
            <>
              {/* ── Cabecera: tipo de fichaje ── */}
              <div className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-texto-marca border-b border-white/[0.07]">
                <MonitorCheck size={13} />
                {esAutomatico ? 'Fichaje automático' : 'Fichaje manual'}
              </div>

              {/* ── Estado + info ── */}
              <div className="text-center px-4 py-3 border-b border-white/[0.07]">
                {!turno ? (
                  <p className="text-sm text-texto-terciario">
                    {esAutomatico ? 'Esperando actividad...' : 'Sin fichaje hoy'}
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className={`size-2 rounded-full ${COLOR_ESTADO[turno.estado] || 'bg-texto-terciario'}`} />
                      <span className="text-sm font-medium text-texto-primario">
                        {ETIQUETA_ESTADO[turno.estado] || turno.estado}
                      </span>
                    </div>
                    {lineaInfo && (
                      <p className="text-[11px] text-texto-terciario leading-relaxed">{lineaInfo}</p>
                    )}
                    {/* Ubicación */}
                    {(() => {
                      const ub = turno.ubicacion_entrada as Record<string, string> | null
                      if (!ub?.direccion) return null
                      const texto = ub.barrio ? `${ub.direccion}, ${ub.barrio}` : ub.direccion
                      return (
                        <p className="text-[11px] text-texto-terciario mt-0.5 flex items-center justify-center gap-1">
                          <MapPin size={10} />
                          {texto}
                        </p>
                      )
                    })()}
                  </>
                )}
              </div>

              {/* ── Duración grande ── */}
              {turno && (estaAbierto || estaCerrado) && (
                <div className="py-4 border-b border-white/[0.07]">
                  {duracionGrande}
                  {minutosExtra > 0 && (
                    <p className="text-xs font-medium text-insignia-advertencia text-center mt-1">
                      +{formatearDuracion(minutosExtra)} extra
                    </p>
                  )}
                  {estaCerrado && (
                    <p className="text-xs text-texto-terciario text-center mt-1">Jornada finalizada</p>
                  )}
                </div>
              )}

              {/* ── Barra de timeline ── */}
              {turno && turno.hora_entrada && (
                <div className="px-4 py-3 border-b border-white/[0.07]">
                  <BarraTimeline turno={turno} horarioEsperado={horarioHoy} hour12={hour12} tick={tick} />
                </div>
              )}

              {/* ── Acciones ── */}
              <div className="px-4 py-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={turno?.estado || 'sin_turno'}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-2"
                  >
                    {/* Sin turno → marcar entrada */}
                    {!turno && (
                      <>
                        <Boton
                          variante="primario"
                          tamano="sm"
                          className="w-full"
                          onClick={() => fichar('entrada')}
                          disabled={ejecutando}
                          cargando={ejecutando}
                        >
                          <Play size={13} className="mr-1.5" /> Marcar entrada
                        </Boton>
                        {esAutomatico && (
                          <p className="text-xxs text-texto-terciario text-center">
                            También se ficha automáticamente al usar Flux.
                          </p>
                        )}
                      </>
                    )}

                    {/* En turno activo */}
                    {turno?.estado === 'activo' && (
                      <>
                        {!turno.inicio_almuerzo && (
                          <Boton
                            variante="secundario"
                            tamano="sm"
                            className="w-full"
                            onClick={() => fichar('almuerzo')}
                            disabled={ejecutando}
                          >
                            <UtensilsCrossed size={13} className="mr-1.5" /> Almorzar
                          </Boton>
                        )}
                        <Boton
                          variante="secundario"
                          tamano="sm"
                          className="w-full"
                          onClick={() => fichar('particular')}
                          disabled={ejecutando}
                        >
                          <Footprints size={13} className="mr-1.5" /> Trámite
                        </Boton>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          className="w-full !text-insignia-peligro hover:!bg-insignia-peligro/10"
                          onClick={() => fichar('salida')}
                          disabled={ejecutando}
                          cargando={ejecutando}
                        >
                          <Square size={13} className="mr-1.5" /> Terminar jornada
                        </Boton>
                      </>
                    )}

                    {/* En almuerzo */}
                    {turno?.estado === 'almuerzo' && (
                      <>
                        <Boton
                          variante="primario"
                          tamano="sm"
                          className="w-full"
                          onClick={() => fichar('volver_almuerzo')}
                          disabled={ejecutando}
                          cargando={ejecutando}
                        >
                          <CornerDownLeft size={13} className="mr-1.5" /> Volver del almuerzo
                        </Boton>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          className="w-full !text-insignia-peligro hover:!bg-insignia-peligro/10"
                          onClick={() => fichar('salida')}
                          disabled={ejecutando}
                        >
                          <Square size={13} className="mr-1.5" /> Terminar jornada
                        </Boton>
                        {esAutomatico && (
                          <p className="text-xxs text-texto-terciario text-center">
                            El retorno también se registra automáticamente al volver a usar Flux.
                          </p>
                        )}
                      </>
                    )}

                    {/* En trámite */}
                    {turno?.estado === 'particular' && (
                      <>
                        <Boton
                          variante="primario"
                          tamano="sm"
                          className="w-full"
                          onClick={() => fichar('volver_particular')}
                          disabled={ejecutando}
                          cargando={ejecutando}
                        >
                          <CornerDownLeft size={13} className="mr-1.5" /> Ya volví
                        </Boton>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          className="w-full !text-insignia-peligro hover:!bg-insignia-peligro/10"
                          onClick={() => fichar('salida')}
                          disabled={ejecutando}
                        >
                          <Square size={13} className="mr-1.5" /> Terminar jornada
                        </Boton>
                        {esAutomatico && (
                          <p className="text-xxs text-texto-terciario text-center">
                            El retorno también se registra automáticamente al volver a usar Flux.
                          </p>
                        )}
                      </>
                    )}

                    {/* Jornada cerrada */}
                    {estaCerrado && (
                      <p className="text-center text-xs text-texto-terciario py-1">
                        Hasta mañana.
                      </p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      }
    >
      <button
        type="button"
        title="Jornada"
        className={[
          'flex items-center gap-1.5 rounded-card px-2 py-1 transition-colors cursor-pointer border-none',
          'hover:bg-superficie-hover text-texto-terciario hover:text-texto-secundario',
        ].join(' ')}
      >
        {/* Dot de estado (siempre visible) */}
        <span className={[
          'size-2 rounded-full shrink-0 transition-colors',
          minutosExtra > 0 ? 'bg-insignia-advertencia' : (colorIndicador || 'bg-texto-terciario/30'),
        ].join(' ')} />
        {/* Timer en desktop, oculto en móvil */}
        {estaAbierto ? (
          <span className={`hidden sm:inline text-xs font-medium font-mono tabular-nums ${minutosExtra > 0 ? 'text-insignia-advertencia' : 'text-texto-secundario'}`}>
            {formatearDuracion(minutosVivos)}
          </span>
        ) : estaCerrado ? (
          <span className={`hidden sm:inline text-xs font-medium font-mono tabular-nums ${minutosExtra > 0 ? 'text-insignia-advertencia' : 'text-texto-terciario'}`}>
            {formatearDuracion(minutosVivos)} ✓
          </span>
        ) : (
          <span className="hidden sm:inline text-xs text-texto-terciario">
            Jornada
          </span>
        )}
      </button>
    </Popover>
  )
}

export { WidgetJornada }

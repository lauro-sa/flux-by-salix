'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Clock, Play, Square, UtensilsCrossed, Footprints,
  CornerDownLeft, MapPin, Loader2, MonitorCheck,
} from 'lucide-react'
import { PopoverAdaptable as Popover } from '@/componentes/ui/PopoverAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'
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
  const fin = turno.hora_salida ? new Date(turno.hora_salida).getTime() : Date.now()
  let min = Math.round((fin - entrada) / 60000)

  if (turno.inicio_almuerzo && turno.fin_almuerzo) {
    const almMin = Math.round((new Date(turno.fin_almuerzo).getTime() - new Date(turno.inicio_almuerzo).getTime()) / 60000)
    min -= almMin
  } else if (turno.inicio_almuerzo && !turno.fin_almuerzo && turno.estado === 'almuerzo') {
    // Está en almuerzo ahora, descontar hasta ahora
    const almMin = Math.round((Date.now() - new Date(turno.inicio_almuerzo).getTime()) / 60000)
    min -= almMin
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
  tipo: 'trabajo' | 'almuerzo' | 'particular' | 'inactivo'
}

const COLORES_SEGMENTO: Record<string, string> = {
  trabajo: 'var(--insignia-exito)',
  almuerzo: 'var(--insignia-advertencia)',
  particular: 'var(--insignia-info)',
  inactivo: 'var(--borde-sutil)',
}

function minutosDesdeMedianoche(iso: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function construirSegmentos(turno: TurnoHoy): SegmentoTimeline[] {
  if (!turno.hora_entrada) return []
  const segmentos: SegmentoTimeline[] = []
  const entrada = minutosDesdeMedianoche(turno.hora_entrada)
  const salida = turno.hora_salida
    ? minutosDesdeMedianoche(turno.hora_salida)
    : Math.floor((Date.now() - new Date(new Date().toDateString()).getTime()) / 60000)

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

  return segmentos
}

function BarraTimeline({ turno, horarioEsperado, hour12 }: {
  turno: TurnoHoy
  horarioEsperado: { desde: string; hasta: string } | null
  hour12: boolean
}) {
  const segmentos = construirSegmentos(turno)
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
          {/* Divisiones por hora (líneas dentro de la barra) */}
          {marcadores.map((m) => {
            const pos = pctPos(m)
            if (pos <= 1 || pos >= 99) return null
            return (
              <div
                key={m}
                className="absolute top-0 bottom-0 w-px bg-texto-terciario/15"
                style={{ left: `${pos}%` }}
              />
            )
          })}

          {/* Segmentos de actividad */}
          {segmentos.map((seg, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 transition-all"
              style={{
                left: `${pctPos(seg.inicio)}%`,
                width: `${Math.max(pctPos(seg.fin) - pctPos(seg.inicio), 1)}%`,
                backgroundColor: COLORES_SEGMENTO[seg.tipo],
                opacity: seg.tipo === 'trabajo' ? 1 : 0.75,
                borderRadius: i === 0 ? '9999px 0 0 9999px' :
                  i === segmentos.length - 1 ? '0 9999px 9999px 0' : '0',
              }}
            />
          ))}
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
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=17`,
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

  // Timer que actualiza duración en vivo
  useEffect(() => {
    if (turno && ['activo', 'almuerzo', 'particular'].includes(turno.estado)) {
      setMinutosVivos(calcularMinutosTrabajados(turno))
      intervaloRef.current = setInterval(() => {
        setMinutosVivos(calcularMinutosTrabajados(turno))
      }, 30000) // actualizar cada 30s
      return () => { if (intervaloRef.current) clearInterval(intervaloRef.current) }
    } else if (turno) {
      setMinutosVivos(calcularMinutosTrabajados(turno))
    }
  }, [turno])

  const fichar = useCallback(async (accion: string) => {
    setEjecutando(true)
    try {
      const ubicacion = await obtenerUbicacion()
      const res = await fetch('/api/asistencias/fichar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ubicacion, metodo: 'manual' }),
      })
      if (res.ok) {
        await cargar()
      }
    } finally {
      setEjecutando(false)
    }
  }, [cargar])

  const esAutomatico = metodoFichaje === 'automatico'
  const estaAbierto = turno && ['activo', 'almuerzo', 'particular'].includes(turno.estado)
  const estaCerrado = turno && ['cerrado', 'auto_cerrado'].includes(turno.estado)

  // Color del indicador en el botón del header
  const colorIndicador = !turno ? '' : estaAbierto ? COLOR_ESTADO[turno.estado] || '' : ''

  // Contenido del estado (compartido entre modo manual y automático)
  const contenidoEstado = (
    <div className="text-center">
      {!turno && (
        <p className="text-sm text-texto-terciario mb-1">
          {esAutomatico ? 'Esperando actividad...' : 'Sin fichaje hoy'}
        </p>
      )}
      {turno && (
        <>
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className={`size-2 rounded-full ${COLOR_ESTADO[turno.estado] || 'bg-texto-terciario'}`} />
            <span className="text-sm font-medium text-texto-primario">
              {ETIQUETA_ESTADO[turno.estado] || turno.estado}
            </span>
          </div>
          <p className="text-xs text-texto-terciario">
            Entrada: {formatearHora(turno.hora_entrada, locale, hour12)}
            {estaAbierto && horarioHoy
              ? ` — Fin previsto: ${horarioHoy.hasta}`
              : estaCerrado && turno.hora_salida
                ? ` — Salida: ${formatearHora(turno.hora_salida, locale, hour12)}`
                : ''
            }
          </p>
          {turno.inicio_almuerzo && (
            <p className="text-xs text-texto-terciario">
              Almuerzo: {formatearHora(turno.inicio_almuerzo, locale, hour12)}
              {turno.fin_almuerzo && ` — ${formatearHora(turno.fin_almuerzo, locale, hour12)}`}
            </p>
          )}
          {estaAbierto && (
            <p className="text-lg font-semibold text-texto-primario mt-2 font-mono">
              {formatearDuracion(minutosVivos)}
            </p>
          )}
          {estaCerrado && (
            <p className="text-lg font-semibold text-texto-primario mt-2 font-mono">
              {formatearDuracion(minutosVivos)} ✓
            </p>
          )}
          {/* Ubicación */}
          {(() => {
            const ub = turno.ubicacion_entrada as Record<string, string> | null
            if (!ub?.direccion) return null
            const texto = ub.barrio ? `${ub.direccion}, ${ub.barrio}` : ub.direccion
            return (
              <p className="text-xs text-texto-terciario mt-1 flex items-center justify-center gap-1">
                <MapPin size={10} />
                {texto}
              </p>
            )
          })()}
        </>
      )}
    </div>
  )

  return (
    <Popover
      abierto={abierto}
      onCambio={setAbierto}
      alineacion="fin"
      ancho={380}
      offset={10}
      tituloMovil="Jornada"
      contenido={
        <div className="p-4 space-y-4">
          {cargando ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-texto-terciario" />
            </div>
          ) : esAutomatico ? (
            <>
              {/* Badge de fichaje automático */}
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-texto-marca">
                <MonitorCheck size={13} />
                Fichaje automático
              </div>

              {contenidoEstado}

              {/* Barra de timeline visual */}
              {turno && turno.hora_entrada && (
                <BarraTimeline turno={turno} horarioEsperado={horarioHoy} hour12={hour12} />
              )}

              {/* Acciones para fichaje automático (almuerzo/trámite) */}
              {turno?.estado === 'activo' && (
                <div className="space-y-2">
                  {!turno.inicio_almuerzo && (
                    <Boton
                      variante="secundario"
                      className="w-full"
                      onClick={() => fichar('almuerzo')}
                      disabled={ejecutando}
                    >
                      <UtensilsCrossed size={14} className="mr-2" /> Salir a almorzar
                    </Boton>
                  )}
                  <Boton
                    variante="secundario"
                    className="w-full"
                    onClick={() => fichar('particular')}
                    disabled={ejecutando}
                  >
                    <Footprints size={14} className="mr-2" /> Salgo un momento
                  </Boton>
                </div>
              )}

              {/* En almuerzo — puede volver manualmente o esperar retorno automático */}
              {turno?.estado === 'almuerzo' && (
                <div className="space-y-2">
                  <Boton
                    variante="primario"
                    className="w-full"
                    onClick={() => fichar('volver_almuerzo')}
                    disabled={ejecutando}
                    cargando={ejecutando}
                  >
                    <CornerDownLeft size={14} className="mr-2" /> Volver del almuerzo
                  </Boton>
                  <p className="text-xxs text-texto-terciario text-center">
                    También se registra automáticamente cuando vuelvas a usar Flux.
                  </p>
                </div>
              )}

              {/* En trámite — puede volver manualmente o esperar retorno automático */}
              {turno?.estado === 'particular' && (
                <div className="space-y-2">
                  <Boton
                    variante="primario"
                    className="w-full"
                    onClick={() => fichar('volver_particular')}
                    disabled={ejecutando}
                    cargando={ejecutando}
                  >
                    <CornerDownLeft size={14} className="mr-2" /> Ya volví
                  </Boton>
                  <p className="text-xxs text-texto-terciario text-center">
                    También se registra automáticamente cuando vuelvas a usar Flux.
                  </p>
                </div>
              )}

              {/* Sin turno aún */}
              {!turno && (
                <div className="bg-superficie-hover/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-texto-terciario text-center">
                    Tu entrada se fichará automáticamente cuando empieces a usar Flux.
                  </p>
                </div>
              )}

              {/* Jornada cerrada */}
              {estaCerrado && (
                <p className="text-center text-xs text-texto-terciario py-1">
                  Jornada finalizada. Hasta mañana.
                </p>
              )}
            </>
          ) : (
            <>
              {contenidoEstado}

              {/* Barra de timeline visual (manual) */}
              {turno && turno.hora_entrada && (
                <BarraTimeline turno={turno} horarioEsperado={horarioHoy} hour12={hour12} />
              )}

              {/* Acciones manuales */}
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
                    <Boton
                      variante="primario"
                      className="w-full"
                      onClick={() => fichar('entrada')}
                      disabled={ejecutando}
                      cargando={ejecutando}
                    >
                      <Play size={14} className="mr-2" /> Marcar entrada
                    </Boton>
                  )}

                  {/* En turno activo */}
                  {turno?.estado === 'activo' && (
                    <>
                      {!turno.inicio_almuerzo && (
                        <Boton
                          variante="secundario"
                          className="w-full"
                          onClick={() => fichar('almuerzo')}
                          disabled={ejecutando}
                        >
                          <UtensilsCrossed size={14} className="mr-2" /> Salir a almorzar
                        </Boton>
                      )}
                      <Boton
                        variante="secundario"
                        className="w-full"
                        onClick={() => fichar('particular')}
                        disabled={ejecutando}
                      >
                        <Footprints size={14} className="mr-2" /> Salgo un momento
                      </Boton>
                      <Boton
                        variante="peligro"
                        className="w-full"
                        onClick={() => fichar('salida')}
                        disabled={ejecutando}
                        cargando={ejecutando}
                      >
                        <Square size={14} className="mr-2" /> Terminar jornada
                      </Boton>
                    </>
                  )}

                  {/* En almuerzo */}
                  {turno?.estado === 'almuerzo' && (
                    <>
                      <Boton
                        variante="primario"
                        className="w-full"
                        onClick={() => fichar('volver_almuerzo')}
                        disabled={ejecutando}
                        cargando={ejecutando}
                      >
                        <CornerDownLeft size={14} className="mr-2" /> Volver del almuerzo
                      </Boton>
                      <Boton
                        variante="peligro"
                        className="w-full"
                        onClick={() => fichar('salida')}
                        disabled={ejecutando}
                      >
                        <Square size={14} className="mr-2" /> Terminar jornada
                      </Boton>
                    </>
                  )}

                  {/* En trámite */}
                  {turno?.estado === 'particular' && (
                    <>
                      <Boton
                        variante="primario"
                        className="w-full"
                        onClick={() => fichar('volver_particular')}
                        disabled={ejecutando}
                        cargando={ejecutando}
                      >
                        <CornerDownLeft size={14} className="mr-2" /> Ya volví
                      </Boton>
                      <Boton
                        variante="peligro"
                        className="w-full"
                        onClick={() => fichar('salida')}
                        disabled={ejecutando}
                      >
                        <Square size={14} className="mr-2" /> Terminar jornada
                      </Boton>
                    </>
                  )}

                  {/* Jornada cerrada */}
                  {estaCerrado && (
                    <p className="text-center text-xs text-texto-terciario py-2">
                      Jornada finalizada. Hasta mañana.
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      }
    >
      <button
        type="button"
        title="Jornada"
        className={[
          'flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors cursor-pointer border-none',
          'hover:bg-superficie-hover text-texto-terciario hover:text-texto-secundario',
        ].join(' ')}
      >
        {/* Dot de estado (siempre visible) */}
        <span className={[
          'size-2 rounded-full shrink-0 transition-colors',
          colorIndicador || 'bg-texto-terciario/30',
        ].join(' ')} />
        {/* Timer en desktop, oculto en móvil */}
        {estaAbierto ? (
          <span className="hidden sm:inline text-xs font-medium font-mono tabular-nums text-texto-secundario">
            {formatearDuracion(minutosVivos)}
          </span>
        ) : estaCerrado ? (
          <span className="hidden sm:inline text-xs font-medium font-mono tabular-nums text-texto-terciario">
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

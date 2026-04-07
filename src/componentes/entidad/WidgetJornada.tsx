'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Clock, Play, Square, UtensilsCrossed, Footprints,
  CornerDownLeft, MapPin, Loader2,
} from 'lucide-react'
import { PopoverAdaptable as Popover } from '@/componentes/ui/PopoverAdaptable'
import { Boton } from '@/componentes/ui/Boton'
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

function formatearHora(iso: string | null): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
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
  const [abierto, setAbierto] = useState(false)
  const [turno, setTurno] = useState<TurnoHoy | null>(null)
  const [metodoFichaje, setMetodoFichaje] = useState<string | null>(null)
  const [, setConfig] = useState<ConfigFichaje | null>(null)
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

  // Si el método es automático, no mostrar el widget
  if (metodoFichaje === 'automatico') return null

  const estaAbierto = turno && ['activo', 'almuerzo', 'particular'].includes(turno.estado)
  const estaCerrado = turno && ['cerrado', 'auto_cerrado'].includes(turno.estado)

  // Color del indicador en el botón del header
  const colorIndicador = !turno ? '' : estaAbierto ? COLOR_ESTADO[turno.estado] || '' : ''

  return (
    <Popover
      abierto={abierto}
      onCambio={setAbierto}
      alineacion="fin"
      ancho={320}
      offset={10}
      tituloMovil="Jornada"
      contenido={
        <div className="p-4 space-y-4">
          {cargando ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-texto-terciario" />
            </div>
          ) : (
            <>
              {/* Estado actual */}
              <div className="text-center">
                {!turno && (
                  <p className="text-sm text-texto-terciario mb-1">Sin fichaje hoy</p>
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
                      Entrada: {formatearHora(turno.hora_entrada)}
                      {turno.hora_salida && ` — Salida: ${formatearHora(turno.hora_salida)}`}
                    </p>
                    {turno.inicio_almuerzo && (
                      <p className="text-xs text-texto-terciario">
                        Almuerzo: {formatearHora(turno.inicio_almuerzo)}
                        {turno.fin_almuerzo && ` — ${formatearHora(turno.fin_almuerzo)}`}
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

              {/* Acciones */}
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
      <Boton
        variante="fantasma"
        tamano="xs"
        soloIcono
        icono={
          <span className="relative">
            <Clock size={17} strokeWidth={1.75} />
            {colorIndicador && (
              <span className={`absolute -top-0.5 -right-0.5 size-2 rounded-full ${colorIndicador} ring-2 ring-superficie-app`} />
            )}
          </span>
        }
        titulo="Jornada"
        className="relative"
      />
    </Popover>
  )
}

export { WidgetJornada }

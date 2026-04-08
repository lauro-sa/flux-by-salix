/**
 * Pantalla de acciones contextuales — réplica del kiosco viejo.
 *
 * Layout:
 *   activo (sin almuerzo) → [Almuerzo | Trámite] + [Salida full width]
 *   activo (ya almorzó)   → [Trámite]            + [Salida full width]
 *   almuerzo              → [Volver al trabajo]   + [Salida]
 *   particular            → [Ya volví]            + [Salida]
 *
 * - Countdown visible 15s con barra de progreso
 * - Pop animation en últimos 3s en botones secundarios
 * - Auto-salida al llegar a 0 (si tiene turno)
 */
'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  UtensilsCrossed, Footprints, ArrowRight, LogOut, LogIn,
  FileText, X,
} from 'lucide-react'

type EstadoTurno = 'activo' | 'almuerzo' | 'particular' | null
type Accion = 'entrada' | 'salida' | 'almuerzo' | 'volver_almuerzo' | 'particular' | 'volver_particular'

interface PropsPantallaAcciones {
  nombre: string
  fotoUrl?: string | null
  estadoTurno: EstadoTurno
  yaAlmorzo: boolean
  tieneSolicitudes: boolean
  alAccionar: (accion: Accion) => void
  alReportar: () => void
  alTimeout: () => void
}

const TIMEOUT = 15
const POP_EN = 3

// Definiciones de botones con colores como el viejo
const BOTONES = {
  almuerzo: {
    accion: 'almuerzo' as Accion,
    icono: <UtensilsCrossed size={26} />,
    label: 'Salir a almorzar',
    detalle: 'Registrar pausa de almuerzo',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    color: '#fcd34d',
  },
  particular: {
    accion: 'particular' as Accion,
    icono: <Footprints size={26} />,
    label: 'Salgo un momento',
    detalle: 'Trámite o gestión personal',
    bg: 'rgba(56,189,248,0.12)',
    border: 'rgba(56,189,248,0.3)',
    color: '#7dd3fc',
  },
  volver_almuerzo: {
    accion: 'volver_almuerzo' as Accion,
    icono: <ArrowRight size={26} />,
    label: 'Volver del almuerzo',
    detalle: 'Continuar jornada',
    bg: 'rgba(74,222,128,0.12)',
    border: 'rgba(74,222,128,0.3)',
    color: '#86efac',
  },
  volver_particular: {
    accion: 'volver_particular' as Accion,
    icono: <ArrowRight size={26} />,
    label: 'Ya volví',
    detalle: 'Continuar jornada',
    bg: 'rgba(74,222,128,0.12)',
    border: 'rgba(74,222,128,0.3)',
    color: '#86efac',
  },
}

const BADGE_ESTADO: Record<string, { texto: string; bg: string; color: string }> = {
  activo: { texto: 'En turno', bg: 'rgba(74,222,128,0.15)', color: '#86efac' },
  almuerzo: { texto: 'En almuerzo', bg: 'rgba(245,158,11,0.15)', color: '#fcd34d' },
  particular: { texto: 'Fuera — trámite', bg: 'rgba(56,189,248,0.15)', color: '#7dd3fc' },
}

function obtenerBotonesSecundarios(estado: EstadoTurno, yaAlmorzo: boolean) {
  if (estado === 'almuerzo') return [BOTONES.volver_almuerzo]
  if (estado === 'particular') return [BOTONES.volver_particular]
  if (yaAlmorzo) return [BOTONES.particular]
  return [BOTONES.almuerzo, BOTONES.particular]
}

export default function PantallaAcciones({
  nombre,
  fotoUrl,
  estadoTurno,
  yaAlmorzo,
  tieneSolicitudes,
  alAccionar,
  alReportar,
  alTimeout,
}: PropsPantallaAcciones) {
  const [contador, setContador] = useState(TIMEOUT)
  const [pausado, setPausado] = useState(false)

  // Countdown — se pausa si el usuario toca la pantalla
  useEffect(() => {
    if (pausado) return
    if (contador <= 0) {
      if (estadoTurno) {
        alAccionar('salida')
      } else {
        alTimeout()
      }
      return
    }
    const timer = setTimeout(() => setContador((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [contador, pausado, estadoTurno, alAccionar, alTimeout])

  const resetContador = useCallback(() => setContador(TIMEOUT), [])

  const pctPasado = (TIMEOUT - contador) / TIMEOUT
  const popActivo = contador <= POP_EN

  const botonesSecundarios = obtenerBotonesSecundarios(estadoTurno, yaAlmorzo)
  const badge = estadoTurno ? BADGE_ESTADO[estadoTurno] : null
  const iniciales = nombre.split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase()

  return (
    <motion.div
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
      onMouseDown={() => setPausado(true)}
      onMouseUp={() => setPausado(false)}
      onMouseLeave={() => setPausado(false)}
      className="flex flex-col items-center justify-center h-full gap-4 landscape:gap-3 md:gap-6 px-6 md:px-8 py-6 landscape:py-3 select-none overflow-y-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Avatar + nombre + cargo */}
      <div className="flex flex-col items-center gap-3 landscape:gap-2 md:gap-4">
        {fotoUrl ? (
          <div className="w-44 landscape:w-44 md:w-56 aspect-[3/4] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
            style={{ border: '4px solid rgba(63,63,70,0.6)' }}
          >
            <img src={fotoUrl} alt={nombre} className="w-full h-full object-cover" draggable={false} />
          </div>
        ) : (
          <div
            className="w-36 h-36 landscape:w-32 landscape:h-32 md:w-44 md:h-44 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(123,123,216,0.15)',
              border: '4px solid rgba(123,123,216,0.3)',
            }}
          >
            <span className="text-5xl md:text-7xl font-black" style={{ color: 'var(--texto-marca)' }}>{iniciales}</span>
          </div>
        )}

        <div className="text-center">
          <p className="text-xl landscape:text-lg md:text-2xl font-black" style={{ color: '#f4f4f5' }}>{nombre}</p>
        </div>

        {/* Badge de estado */}
        {badge && (
          <div
            className="flex items-center gap-2 px-4 py-1.5 md:px-5 md:py-2 rounded-full text-sm md:text-base font-semibold"
            style={{ backgroundColor: badge.bg, color: badge.color }}
          >
            {badge.texto}
          </div>
        )}
      </div>

      {/* Botones de acción */}
      {estadoTurno ? (
        <div className="flex flex-col gap-2 md:gap-3 w-full max-w-xl md:max-w-2xl">
          {/* Botones secundarios en fila */}
          <div className="flex items-stretch gap-2 md:gap-3">
            {botonesSecundarios.map((btn) => (
              <button
                key={btn.accion}
                onClick={() => { resetContador(); alAccionar(btn.accion) }}
                disabled={popActivo}
                style={{
                  backgroundColor: btn.bg,
                  borderColor: btn.border,
                  color: btn.color,
                  opacity: popActivo ? 0 : Math.max(0.45, 1 - pctPasado * 0.55),
                  transition: 'opacity 0.95s linear',
                  ...(popActivo ? { animation: 'kiosco-pop-btn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards', pointerEvents: 'none' as const } : {}),
                }}
                className="flex-1 flex items-center gap-2 md:gap-3 px-4 py-3 landscape:py-2.5 md:px-5 md:py-4 rounded-xl md:rounded-2xl text-sm md:text-base font-bold justify-center border transition-colors active:scale-95 disabled:cursor-not-allowed"
              >
                {btn.icono}
                <div className="text-left">
                  <p className="leading-tight">{btn.label}</p>
                  <p className="text-xs md:text-sm font-normal opacity-60 leading-tight">{btn.detalle}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Botón Salida — full width con fill de progreso */}
          <button
            onClick={() => { resetContador(); alAccionar('salida') }}
            className="relative overflow-hidden w-full flex items-center gap-2 md:gap-3 px-5 py-3.5 landscape:py-3 md:px-6 md:py-5 rounded-xl md:rounded-2xl text-base md:text-lg font-bold justify-center border transition-colors active:scale-[0.98]"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              borderColor: 'rgba(239,68,68,0.25)',
              color: '#fca5a5',
            }}
          >
            <div
              className="absolute inset-0 origin-left"
              style={{
                backgroundColor: 'rgba(239,68,68,0.18)',
                transform: `scaleX(${pctPasado})`,
                transition: 'transform 0.95s linear',
                borderRadius: 'inherit',
              }}
            />
            <div className="relative z-10 flex items-center gap-3 md:gap-4">
              <LogOut size={28} />
              <div className="text-left">
                <p className="leading-tight">Terminar jornada</p>
                <p className="text-xs md:text-sm font-normal opacity-60 leading-tight">Registrar salida definitiva</p>
              </div>
            </div>
          </button>
        </div>
      ) : (
        /* Sin turno → Empezar */
        <button
          onClick={() => { resetContador(); alAccionar('entrada') }}
          className="w-full max-w-xl md:max-w-2xl flex items-center gap-2 md:gap-3 px-5 py-4 landscape:py-3 md:px-6 md:py-5 rounded-xl md:rounded-2xl text-base md:text-lg font-bold justify-center border transition-colors active:scale-95"
          style={{
            backgroundColor: 'rgba(74,222,128,0.12)',
            borderColor: 'rgba(74,222,128,0.3)',
            color: '#86efac',
          }}
        >
          <LogIn size={28} />
          <div className="text-left">
            <p className="leading-tight">Empezar turno</p>
            <p className="text-xs md:text-sm font-normal opacity-60 leading-tight">Registrar entrada</p>
          </div>
        </button>
      )}

      {/* Reportar asistencia — siempre visible */}
      {(
        <button
          onClick={() => { resetContador(); alReportar() }}
          className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl text-sm md:text-base font-medium transition-all active:scale-95"
          style={{
            backgroundColor: 'rgba(39,39,42,0.6)',
            border: '1px solid rgba(63,63,70,0.4)',
            color: '#a1a1aa',
          }}
        >
          <FileText size={18} /> Reportar asistencia
        </button>
      )}

      {/* Barra countdown + cancelar */}
      {estadoTurno ? (
        <div className="flex flex-col items-center gap-2 md:gap-3 w-full max-w-xs md:max-w-md mt-6 landscape:mt-4">
          <div className="w-full h-1 md:h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#27272a' }}>
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: '#52525b',
                width: `${(contador / TIMEOUT) * 100}%`,
                transition: 'width 0.95s linear',
              }}
            />
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <p className="text-xs md:text-base" style={{ color: pausado ? '#a1a1aa' : '#52525b' }}>
              {pausado ? 'Pausado — soltá para continuar' : `Salida automática en ${contador}s`}
            </p>
            <button
              onClick={alTimeout}
              className="text-xs md:text-base font-medium flex items-center gap-1 transition-colors"
              style={{ color: '#52525b' }}
            >
              <X size={14} /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={alTimeout}
          className="text-xs md:text-base font-medium flex items-center gap-1 transition-colors"
          style={{ color: '#52525b' }}
        >
          <X size={14} /> Cancelar
        </button>
      )}
    </motion.div>
  )
}

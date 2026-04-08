/**
 * Pantalla de acciones contextuales según el estado del turno.
 * Replicado del kiosco viejo:
 * - Countdown visible de 15s → auto-salida o volver a espera
 * - Botones secundarios desaparecen en últimos 3s
 * - Botón salida con barra de progreso
 * - Botón cancelar para volver a espera
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

const TIMEOUT_SEGUNDOS = 15

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
  const [contador, setContador] = useState(TIMEOUT_SEGUNDOS)

  // Countdown de inactividad
  useEffect(() => {
    if (contador <= 0) {
      alTimeout()
      return
    }
    const timer = setTimeout(() => setContador((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [contador, alTimeout])

  // Resetear contador al tocar cualquier botón
  const resetearContador = useCallback(() => {
    setContador(TIMEOUT_SEGUNDOS)
  }, [])

  const accionConReset = useCallback((accion: Accion) => {
    resetearContador()
    alAccionar(accion)
  }, [resetearContador, alAccionar])

  const botonesVisibles = contador > 3

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-6 md:gap-8 px-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
    >
      {/* Avatar + saludo */}
      <div className="flex flex-col items-center gap-3">
        {fotoUrl ? (
          <img
            src={fotoUrl}
            alt={nombre}
            className="w-28 h-28 md:w-36 md:h-36 rounded-3xl object-cover shadow-2xl"
            style={{ border: '4px solid #27272a' }}
          />
        ) : (
          <div
            className="w-28 h-28 md:w-36 md:h-36 rounded-3xl flex items-center justify-center text-5xl font-semibold shadow-2xl"
            style={{ backgroundColor: '#18181b', color: 'var(--texto-marca)', border: '4px solid #27272a' }}
          >
            {nombre.charAt(0).toUpperCase()}
          </div>
        )}
        <h2
          className="font-semibold"
          style={{ fontSize: 'clamp(1.25rem, 4vw, 2rem)', color: '#f8fafc' }}
        >
          Hola, {nombre}
        </h2>

        {/* Estado actual */}
        {estadoTurno && (
          <span
            className="text-sm px-3 py-1 rounded-full"
            style={{
              backgroundColor: estadoTurno === 'activo' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
              color: estadoTurno === 'activo' ? '#4ade80' : '#fbbf24',
            }}
          >
            {estadoTurno === 'activo' ? 'En turno' : estadoTurno === 'almuerzo' ? 'En almuerzo' : 'Fuera — trámite'}
          </span>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <AnimatePresence>
          {botonesVisibles && (
            <>
              {/* Sin turno → Empezar */}
              {!estadoTurno && (
                <BotonAccion key="entrada" icono="▶" texto="Empezar turno" onClick={() => accionConReset('entrada')} />
              )}

              {/* Turno activo sin almuerzo previo */}
              {estadoTurno === 'activo' && !yaAlmorzo && (
                <BotonAccion key="almuerzo" icono="🍽" texto="Salir a almorzar" onClick={() => accionConReset('almuerzo')} />
              )}

              {/* Turno activo — salir un momento */}
              {estadoTurno === 'activo' && (
                <BotonAccion key="particular" icono="📋" texto="Salgo un momento" onClick={() => accionConReset('particular')} />
              )}

              {/* En almuerzo */}
              {estadoTurno === 'almuerzo' && (
                <BotonAccion key="volver_almuerzo" icono="🔙" texto="Volver del almuerzo" onClick={() => accionConReset('volver_almuerzo')} />
              )}

              {/* En trámite */}
              {estadoTurno === 'particular' && (
                <BotonAccion key="volver_particular" icono="🔙" texto="Ya volví" onClick={() => accionConReset('volver_particular')} />
              )}

              {/* Reportar asistencia */}
              {tieneSolicitudes && (
                <BotonAccion key="reportar" icono="📝" texto="Reportar asistencia" onClick={() => { resetearContador(); alReportar() }} variante="secundario" />
              )}
            </>
          )}
        </AnimatePresence>

        {/* Separador */}
        {estadoTurno && (
          <div className="h-px my-1" style={{ backgroundColor: '#27272a' }} />
        )}

        {/* Terminar jornada — solo si tiene turno activo */}
        {estadoTurno && (
          <button
            onClick={() => accionConReset('salida')}
            className="relative w-full py-4 md:py-5 rounded-2xl font-medium transition-all overflow-hidden active:scale-[0.98]"
            style={{
              fontSize: 'clamp(1rem, 3vw, 1.25rem)',
              backgroundColor: '#18181b',
              color: '#f87171',
              border: '1px solid #27272a',
            }}
          >
            {/* Barra de progreso */}
            <div
              className="absolute left-0 top-0 h-full transition-all duration-1000 ease-linear"
              style={{
                backgroundColor: '#f87171',
                opacity: 0.15,
                width: `${((TIMEOUT_SEGUNDOS - contador) / TIMEOUT_SEGUNDOS) * 100}%`,
              }}
            />
            <span className="relative z-10">🚪 Terminar jornada</span>
          </button>
        )}
      </div>

      {/* Footer: countdown + cancelar */}
      <div className="flex flex-col items-center gap-3 mt-2">
        <p className="text-sm" style={{ color: '#64748b' }}>
          Volviendo en {contador}s
        </p>
        <button
          onClick={alTimeout}
          className="text-sm px-4 py-2 rounded-lg transition-all active:scale-95"
          style={{ color: '#94a3b8', backgroundColor: '#18181b', border: '1px solid #27272a' }}
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  )
}

function BotonAccion({
  icono,
  texto,
  onClick,
  variante = 'primario',
}: {
  icono: string
  texto: string
  onClick: () => void
  variante?: 'primario' | 'secundario'
}) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full py-4 md:py-5 rounded-2xl font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-3"
      style={{
        fontSize: 'clamp(1rem, 3vw, 1.25rem)',
        backgroundColor: variante === 'primario' ? '#18181b' : 'transparent',
        color: '#f8fafc',
        border: `1px solid ${variante === 'primario' ? '#27272a' : '#3f3f46'}`,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      <span>{icono}</span>
      <span>{texto}</span>
    </motion.button>
  )
}

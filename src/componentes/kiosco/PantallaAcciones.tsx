/**
 * Pantalla de acciones contextuales según el estado del turno.
 * Timeout de 15s → vuelve a espera.
 * Botón "Terminar jornada" con countdown de 15s para evitar toques accidentales.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

type EstadoTurno = 'activo' | 'almuerzo' | 'particular' | null
type Accion = 'entrada' | 'salida' | 'almuerzo' | 'volver_almuerzo' | 'particular' | 'volver_particular'

interface PropsPantallaAcciones {
  /** Nombre del empleado */
  nombre: string
  /** Foto del empleado */
  fotoUrl?: string | null
  /** Estado actual del turno */
  estadoTurno: EstadoTurno
  /** Si ya almorzó hoy */
  yaAlmorzo: boolean
  /** Si tiene solicitudes pendientes */
  tieneSolicitudes: boolean
  /** Callback al seleccionar acción */
  alAccionar: (accion: Accion) => void
  /** Callback para abrir formulario de solicitud */
  alReportar: () => void
  /** Callback al expirar timeout (volver a espera) */
  alTimeout: () => void
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
  const [segundosRestantes, setSegundosRestantes] = useState(15)
  const [salidaDesbloqueada, setSalidaDesbloqueada] = useState(false)

  // Timeout de inactividad: 15s → volver a espera
  useEffect(() => {
    const timer = setTimeout(alTimeout, 15000)
    return () => clearTimeout(timer)
  }, [alTimeout])

  // Countdown para desbloquear botón de salida
  useEffect(() => {
    if (segundosRestantes <= 0) {
      setSalidaDesbloqueada(true)
      return
    }
    const timer = setTimeout(() => setSegundosRestantes((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [segundosRestantes])

  const manejarSalida = useCallback(() => {
    if (salidaDesbloqueada) {
      alAccionar('salida')
    }
  }, [salidaDesbloqueada, alAccionar])

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-8 px-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
    >
      {/* Saludo con foto */}
      <div className="flex flex-col items-center gap-3">
        {fotoUrl && (
          <img
            src={fotoUrl}
            alt={nombre}
            className="w-20 h-20 rounded-full object-cover"
            style={{ border: '3px solid var(--borde-sutil)' }}
          />
        )}
        <h2
          className="text-2xl font-semibold"
          style={{ color: 'var(--texto-primario)' }}
        >
          Hola, {nombre}
        </h2>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {/* Turno activo sin almuerzo previo */}
        {estadoTurno === 'activo' && !yaAlmorzo && (
          <BotonAccion
            icono="🍽"
            texto="Salir a almorzar"
            onClick={() => alAccionar('almuerzo')}
          />
        )}

        {/* Turno activo — salir un momento */}
        {estadoTurno === 'activo' && (
          <BotonAccion
            icono="📋"
            texto="Salgo un momento"
            onClick={() => alAccionar('particular')}
          />
        )}

        {/* En almuerzo */}
        {estadoTurno === 'almuerzo' && (
          <BotonAccion
            icono="🔙"
            texto="Volver del almuerzo"
            onClick={() => alAccionar('volver_almuerzo')}
          />
        )}

        {/* En trámite */}
        {estadoTurno === 'particular' && (
          <BotonAccion
            icono="🔙"
            texto="Ya volví"
            onClick={() => alAccionar('volver_particular')}
          />
        )}

        {/* Reportar asistencia */}
        {tieneSolicitudes && (
          <BotonAccion
            icono="📝"
            texto="Reportar asistencia"
            onClick={alReportar}
            variante="secundario"
          />
        )}

        {/* Separador */}
        {estadoTurno && (
          <div
            className="h-px my-1"
            style={{ backgroundColor: 'var(--borde-sutil)' }}
          />
        )}

        {/* Terminar jornada con countdown */}
        {estadoTurno && (
          <button
            onClick={manejarSalida}
            disabled={!salidaDesbloqueada}
            className="relative w-full py-4 rounded-2xl text-lg font-medium transition-all overflow-hidden active:scale-[0.98]"
            style={{
              backgroundColor: salidaDesbloqueada
                ? 'var(--insignia-peligro)'
                : 'var(--superficie-tarjeta)',
              color: salidaDesbloqueada
                ? '#fff'
                : 'var(--texto-terciario)',
              border: salidaDesbloqueada
                ? 'none'
                : '1px solid var(--borde-sutil)',
            }}
          >
            {/* Barra de progreso */}
            {!salidaDesbloqueada && (
              <div
                className="absolute left-0 top-0 h-full transition-all duration-1000 ease-linear"
                style={{
                  backgroundColor: 'var(--insignia-peligro)',
                  opacity: 0.1,
                  width: `${((15 - segundosRestantes) / 15) * 100}%`,
                }}
              />
            )}
            <span className="relative z-10">
              🚪 Terminar jornada
              {!salidaDesbloqueada && ` ··· ${segundosRestantes}s`}
            </span>
          </button>
        )}
      </div>
    </motion.div>
  )
}

// Botón de acción reutilizable
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
    <button
      onClick={onClick}
      className="w-full py-4 rounded-2xl text-lg font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-3"
      style={{
        backgroundColor: variante === 'primario'
          ? 'var(--superficie-tarjeta)'
          : 'transparent',
        color: 'var(--texto-primario)',
        border: `1px solid var(--borde-${variante === 'primario' ? 'sutil' : 'fuerte'})`,
      }}
    >
      <span>{icono}</span>
      <span>{texto}</span>
    </button>
  )
}

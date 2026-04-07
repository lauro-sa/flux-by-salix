/**
 * Pantalla de acciones contextuales según el estado del turno.
 * Timeout 15s → vuelve a espera.
 * Botón salida con countdown + barra de progreso.
 * Tema negro puro.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

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

  useEffect(() => {
    const timer = setTimeout(alTimeout, 15000)
    return () => clearTimeout(timer)
  }, [alTimeout])

  useEffect(() => {
    if (segundosRestantes <= 0) {
      setSalidaDesbloqueada(true)
      return
    }
    const timer = setTimeout(() => setSegundosRestantes((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [segundosRestantes])

  const manejarSalida = useCallback(() => {
    if (salidaDesbloqueada) alAccionar('salida')
  }, [salidaDesbloqueada, alAccionar])

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
            className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover"
            style={{ border: '3px solid #27272a' }}
          />
        ) : (
          <div
            className="w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center text-4xl font-semibold"
            style={{ backgroundColor: '#18181b', color: '#3b82f6', border: '3px solid #27272a' }}
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
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {estadoTurno === 'activo' && !yaAlmorzo && (
          <BotonAccion icono="🍽" texto="Salir a almorzar" onClick={() => alAccionar('almuerzo')} />
        )}
        {estadoTurno === 'activo' && (
          <BotonAccion icono="📋" texto="Salgo un momento" onClick={() => alAccionar('particular')} />
        )}
        {estadoTurno === 'almuerzo' && (
          <BotonAccion icono="🔙" texto="Volver del almuerzo" onClick={() => alAccionar('volver_almuerzo')} />
        )}
        {estadoTurno === 'particular' && (
          <BotonAccion icono="🔙" texto="Ya volví" onClick={() => alAccionar('volver_particular')} />
        )}

        {tieneSolicitudes && (
          <BotonAccion icono="📝" texto="Reportar asistencia" onClick={alReportar} variante="secundario" />
        )}

        {estadoTurno && (
          <>
            <div className="h-px my-1" style={{ backgroundColor: '#27272a' }} />
            <button
              onClick={manejarSalida}
              disabled={!salidaDesbloqueada}
              className="relative w-full py-4 md:py-5 rounded-2xl font-medium transition-all overflow-hidden active:scale-[0.98]"
              style={{
                fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                backgroundColor: salidaDesbloqueada ? '#f87171' : '#18181b',
                color: salidaDesbloqueada ? '#fff' : '#64748b',
                border: salidaDesbloqueada ? 'none' : '1px solid #27272a',
              }}
            >
              {/* Barra de progreso de izquierda a derecha */}
              {!salidaDesbloqueada && (
                <div
                  className="absolute left-0 top-0 h-full transition-all duration-1000 ease-linear"
                  style={{
                    backgroundColor: '#f87171',
                    opacity: 0.15,
                    width: `${((15 - segundosRestantes) / 15) * 100}%`,
                  }}
                />
              )}
              <span className="relative z-10">
                🚪 Terminar jornada
                {!salidaDesbloqueada && ` ··· ${segundosRestantes}s`}
              </span>
            </button>
          </>
        )}
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
    <button
      onClick={onClick}
      className="w-full py-4 md:py-5 rounded-2xl font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-3"
      style={{
        fontSize: 'clamp(1rem, 3vw, 1.25rem)',
        backgroundColor: variante === 'primario' ? '#18181b' : 'transparent',
        color: '#f8fafc',
        border: `1px solid ${variante === 'primario' ? '#27272a' : '#3f3f46'}`,
      }}
    >
      <span>{icono}</span>
      <span>{texto}</span>
    </button>
  )
}

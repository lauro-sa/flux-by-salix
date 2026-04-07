/**
 * Pantalla de confirmación post-fichaje.
 * Muestra foto, saludo contextual, confeti en cumpleaños.
 * Auto-dismiss: 4s normal / 8s cumpleaños o salida.
 */
'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { lanzarConfeti } from '@/lib/kiosco/confeti'
import {
  sonarEntrada,
  sonarCumpleanosEntrada,
  sonarCumpleanosSalida,
} from '@/lib/kiosco/sonidos'

type TipoAccion = 'entrada' | 'salida' | 'almuerzo' | 'volver_almuerzo' | 'particular' | 'volver_particular'

interface PropsPantallaConfirmacion {
  /** Nombre del empleado */
  nombre: string
  /** Sector/departamento */
  sector?: string | null
  /** URL de la foto del empleado */
  fotoUrl?: string | null
  /** Acción que se ejecutó */
  accion: TipoAccion
  /** Si es cumpleaños del empleado */
  esCumpleanos: boolean
  /** Horas trabajadas hoy (para salida) */
  horasTrabajadas?: string | null
  /** Si completó la jornada */
  jornadaCompleta?: boolean
  /** Callback al expirar auto-dismiss */
  alDismiss: () => void
}

function obtenerMensaje(
  nombre: string,
  accion: TipoAccion,
  esCumpleanos: boolean,
  horasTrabajadas?: string | null,
  jornadaCompleta?: boolean,
): string {
  if (accion === 'entrada' && esCumpleanos) return `¡Feliz cumpleaños, ${nombre}! 🎂`
  if (accion === 'salida' && esCumpleanos) return '¡A celebrar! 🎈'
  if (accion === 'entrada') return `¡Buen turno, ${nombre}!`
  if (accion === 'almuerzo') return '¡Buen provecho!'
  if (accion === 'volver_almuerzo') return '¡De vuelta al trabajo!'
  if (accion === 'particular') return '¡Hasta pronto!'
  if (accion === 'volver_particular') return '¡De vuelta!'
  if (accion === 'salida' && jornadaCompleta) return 'Jornada completa'
  if (accion === 'salida' && horasTrabajadas) return `Hoy trabajaste ${horasTrabajadas}`
  return `¡Hasta mañana, ${nombre}!`
}

export default function PantallaConfirmacion({
  nombre,
  sector,
  fotoUrl,
  accion,
  esCumpleanos,
  horasTrabajadas,
  jornadaCompleta,
  alDismiss,
}: PropsPantallaConfirmacion) {
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Auto-dismiss
  const duracion = esCumpleanos || accion === 'salida' ? 8000 : 4000
  useEffect(() => {
    const timer = setTimeout(alDismiss, duracion)
    return () => clearTimeout(timer)
  }, [alDismiss, duracion])

  // Sonido y confeti
  useEffect(() => {
    if (esCumpleanos && accion === 'entrada') {
      sonarCumpleanosEntrada()
      if (contenedorRef.current) {
        lanzarConfeti(contenedorRef.current, 'explosion', 3000)
      }
    } else if (esCumpleanos && accion === 'salida') {
      sonarCumpleanosSalida()
      if (contenedorRef.current) {
        lanzarConfeti(contenedorRef.current, 'lluvia', 4000)
      }
    } else {
      sonarEntrada()
    }
  }, [esCumpleanos, accion])

  const mensaje = obtenerMensaje(nombre, accion, esCumpleanos, horasTrabajadas, jornadaCompleta)

  return (
    <motion.div
      ref={contenedorRef}
      className="flex flex-col items-center justify-center h-full gap-6"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Foto del empleado */}
      {fotoUrl ? (
        <motion.img
          src={fotoUrl}
          alt={nombre}
          className="w-32 h-32 rounded-full object-cover"
          style={{ border: '4px solid var(--texto-marca)' }}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        />
      ) : (
        <motion.div
          className="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-semibold"
          style={{
            backgroundColor: 'var(--superficie-tarjeta)',
            color: 'var(--texto-marca)',
            border: '4px solid var(--texto-marca)',
          }}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          {nombre.charAt(0).toUpperCase()}
        </motion.div>
      )}

      {/* Nombre y sector */}
      <div className="flex flex-col items-center gap-1">
        <h2
          className="text-3xl font-semibold"
          style={{ color: 'var(--texto-primario)' }}
        >
          {nombre}
        </h2>
        {sector && (
          <p
            className="text-lg"
            style={{ color: 'var(--texto-secundario)' }}
          >
            {sector}
          </p>
        )}
      </div>

      {/* Mensaje contextual */}
      <motion.p
        className="text-2xl font-medium flex items-center gap-2"
        style={{ color: 'var(--texto-marca)' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {mensaje} {!esCumpleanos && '✓'}
      </motion.p>
    </motion.div>
  )
}

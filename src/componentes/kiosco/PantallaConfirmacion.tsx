/**
 * Pantalla de confirmación post-fichaje.
 * Foto grande, saludo contextual, confeti en cumpleaños.
 * Auto-dismiss: 4s normal / 8s cumpleaños o salida.
 * Tema negro puro.
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
  nombre: string
  sector?: string | null
  fotoUrl?: string | null
  accion: TipoAccion
  esCumpleanos: boolean
  horasTrabajadas?: string | null
  jornadaCompleta?: boolean
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

  const duracion = esCumpleanos || accion === 'salida' ? 8000 : 4000
  useEffect(() => {
    const timer = setTimeout(alDismiss, duracion)
    return () => clearTimeout(timer)
  }, [alDismiss, duracion])

  useEffect(() => {
    if (esCumpleanos && accion === 'entrada') {
      sonarCumpleanosEntrada()
      if (contenedorRef.current) lanzarConfeti(contenedorRef.current, 'explosion', 3000)
    } else if (esCumpleanos && accion === 'salida') {
      sonarCumpleanosSalida()
      if (contenedorRef.current) lanzarConfeti(contenedorRef.current, 'lluvia', 4000)
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
      {/* Foto del empleado — grande, con borde marca */}
      {fotoUrl ? (
        <motion.img
          src={fotoUrl}
          alt={nombre}
          className="w-36 h-36 md:w-44 md:h-44 rounded-3xl object-cover shadow-2xl"
          style={{ border: '4px solid var(--texto-marca)' }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        />
      ) : (
        <motion.div
          className="w-36 h-36 md:w-44 md:h-44 rounded-3xl flex items-center justify-center shadow-2xl"
          style={{
            backgroundColor: '#18181b',
            color: 'var(--texto-marca)',
            border: '4px solid var(--texto-marca)',
            fontSize: 'clamp(2.5rem, 8vw, 4rem)',
            fontWeight: 600,
          }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          {nombre.charAt(0).toUpperCase()}
        </motion.div>
      )}

      {/* Nombre y sector */}
      <div className="flex flex-col items-center gap-1">
        <h2
          className="font-semibold"
          style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', color: '#f8fafc' }}
        >
          {nombre}
        </h2>
        {sector && (
          <p style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)', color: '#94a3b8' }}>
            {sector}
          </p>
        )}
      </div>

      {/* Mensaje contextual */}
      <motion.p
        className="font-medium flex items-center gap-2"
        style={{ fontSize: 'clamp(1.25rem, 4vw, 2rem)', color: 'var(--texto-marca)' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {mensaje} {!esCumpleanos && '✓'}
      </motion.p>

      {/* Barra de progreso auto-dismiss */}
      <motion.div
        className="absolute bottom-0 left-0 h-1 rounded-full"
        style={{ backgroundColor: 'var(--texto-marca)' }}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duracion / 1000, ease: 'linear' }}
      />
    </motion.div>
  )
}

/**
 * Reloj digital con segundos, actualización cada segundo.
 * Tipografía fluida con clamp() para escalar en cualquier tablet.
 */
'use client'

import { useState, useEffect } from 'react'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function formatearHora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatearFecha(fecha: Date): string {
  const dia = DIAS[fecha.getDay()]
  const num = fecha.getDate()
  const mes = MESES[fecha.getMonth()]
  const anio = fecha.getFullYear()
  return `${dia} ${num} de ${mes}, ${anio}`
}

export default function RelojTiempoReal() {
  const [ahora, setAhora] = useState(new Date())

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(intervalo)
  }, [])

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-light tabular-nums tracking-tight"
        style={{
          fontSize: 'clamp(3.5rem, 13vw, 8.5rem)',
          lineHeight: 1.1,
          color: 'var(--kiosco-texto, #f8fafc)',
        }}
      >
        {formatearHora(ahora)}
      </span>
      <span
        className="tracking-wide"
        style={{
          fontSize: 'clamp(1rem, 3vw, 1.5rem)',
          color: 'var(--kiosco-texto-mut, #94a3b8)',
        }}
      >
        {formatearFecha(ahora)}
      </span>
    </div>
  )
}

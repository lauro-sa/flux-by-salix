/**
 * Reloj digital con segundos, actualización cada segundo.
 * Muestra hora + fecha en español.
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
        className="text-6xl font-light tabular-nums tracking-tight"
        style={{ color: 'var(--texto-primario)' }}
      >
        {formatearHora(ahora)}
      </span>
      <span
        className="text-lg"
        style={{ color: 'var(--texto-secundario)' }}
      >
        {formatearFecha(ahora)}
      </span>
    </div>
  )
}

/**
 * Reloj digital en tiempo real con fecha.
 * Tipografía monoespaciada font-black para evitar saltos (como el kiosco viejo).
 */
'use client'

import { useState, useEffect } from 'react'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function formatearHora(fecha: Date): string {
  const h = String(fecha.getHours()).padStart(2, '0')
  const m = String(fecha.getMinutes()).padStart(2, '0')
  const s = String(fecha.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatearFecha(fecha: Date): string {
  const dia = DIAS[fecha.getDay()]
  const num = fecha.getDate()
  const mes = MESES[fecha.getMonth()]
  const anio = fecha.getFullYear()
  return `${dia}, ${num} de ${mes} de ${anio}`
}

export default function RelojTiempoReal() {
  const [ahora, setAhora] = useState(new Date())

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(intervalo)
  }, [])

  return (
    <div className="text-center select-none pointer-events-none">
      <p
        className="font-mono font-black tracking-tight tabular-nums"
        style={{
          fontSize: 'clamp(3.5rem, 13vw, 8.5rem)',
          lineHeight: 1,
          color: '#f4f4f5',
        }}
      >
        {formatearHora(ahora)}
      </p>
      <p
        className="capitalize mt-3 md:mt-4"
        style={{
          fontSize: 'clamp(0.875rem, 2.2vw, 1.3rem)',
          color: '#94a3b8',
        }}
      >
        {formatearFecha(ahora)}
      </p>
    </div>
  )
}

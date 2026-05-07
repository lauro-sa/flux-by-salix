/**
 * Pantalla de confirmación post-fichaje — réplica del kiosco viejo.
 * Avatar con check/cake superpuesto, confeti CSS, barra progresiva, saludos con nombre.
 * Auto-dismiss: 4s normal / 8s cumpleaños o salida.
 */
'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  sonarEntrada,
  sonarCumpleanosEntrada,
  sonarCumpleanosSalida,
} from '@/lib/kiosco/sonidos'

import Image from 'next/image'

type TipoAccion = 'entrada' | 'salida' | 'en_almuerzo' | 'volver_almuerzo' | 'en_particular' | 'volver_particular'

interface PropsPantallaConfirmacion {
  nombre: string
  sector?: string | null
  fotoUrl?: string | null
  accion: TipoAccion
  esCumpleanos: boolean
  horasTrabajadas?: string | null
  jornadaCompleta?: boolean
  esTardanza?: boolean
  minutosRetraso?: number | null
  alDismiss: () => void
}

/** Colores decorativos del confeti — valores fijos (no semánticos) */
const COLORES_CONFETI = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#c77dff', '#ff9f43', '#ff85a1', '#00cec9',
]

function obtenerMensaje(
  nombre: string,
  accion: TipoAccion,
  esCumpleanos: boolean,
  horasTrabajadas?: string | null,
  jornadaCompleta?: boolean,
): string {
  const partes = nombre.trim().split(/\s+/)
  const corto = partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0]
  if (accion === 'entrada' && esCumpleanos) return `¡Feliz cumpleaños, ${corto}! 🎂 Que tengas un excelente día.`
  if (accion === 'salida' && esCumpleanos) return `¡A celebrar, ${corto}! 🎈 Disfrutá tu día.`
  if (accion === 'entrada') return `¡Buen turno, ${corto}!`
  if (accion === 'en_almuerzo') return `¡Buen provecho, ${corto}!`
  if (accion === 'volver_almuerzo') return `¡De vuelta al trabajo, ${corto}!`
  if (accion === 'en_particular') return `¡Hasta pronto, ${corto}!`
  if (accion === 'volver_particular') return `¡De vuelta, ${corto}!`
  if (accion === 'salida' && jornadaCompleta) return `¡Hasta luego, ${corto}! Jornada completa.`
  if (accion === 'salida' && horasTrabajadas) return `¡Hasta luego, ${corto}! Hoy trabajaste ${horasTrabajadas}.`
  return `¡Hasta luego, ${corto}!`
}

// Confeti CSS con custom properties — explosión (entrada) o lluvia (salida)
function ConfetiCSS({ tipo }: { tipo: 'entrada' | 'salida' }) {
  const piezas = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      if (tipo === 'entrada') {
        const angulo = (45 + Math.random() * 90) * Math.PI / 180
        const vel = 400 + Math.random() * 500
        return {
          left: '50%', top: '70%',
          cx: Math.round(Math.cos(angulo) * vel),
          cy: Math.round(-Math.sin(angulo) * vel),
          delay: `${Math.random() * 0.15}s`,
          dur: `${2.5 + Math.random()}s`,
          color: COLORES_CONFETI[i % COLORES_CONFETI.length],
          size: `${6 + Math.random() * 6}px`,
          redondo: i % 2 === 0,
          anim: 'confeti-explotar',
        }
      }
      return {
        left: `${Math.random() * 100}%`, top: '-50px',
        cx: Math.round((Math.random() - 0.5) * 300),
        cy: 600 + Math.random() * 400,
        delay: `${Math.random() * 2}s`,
        dur: `${3 + Math.random() * 2}s`,
        color: COLORES_CONFETI[i % COLORES_CONFETI.length],
        size: `${6 + Math.random() * 6}px`,
        redondo: i % 2 === 0,
        anim: 'confeti-lluvia',
      }
    })
  }, [tipo])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-20">
      {piezas.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.left, top: p.top,
            width: p.size, height: p.size,
            backgroundColor: p.color,
            borderRadius: p.redondo ? '50%' : '2px',
            '--cx': `${p.cx}px`,
            '--cy': `${p.cy}px`,
            animation: `${p.anim} ${p.dur} ${p.delay} ease-out forwards`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

export default function PantallaConfirmacion({
  nombre,
  sector,
  fotoUrl,
  accion,
  esCumpleanos,
  horasTrabajadas,
  jornadaCompleta,
  esTardanza,
  minutosRetraso,
  alDismiss,
}: PropsPantallaConfirmacion) {
  const [progreso, setProgreso] = useState(100)
  // Color de la barra: naranja si tardanza, amarillo cumpleaños, verde normal
  const colorBarra = esTardanza ? 'rgba(251,146,60,0.6)' : esCumpleanos ? 'rgba(234,179,8,0.6)' : 'rgba(74,222,128,0.6)'
  const colorAccento = esTardanza ? '#fb923c' : esCumpleanos ? '#facc15' : 'var(--kiosco-exito)'
  const duracion = esCumpleanos || accion === 'salida' ? 8000 : 4000

  // Sonido al montar
  useEffect(() => {
    if (esCumpleanos && accion === 'entrada') sonarCumpleanosEntrada()
    else if (esCumpleanos && accion === 'salida') sonarCumpleanosSalida()
    else sonarEntrada()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Barra de progreso + auto-dismiss
  useEffect(() => {
    const inicio = Date.now()
    const interval = setInterval(() => {
      const transcurrido = Date.now() - inicio
      const pct = Math.max(0, 100 - (transcurrido / duracion) * 100)
      setProgreso(pct)
      if (transcurrido >= duracion) {
        clearInterval(interval)
        alDismiss()
      }
    }, 50)
    return () => clearInterval(interval)
  }, [duracion, alDismiss])

  const mensaje = obtenerMensaje(nombre, accion, esCumpleanos, horasTrabajadas, jornadaCompleta)
  const iniciales = nombre.split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase()
  const tieneFoto = !!fotoUrl

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-6 md:gap-8 px-8 py-12 select-none"
      style={{ animation: 'kiosco-entrada 350ms cubic-bezier(0.16,1,0.3,1)' }}
    >
      {/* Confeti de cumpleaños */}
      {esCumpleanos && <ConfetiCSS tipo={accion === 'salida' ? 'salida' : 'entrada'} />}

      {/* Avatar con ícono check/cake superpuesto */}
      <div className="flex flex-col items-center gap-4 md:gap-5">
        {fotoUrl ? (
          <div
            className="relative w-48 md:w-64 aspect-[3/4] rounded-modal md:rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
            style={{
              border: '4px solid rgba(63,63,70,0.6)',
              animation: 'kiosco-check 500ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <Image src={fotoUrl} alt={nombre} fill sizes="(max-width: 768px) 192px, 256px" className="object-cover" draggable={false} />
          </div>
        ) : (
          <div
            className="flex items-center justify-center w-40 h-40 md:w-52 md:h-52 rounded-full"
            style={{
              backgroundColor: esCumpleanos ? 'rgba(234,179,8,0.15)' : 'rgba(74,222,128,0.15)',
              border: `4px solid ${esCumpleanos ? 'rgba(234,179,8,0.4)' : 'rgba(74,222,128,0.3)'}`,
              animation: 'kiosco-check 500ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <span
              className="text-7xl md:text-8xl"
              style={{ color: esCumpleanos ? '#facc15' : 'var(--kiosco-exito)' }}
            >
              {esCumpleanos ? '🎂' : '✓'}
            </span>
          </div>
        )}

        {/* Ícono superpuesto cuando hay foto */}
        {tieneFoto && (
          <div
            className="-mt-9 md:-mt-11 flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full shadow-lg z-10"
            style={{
              backgroundColor: esTardanza ? 'rgba(251,146,60,0.9)' : esCumpleanos ? 'rgba(234,179,8,0.9)' : 'rgba(74,222,128,0.9)',
            }}
          >
            <span className="text-white text-2xl md:text-3xl">
              {esCumpleanos ? '🎂' : '✓'}
            </span>
          </div>
        )}
      </div>

      {/* Mensaje + nombre */}
      <div className="text-center">
        <p
          className="font-black"
          style={{ fontSize: 'var(--kiosco-texto-titulo)', color: 'var(--kiosco-texto)' }}
        >
          {mensaje}
        </p>
        {sector && !esCumpleanos && (
          <p className="mt-1 md:mt-2" style={{ fontSize: 'var(--kiosco-texto-subtitulo)', color: 'var(--kiosco-texto-mut)' }}>
            {sector}
          </p>
        )}
        <p className="font-semibold mt-2 md:mt-3" style={{ fontSize: 'var(--kiosco-texto-subtitulo)', color: 'var(--kiosco-texto-sec)' }}>
          {nombre}
        </p>
        {/* Tardanza sutil */}
        {esTardanza && minutosRetraso && accion === 'entrada' && (
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--kiosco-advertencia)' }}>
            Llegaste {minutosRetraso}min tarde
          </p>
        )}
      </div>

      {/* Barra de progreso para auto-dismiss */}
      <div className="w-64 md:w-80 h-1 md:h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--kiosco-border)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${progreso}%`,
            backgroundColor: colorBarra,
            transition: 'none',
          }}
        />
      </div>
    </div>
  )
}

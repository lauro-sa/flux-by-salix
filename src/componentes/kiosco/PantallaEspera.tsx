/**
 * Pantalla idle del kiosco — logo empresa, reloj, instrucciones.
 * Replicado del kiosco viejo: layout centrado, botones discretos en fila.
 */
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Key, Wifi, Keyboard, Maximize } from 'lucide-react'
import RelojTiempoReal from './RelojTiempoReal'

interface PropsPantallaEspera {
  nombreEmpresa: string
  logoUrl?: string | null
  modoEmpresa: 'logo_y_nombre' | 'solo_logo' | 'solo_nombre'
  metodoLectura: 'rfid_hid' | 'nfc'
  nombreTerminal: string
  alAbrirPIN: () => void
  alToggleFullscreen: () => void
}

export default function PantallaEspera({
  nombreEmpresa,
  logoUrl,
  modoEmpresa,
  metodoLectura,
  alAbrirPIN,
  alToggleFullscreen,
}: PropsPantallaEspera) {
  const [esPantallaCompleta, setEsPantallaCompleta] = useState(false)

  useEffect(() => {
    const onChange = () => setEsPantallaCompleta(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    setEsPantallaCompleta(!!document.fullscreenElement)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const mostrarLogo = logoUrl && (modoEmpresa === 'logo_y_nombre' || modoEmpresa === 'solo_logo')
  const mostrarNombre = modoEmpresa === 'logo_y_nombre' || modoEmpresa === 'solo_nombre' || (modoEmpresa === 'solo_logo' && !logoUrl)

  return (
    <motion.div
      className="flex flex-col items-center justify-center flex-1 h-full gap-8 md:gap-10 px-8 py-12 select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo / Nombre empresa */}
      <div className="flex flex-col items-center gap-3 md:gap-4 min-h-[80px] justify-center">
        {mostrarLogo && (
          <img
            src={logoUrl}
            alt={nombreEmpresa}
            className="h-20 md:h-24 object-contain opacity-90"
            draggable={false}
          />
        )}
        {mostrarNombre && (
          <p
            className="text-2xl md:text-3xl font-semibold tracking-wider uppercase"
            style={{ color: '#a1a1aa' }}
          >
            {nombreEmpresa}
          </p>
        )}
      </div>

      {/* Reloj */}
      <RelojTiempoReal />

      {/* Instrucción */}
      <div className="flex flex-col items-center gap-3 mt-2">
        <div
          className="flex items-center gap-3 px-6 py-3 md:px-8 md:py-4 rounded-2xl md:rounded-3xl"
          style={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
        >
          <span style={{ color: '#a1a1aa' }}>
            {metodoLectura === 'nfc' ? <Wifi size={28} /> : <Key size={28} />}
          </span>
          <p
            className="font-medium"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: '#d4d4d8' }}
          >
            {metodoLectura === 'nfc'
              ? 'Acercá tu tarjeta NFC para fichar'
              : 'Pasá tu llavero por el lector para fichar'}
          </p>
        </div>

        {/* Indicador de actividad */}
        <div className="flex items-center gap-2 mt-1">
          <span
            className="size-2 rounded-full animate-pulse"
            style={{ backgroundColor: '#4ade80' }}
          />
          <span className="text-sm" style={{ color: '#52525b' }}>
            Terminal activa
          </span>
        </div>
      </div>

      {/* Botones discretos inferiores */}
      <div className="flex items-center gap-5 md:gap-8 mt-4">
        <button
          onClick={alAbrirPIN}
          className="flex items-center gap-1.5 md:gap-2.5 transition-colors text-sm md:text-lg font-medium"
          style={{ color: '#52525b' }}
        >
          <Keyboard size={18} />
          Ingresar con PIN
        </button>
        {!esPantallaCompleta && (
          <button
            onClick={alToggleFullscreen}
            className="flex items-center gap-1.5 md:gap-2.5 transition-colors text-sm md:text-lg font-medium"
            style={{ color: '#52525b' }}
          >
            <Maximize size={18} />
            Pantalla completa
          </button>
        )}
      </div>

      {/* Branding Flux discreto */}
      <div className="absolute bottom-3 md:bottom-5 left-0 right-0 flex items-center justify-center pointer-events-none">
        <p
          className="text-[11px] md:text-sm font-bold tracking-[0.25em] uppercase select-none"
          style={{ color: '#3f3f46' }}
        >
          Flux · by Salix
        </p>
      </div>
    </motion.div>
  )
}

/**
 * Pantalla idle del kiosco — logo empresa, reloj, instrucciones.
 * Diseño negro puro para OLED, tipografía fluida.
 */
'use client'

import { motion } from 'framer-motion'
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
  nombreTerminal,
  alAbrirPIN,
  alToggleFullscreen,
}: PropsPantallaEspera) {
  const mensajeInstruccion = metodoLectura === 'nfc'
    ? 'Acercá tu tarjeta NFC al lector'
    : 'Pasá tu llavero por el lector'

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-8 md:gap-10 px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo y nombre empresa */}
      <div className="flex flex-col items-center gap-4">
        {(modoEmpresa === 'logo_y_nombre' || modoEmpresa === 'solo_logo') && logoUrl && (
          <img
            src={logoUrl}
            alt={nombreEmpresa}
            className="h-20 md:h-24 w-auto object-contain"
          />
        )}
        {(modoEmpresa === 'logo_y_nombre' || modoEmpresa === 'solo_nombre') && (
          <h1
            className="font-semibold uppercase tracking-wider text-center"
            style={{
              fontSize: 'clamp(1.25rem, 4vw, 2.25rem)',
              color: 'var(--kiosco-texto, #f8fafc)',
            }}
          >
            {nombreEmpresa}
          </h1>
        )}
      </div>

      {/* Reloj */}
      <RelojTiempoReal />

      {/* Instrucción principal */}
      <div
        className="px-8 py-5 rounded-2xl text-center max-w-md"
        style={{
          backgroundColor: 'var(--kiosco-card, #18181b)',
          border: '1px solid var(--kiosco-border, #27272a)',
        }}
      >
        <p
          className="font-medium"
          style={{
            fontSize: 'clamp(1rem, 3vw, 1.35rem)',
            color: 'var(--kiosco-texto-sec, #e2e8f0)',
          }}
        >
          {mensajeInstruccion}
        </p>
      </div>

      {/* Footer: PIN + estado + fullscreen */}
      <div className="absolute bottom-6 md:bottom-8 left-6 md:left-8 right-6 md:right-8 flex items-center justify-between">
        <button
          onClick={alAbrirPIN}
          className="px-4 md:px-5 py-2.5 md:py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--kiosco-card, #18181b)',
            color: 'var(--kiosco-texto-mut, #94a3b8)',
            border: '1px solid var(--kiosco-border, #27272a)',
          }}
        >
          Ingresar con PIN
        </button>

        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: 'var(--kiosco-exito, #4ade80)',
              animation: 'kiosco-pulso 3s ease-in-out infinite',
            }}
          />
          <span
            className="text-sm"
            style={{ color: 'var(--kiosco-texto-dim, #64748b)' }}
          >
            {nombreTerminal}
          </span>
        </div>

        <button
          onClick={alToggleFullscreen}
          className="p-2.5 md:p-3 rounded-xl transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--kiosco-card, #18181b)',
            border: '1px solid var(--kiosco-border, #27272a)',
            color: 'var(--kiosco-texto-dim, #64748b)',
          }}
          title="Pantalla completa"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}

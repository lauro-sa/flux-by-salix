/**
 * Pantalla idle del kiosco — logo empresa, reloj, instrucciones.
 * Se muestra cuando no hay actividad.
 */
'use client'

import { motion } from 'framer-motion'
import RelojTiempoReal from './RelojTiempoReal'

interface PropsPantallaEspera {
  /** Nombre de la empresa */
  nombreEmpresa: string
  /** URL del logo de la empresa (opcional) */
  logoUrl?: string | null
  /** Modo de visualización de la empresa */
  modoEmpresa: 'logo_y_nombre' | 'solo_logo' | 'solo_nombre'
  /** Método de lectura configurado */
  metodoLectura: 'rfid_hid' | 'nfc'
  /** Nombre del terminal */
  nombreTerminal: string
  /** Callback para abrir teclado PIN */
  alAbrirPIN: () => void
  /** Callback para fullscreen */
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
      className="flex flex-col items-center justify-center h-full gap-10 px-8"
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
            className="h-20 w-auto object-contain"
          />
        )}
        {(modoEmpresa === 'logo_y_nombre' || modoEmpresa === 'solo_nombre') && (
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: 'var(--texto-primario)' }}
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
          backgroundColor: 'var(--superficie-tarjeta)',
          border: '1px solid var(--borde-sutil)',
        }}
      >
        <p
          className="text-xl font-medium"
          style={{ color: 'var(--texto-primario)' }}
        >
          {mensajeInstruccion}
        </p>
      </div>

      {/* Footer: PIN + estado + fullscreen */}
      <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between">
        <button
          onClick={alAbrirPIN}
          className="px-5 py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--superficie-tarjeta)',
            color: 'var(--texto-secundario)',
            border: '1px solid var(--borde-sutil)',
          }}
        >
          Ingresar con PIN
        </button>

        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: 'var(--insignia-exito)' }}
          />
          <span
            className="text-sm"
            style={{ color: 'var(--texto-terciario)' }}
          >
            {nombreTerminal}
          </span>
        </div>

        <button
          onClick={alToggleFullscreen}
          className="p-3 rounded-xl transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--superficie-tarjeta)',
            border: '1px solid var(--borde-sutil)',
            color: 'var(--texto-terciario)',
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

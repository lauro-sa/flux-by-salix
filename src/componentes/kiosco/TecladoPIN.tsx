/**
 * Teclado numérico en pantalla para ingreso de PIN.
 * Fallback cuando no hay lector RFID/NFC.
 * Diseño tablet-friendly con botones grandes.
 */
'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PropsTecladoPIN {
  /** Callback al completar el PIN */
  alEnviar: (pin: string) => void
  /** Callback para volver a pantalla de espera */
  alCancelar: () => void
  /** Largo del PIN (default 4) */
  largoPIN?: number
  /** Título del teclado */
  titulo?: string
}

export default function TecladoPIN({
  alEnviar,
  alCancelar,
  largoPIN = 4,
  titulo = 'Ingresá tu PIN',
}: PropsTecladoPIN) {
  const [pin, setPin] = useState('')

  const agregarDigito = useCallback((digito: string) => {
    setPin((prev) => {
      const nuevo = prev + digito
      if (nuevo.length === largoPIN) {
        // Enviar automáticamente al completar
        setTimeout(() => alEnviar(nuevo), 100)
        return nuevo
      }
      return nuevo.length <= largoPIN ? nuevo : prev
    })
  }, [largoPIN, alEnviar])

  const borrar = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
  }, [])

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar']

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-8 p-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <h2 className="text-2xl font-medium" style={{ color: 'var(--texto-primario)' }}>
        {titulo}
      </h2>

      {/* Indicador de dígitos */}
      <div className="flex gap-4">
        {Array.from({ length: largoPIN }).map((_, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full transition-all duration-150"
            style={{
              backgroundColor: i < pin.length
                ? 'var(--texto-marca)'
                : 'var(--borde-sutil)',
              transform: i < pin.length ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3 w-[280px]">
        {teclas.map((tecla, i) => {
          if (tecla === '') {
            return <div key={i} />
          }

          if (tecla === 'borrar') {
            return (
              <button
                key={i}
                onClick={borrar}
                disabled={pin.length === 0}
                className="h-16 rounded-2xl text-xl font-medium transition-all active:scale-95 disabled:opacity-30"
                style={{
                  backgroundColor: 'var(--superficie-tarjeta)',
                  color: 'var(--texto-secundario)',
                  border: '1px solid var(--borde-sutil)',
                }}
              >
                ←
              </button>
            )
          }

          return (
            <button
              key={i}
              onClick={() => agregarDigito(tecla)}
              disabled={pin.length >= largoPIN}
              className="h-16 rounded-2xl text-2xl font-medium transition-all active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--superficie-tarjeta)',
                color: 'var(--texto-primario)',
                border: '1px solid var(--borde-sutil)',
              }}
            >
              {tecla}
            </button>
          )
        })}
      </div>

      {/* Botón cancelar */}
      <button
        onClick={alCancelar}
        className="text-base transition-opacity hover:opacity-70"
        style={{ color: 'var(--texto-terciario)' }}
      >
        Cancelar
      </button>
    </motion.div>
  )
}

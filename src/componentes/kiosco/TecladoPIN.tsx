/**
 * Teclado numérico en pantalla para ingreso de PIN.
 * Replicado del kiosco viejo: NO auto-envía, tiene Cancelar y Aceptar.
 */
'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface PropsTecladoPIN {
  alEnviar: (pin: string) => void
  alCancelar: () => void
  largoPIN?: number
  titulo?: string
}

export default function TecladoPIN({
  alEnviar,
  alCancelar,
  largoPIN = 6,
  titulo = 'Ingresá tu PIN',
}: PropsTecladoPIN) {
  const [pin, setPin] = useState('')

  const agregarDigito = useCallback((digito: string) => {
    setPin((prev) => prev.length < largoPIN ? prev + digito : prev)
  }, [largoPIN])

  const borrar = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
  }, [])

  const enviar = useCallback(() => {
    if (pin.length >= largoPIN) {
      alEnviar(pin)
    }
  }, [pin, largoPIN, alEnviar])

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar']

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-8 p-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <h2
        className="font-medium"
        style={{ fontSize: 'var(--kiosco-texto-pin)', color: 'var(--kiosco-texto)' }}
      >
        {titulo}
      </h2>

      {/* Indicador de dígitos */}
      <div className="flex gap-4">
        {Array.from({ length: largoPIN }).map((_, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full transition-all duration-150"
            style={{
              backgroundColor: i < pin.length ? 'var(--texto-marca)' : 'var(--kiosco-border)',
              transform: i < pin.length ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3 w-[280px]">
        {teclas.map((tecla, i) => {
          if (tecla === '') return <div key={i} />

          if (tecla === 'borrar') {
            return (
              <button
                key={i}
                onClick={borrar}
                disabled={pin.length === 0}
                className="h-16 rounded-modal text-xl font-medium transition-all active:scale-95 disabled:opacity-30"
                style={{ backgroundColor: 'var(--kiosco-card)', color: 'var(--kiosco-texto-mut)', border: '1px solid var(--kiosco-border)' }}
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
              className="h-16 rounded-modal text-2xl font-medium transition-all active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--kiosco-card)', color: 'var(--kiosco-texto)', border: '1px solid var(--kiosco-border)' }}
            >
              {tecla}
            </button>
          )
        })}
      </div>

      {/* Botones Cancelar y Aceptar */}
      <div className="flex gap-4 w-[280px]">
        <button
          onClick={alCancelar}
          className="flex-1 py-3.5 rounded-card text-base font-medium transition-all active:scale-95"
          style={{ backgroundColor: 'var(--kiosco-card)', color: 'var(--kiosco-texto-mut)', border: '1px solid var(--kiosco-border)' }}
        >
          Cancelar
        </button>
        <button
          onClick={enviar}
          disabled={pin.length < largoPIN}
          className="flex-1 py-3.5 rounded-card text-base font-medium transition-all active:scale-95 disabled:opacity-30"
          style={{ backgroundColor: 'var(--texto-marca)', color: '#fff' }}
        >
          Aceptar
        </button>
      </div>
    </motion.div>
  )
}

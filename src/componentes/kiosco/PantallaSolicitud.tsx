/**
 * Formulario para reportar asistencia (reclamo) desde el kiosco.
 * Selector de fecha (últimos 30 días), hora entrada/salida, motivo.
 */
'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface PropsPantallaSolicitud {
  /** Nombre del empleado */
  nombre: string
  /** Callback al enviar solicitud */
  alEnviar: (datos: DatosSolicitud) => void
  /** Callback para volver a acciones */
  alCancelar: () => void
}

export interface DatosSolicitud {
  fecha: string      // YYYY-MM-DD
  horaEntrada: string // HH:mm
  horaSalida: string  // HH:mm
  motivo: string
}

function generarUltimos30Dias(): { valor: string; etiqueta: string }[] {
  const dias: { valor: string; etiqueta: string }[] = []
  const hoy = new Date()

  for (let i = 1; i <= 30; i++) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() - i)
    const valor = fecha.toISOString().split('T')[0]
    const etiqueta = fecha.toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    dias.push({ valor, etiqueta })
  }

  return dias
}

export default function PantallaSolicitud({
  nombre,
  alEnviar,
  alCancelar,
}: PropsPantallaSolicitud) {
  const [fecha, setFecha] = useState('')
  const [horaEntrada, setHoraEntrada] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [motivo, setMotivo] = useState('')

  const diasDisponibles = generarUltimos30Dias()

  const esValido = fecha && horaEntrada && horaSalida && motivo.trim().length >= 5

  const manejarEnvio = useCallback(() => {
    if (!esValido) return
    alEnviar({ fecha, horaEntrada, horaSalida, motivo: motivo.trim() })
  }, [esValido, fecha, horaEntrada, horaSalida, motivo, alEnviar])

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-6 px-8 py-12"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
    >
      <h2
        className="text-2xl font-semibold"
        style={{ color: 'var(--texto-primario)' }}
      >
        Reportar asistencia
      </h2>
      <p
        className="text-base"
        style={{ color: 'var(--texto-secundario)' }}
      >
        {nombre}, seleccioná el día que no pudiste fichar
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        {/* Selector de fecha */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: 'var(--texto-secundario)' }}
          >
            Fecha
          </label>
          <select
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-base appearance-none"
            style={{
              backgroundColor: 'var(--superficie-tarjeta)',
              color: 'var(--texto-primario)',
              border: '1px solid var(--borde-sutil)',
            }}
          >
            <option value="">Seleccionar día...</option>
            {diasDisponibles.map((dia) => (
              <option key={dia.valor} value={dia.valor}>
                {dia.etiqueta}
              </option>
            ))}
          </select>
        </div>

        {/* Horas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--texto-secundario)' }}
            >
              Hora entrada
            </label>
            <input
              type="time"
              value={horaEntrada}
              onChange={(e) => setHoraEntrada(e.target.value)}
              className="px-4 py-3 rounded-xl text-base"
              style={{
                backgroundColor: 'var(--superficie-tarjeta)',
                color: 'var(--texto-primario)',
                border: '1px solid var(--borde-sutil)',
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--texto-secundario)' }}
            >
              Hora salida
            </label>
            <input
              type="time"
              value={horaSalida}
              onChange={(e) => setHoraSalida(e.target.value)}
              className="px-4 py-3 rounded-xl text-base"
              style={{
                backgroundColor: 'var(--superficie-tarjeta)',
                color: 'var(--texto-primario)',
                border: '1px solid var(--borde-sutil)',
              }}
            />
          </div>
        </div>

        {/* Motivo */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: 'var(--texto-secundario)' }}
          >
            Motivo
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explicá por qué no pudiste fichar..."
            rows={3}
            className="px-4 py-3 rounded-xl text-base resize-none"
            style={{
              backgroundColor: 'var(--superficie-tarjeta)',
              color: 'var(--texto-primario)',
              border: '1px solid var(--borde-sutil)',
            }}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={alCancelar}
            className="flex-1 py-3.5 rounded-xl text-base font-medium transition-all active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--superficie-tarjeta)',
              color: 'var(--texto-secundario)',
              border: '1px solid var(--borde-sutil)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={manejarEnvio}
            disabled={!esValido}
            className="flex-1 py-3.5 rounded-xl text-base font-medium transition-all active:scale-[0.98] disabled:opacity-40"
            style={{
              backgroundColor: 'var(--texto-marca)',
              color: '#fff',
            }}
          >
            Enviar
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Formulario para reportar asistencia (reclamo) desde el kiosco.
 * Usa componentes de Flux: SelectorFecha, SelectorHora, TextArea.
 * Muestra solicitudes anteriores con estado (aprobada/rechazada/pendiente).
 * Permite apelar solicitudes rechazadas.
 */
'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { FileText, Gavel, Send, CheckCircle, XCircle, Clock, Info } from 'lucide-react'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { Boton } from '@/componentes/ui/Boton'

interface PropsPantallaSolicitud {
  nombre: string
  solicitudes?: SolicitudResumen[]
  alEnviar: (datos: DatosSolicitud) => void
  alCancelar: () => void
  cargando?: boolean
}

interface SolicitudResumen {
  id: string
  fecha: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  notasResolucion?: string | null
  solicitudOriginalId?: string | null
}

export interface DatosSolicitud {
  fecha: string
  horaEntrada: string
  horaSalida: string
  motivo: string
  solicitudOriginalId?: string | null
}

export default function PantallaSolicitud({
  nombre,
  solicitudes = [],
  alEnviar,
  alCancelar,
  cargando = false,
}: PropsPantallaSolicitud) {
  const [fecha, setFecha] = useState<string | null>(null)
  const [horaEntrada, setHoraEntrada] = useState<string | null>(null)
  const [horaSalida, setHoraSalida] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [apelandoId, setApelandoId] = useState<string | null>(null)

  const esValido = fecha && motivo.trim().length >= 5 && !cargando

  const manejarEnvio = useCallback(() => {
    if (!esValido || !fecha) return
    alEnviar({
      fecha,
      horaEntrada: horaEntrada || '',
      horaSalida: horaSalida || '',
      motivo: motivo.trim(),
      solicitudOriginalId: apelandoId,
    })
  }, [esValido, fecha, horaEntrada, horaSalida, motivo, apelandoId, alEnviar])

  const apelar = (sol: SolicitudResumen) => {
    setFecha(sol.fecha)
    setMotivo('')
    setApelandoId(sol.id)
  }

  // IDs de solicitudes que ya tienen apelación pendiente
  const idsYaApelados = new Set(
    solicitudes
      .filter(s => s.solicitudOriginalId && s.estado === 'pendiente')
      .map(s => s.solicitudOriginalId)
  )

  return (
    <motion.div
      className="flex flex-col items-center justify-start h-full gap-5 px-6 py-6 select-none overflow-y-auto"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-2">
          {apelandoId
            ? <Gavel size={40} style={{ color: '#fbbf24' }} />
            : <FileText size={40} style={{ color: '#fbbf24' }} />
          }
        </div>
        <p className="text-xl md:text-2xl font-bold" style={{ color: '#f4f4f5' }}>
          {apelandoId ? 'Apelar solicitud' : 'Reportar asistencia'}
        </p>
        <p className="text-sm md:text-base mt-1" style={{ color: '#a1a1aa' }}>
          {nombre}
        </p>
      </div>

      {/* Solicitudes anteriores */}
      {solicitudes.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-lg">
          {solicitudes.map((sol) => {
            const fechaFmt = sol.fecha ? sol.fecha.split('-').reverse().join('/') : '—'
            const puedeApelar = sol.estado === 'rechazada' && !sol.solicitudOriginalId && !idsYaApelados.has(sol.id)

            return (
              <div
                key={sol.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs md:text-sm font-medium"
                style={{
                  backgroundColor: sol.estado === 'aprobada' ? 'rgba(74,222,128,0.1)' : sol.estado === 'rechazada' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)',
                  border: `1px solid ${sol.estado === 'aprobada' ? 'rgba(74,222,128,0.2)' : sol.estado === 'rechazada' ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)'}`,
                  color: sol.estado === 'aprobada' ? '#86efac' : sol.estado === 'rechazada' ? '#fca5a5' : '#fcd34d',
                }}
              >
                {sol.estado === 'aprobada' ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : sol.estado === 'rechazada' ? <XCircle size={16} className="mt-0.5 shrink-0" /> : <Clock size={16} className="mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <p className="font-semibold">
                    Solicitud del {fechaFmt} — {sol.estado === 'aprobada' ? 'Aprobada' : sol.estado === 'rechazada' ? 'Rechazada' : 'En revisión'}
                  </p>
                  {sol.estado === 'rechazada' && sol.notasResolucion && (
                    <p className="opacity-80 mt-0.5">Motivo: {sol.notasResolucion}</p>
                  )}
                  {sol.estado === 'pendiente' && (
                    <p className="opacity-70 mt-0.5">Será evaluada por un supervisor</p>
                  )}
                </div>
                {puedeApelar && (
                  <button
                    onClick={() => apelar(sol)}
                    className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
                    style={{ backgroundColor: 'rgba(248,113,113,0.2)', color: '#fecaca' }}
                  >
                    Apelar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Formulario */}
      <div className="flex flex-col gap-4 w-full max-w-lg">
        {/* Fecha */}
        <SelectorFecha
          etiqueta="Fecha"
          valor={fecha}
          onChange={setFecha}
          placeholder="Seleccionar día..."
        />

        {/* Horas */}
        <div className="grid grid-cols-2 gap-3">
          <SelectorHora
            etiqueta="Hora entrada"
            valor={horaEntrada}
            onChange={setHoraEntrada}
            placeholder="Opcional"
          />
          <SelectorHora
            etiqueta="Hora salida"
            valor={horaSalida}
            onChange={setHoraSalida}
            placeholder="Opcional"
          />
        </div>

        {/* Motivo */}
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: '#a1a1aa' }}>
            Motivo <span style={{ color: '#52525b' }}>(obligatorio)</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={apelandoId ? 'Explicá por qué debería reconsiderarse...' : 'Explicá por qué no pudiste fichar...'}
            rows={3}
            maxLength={300}
            className="w-full rounded-xl text-sm md:text-base p-3 resize-none outline-none"
            style={{
              backgroundColor: '#18181b',
              color: '#f4f4f5',
              border: '1px solid #27272a',
            }}
          />
          <p className="text-xs text-right mt-0.5" style={{ color: '#52525b' }}>{motivo.length}/300</p>
        </div>

        {/* Aviso */}
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs md:text-sm"
          style={{
            backgroundColor: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.2)',
            color: 'rgba(252,211,77,0.8)',
          }}
        >
          <Info size={16} className="mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            Esta solicitud será evaluada por un supervisor. Recibirás una notificación cuando sea aprobada o rechazada.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <Boton
            onClick={alCancelar}
            variante="secundario"
            disabled={cargando}
            className="flex-1"
          >
            Cancelar
          </Boton>
          <Boton
            onClick={manejarEnvio}
            variante="primario"
            disabled={!esValido}
            cargando={cargando}
            icono={<Send size={16} />}
            className="flex-1"
          >
            {apelandoId ? 'Enviar apelación' : 'Enviar solicitud'}
          </Boton>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Formulario para reportar asistencia (reclamo) desde el kiosco.
 * Selectores custom: pills fecha + hora escribible/seleccionable.
 */
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Gavel, Send, CheckCircle, XCircle, Clock, Info, Calendar, X } from 'lucide-react'

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

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function generarUltimos7Dias(): { valor: string; etiqueta: string; completa: string }[] {
  const hoy = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - i)
    const valor = d.toISOString().split('T')[0]
    const etiqueta = i === 0 ? 'Hoy' : i === 1 ? 'Ayer' : DIAS_SEMANA[d.getDay()]
    const completa = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    return { valor, etiqueta, completa }
  })
}

// ─── Input de hora escribible + dropdown ───
// Escribís "1420" → se autoformatea a "14:20"
// O tocás el botón reloj → dropdown con columnas hora/minuto
function InputHoraKiosco({ valor, onChange, etiqueta }: {
  valor: string | null
  onChange: (v: string | null) => void
  etiqueta: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [textoInput, setTextoInput] = useState(valor || '')
  const ref = useRef<HTMLDivElement>(null)
  const refHoras = useRef<HTMLDivElement>(null)
  const refMinutos = useRef<HTMLDivElement>(null)

  const partes = valor ? valor.split(':').map(Number) : [null, null]
  const horaActual = partes[0]
  const minActual = partes[1]
  const minutos = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  // Sync input text cuando cambia valor externo
  useEffect(() => { setTextoInput(valor || '') }, [valor])

  // Cerrar dropdown al tocar fuera
  useEffect(() => {
    if (!abierto) return
    function cerrar(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('pointerdown', cerrar)
    return () => document.removeEventListener('pointerdown', cerrar)
  }, [abierto])

  // Auto-scroll al abrir
  useEffect(() => {
    if (!abierto) return
    setTimeout(() => {
      if (horaActual !== null && refHoras.current) {
        const el = refHoras.current.children[horaActual] as HTMLElement
        el?.scrollIntoView({ block: 'center', behavior: 'instant' })
      }
      if (minActual !== null && refMinutos.current) {
        const idx = minutos.indexOf(minActual)
        const el = refMinutos.current.children[idx >= 0 ? idx : 0] as HTMLElement
        el?.scrollIntoView({ block: 'center', behavior: 'instant' })
      }
    }, 50)
  }, [abierto, horaActual, minActual])

  function seleccionar(h: number, m: number) {
    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    onChange(v)
    setAbierto(false)
  }

  // Autoformatear al salir del input: "1420" → "14:20", "9" → "09:00"
  function formatearYGuardar() {
    const limpio = textoInput.replace(/[^0-9]/g, '')
    if (!limpio) { onChange(null); return }

    let h = 0, m = 0
    if (limpio.length <= 2) {
      h = Math.min(23, parseInt(limpio))
      m = 0
    } else {
      h = Math.min(23, parseInt(limpio.slice(0, -2) || '0'))
      m = Math.min(59, parseInt(limpio.slice(-2)))
    }
    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    onChange(v)
    setTextoInput(v)
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--kiosco-texto-mut)' }}>
        {etiqueta}
      </label>
      <div className="flex gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={textoInput}
          onChange={(e) => setTextoInput(e.target.value)}
          onBlur={formatearYGuardar}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); formatearYGuardar(); (e.target as HTMLInputElement).blur() } }}
          placeholder="HH:MM"
          className="flex-1 h-11 rounded-xl border text-sm font-mono text-center outline-none"
          style={{ backgroundColor: 'var(--kiosco-card)', color: 'var(--kiosco-texto)', borderColor: 'var(--kiosco-border)' }}
        />
        <button
          type="button"
          onClick={() => setAbierto(v => !v)}
          className="h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 transition-all"
          style={{
            backgroundColor: abierto ? 'var(--borde-fuerte)' : 'var(--kiosco-card)',
            borderColor: abierto ? 'var(--texto-marca)' : 'var(--kiosco-border)',
            color: 'var(--kiosco-texto-mut)',
          }}
        >
          <Clock size={16} />
        </button>
      </div>

      {abierto && (
        <div
          className="absolute z-50 top-full mt-2 left-0 right-0 rounded-xl shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--kiosco-card-hover)', border: '1px solid var(--borde-fuerte)', animation: 'kiosco-entrada 200ms cubic-bezier(0.16,1,0.3,1)' }}
        >
          <div className="flex">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-center py-2" style={{ color: 'var(--kiosco-texto-dim)' }}>Hora</p>
              <div ref={refHoras} className="max-h-40 overflow-y-auto overscroll-contain">
                {Array.from({ length: 24 }, (_, i) => (
                  <button key={i} onClick={() => seleccionar(i, minActual ?? 0)}
                    className="w-full py-2 text-sm text-center transition-colors"
                    style={{ color: i === horaActual ? 'var(--texto-marca)' : 'var(--kiosco-texto-sec)', fontWeight: i === horaActual ? 700 : 400, backgroundColor: i === horaActual ? 'rgba(123,123,216,0.15)' : 'transparent' }}
                  >{String(i).padStart(2, '0')}</button>
                ))}
              </div>
            </div>
            <div style={{ width: 1, backgroundColor: 'var(--borde-fuerte)' }} />
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-center py-2" style={{ color: 'var(--kiosco-texto-dim)' }}>Min</p>
              <div ref={refMinutos} className="max-h-40 overflow-y-auto overscroll-contain">
                {minutos.map(m => (
                  <button key={m} onClick={() => seleccionar(horaActual ?? 0, m)}
                    className="w-full py-2 text-sm text-center transition-colors"
                    style={{ color: m === minActual ? 'var(--texto-marca)' : 'var(--kiosco-texto-sec)', fontWeight: m === minActual ? 700 : 400, backgroundColor: m === minActual ? 'rgba(123,123,216,0.15)' : 'transparent' }}
                  >{String(m).padStart(2, '0')}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Input de fecha escribible + pills ───
// Escribís "0704" → se autoformatea a "07/04/2026" → valor "2026-04-07"
// O tocás las pills para selección rápida
function InputFechaKiosco({ valor, onChange }: {
  valor: string | null
  onChange: (v: string | null) => void
}) {
  const [textoInput, setTextoInput] = useState('')
  const diasDisponibles = generarUltimos7Dias()
  const fechaSeleccionada = diasDisponibles.find(d => d.valor === valor)

  // Sync display cuando cambia valor externo
  useEffect(() => {
    if (valor) {
      const [y, m, d] = valor.split('-')
      setTextoInput(`${d}/${m}/${y}`)
    } else {
      setTextoInput('')
    }
  }, [valor])

  // Autoformatear: "0704" → "07/04/2026", "7" → "07/MM/YYYY"
  function formatearYGuardar() {
    const limpio = textoInput.replace(/[^0-9]/g, '')
    if (!limpio) { onChange(null); return }

    const anio = new Date().getFullYear()
    let dia = 1, mes = 1

    if (limpio.length <= 2) {
      dia = Math.min(31, Math.max(1, parseInt(limpio)))
      mes = new Date().getMonth() + 1
    } else if (limpio.length <= 4) {
      dia = Math.min(31, Math.max(1, parseInt(limpio.slice(0, 2))))
      mes = Math.min(12, Math.max(1, parseInt(limpio.slice(2))))
    } else {
      dia = Math.min(31, Math.max(1, parseInt(limpio.slice(0, 2))))
      mes = Math.min(12, Math.max(1, parseInt(limpio.slice(2, 4))))
    }

    const v = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    onChange(v)
  }

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--kiosco-texto-mut)' }}>Fecha</label>

      {/* Input escribible */}
      <input
        type="text"
        inputMode="numeric"
        value={textoInput}
        onChange={(e) => setTextoInput(e.target.value)}
        onBlur={formatearYGuardar}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); formatearYGuardar(); (e.target as HTMLInputElement).blur() } }}
        placeholder="DD/MM (ej: 0704)"
        className="w-full h-11 rounded-xl border text-sm px-4 outline-none mb-2"
        style={{ backgroundColor: 'var(--kiosco-card)', color: 'var(--kiosco-texto)', borderColor: 'var(--kiosco-border)' }}
      />

      {/* Pills rápidas */}
      <div className="flex flex-wrap gap-1.5">
        {diasDisponibles.map(d => (
          <button
            key={d.valor}
            onClick={() => onChange(d.valor)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize active:scale-95"
            style={{
              backgroundColor: valor === d.valor ? 'var(--texto-marca)' : 'var(--kiosco-card)',
              color: valor === d.valor ? '#fff' : 'var(--kiosco-texto-sec)',
              border: `1px solid ${valor === d.valor ? 'var(--texto-marca)' : 'var(--kiosco-border)'}`,
            }}
          >
            {d.etiqueta}
          </button>
        ))}
      </div>

      {fechaSeleccionada && (
        <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--kiosco-texto-mut)' }}>
          <Calendar size={12} /> {fechaSeleccionada.completa}
        </p>
      )}
    </div>
  )
}

// ─── Pantalla principal ─────────────────────────────────────
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

  const idsYaApelados = new Set(
    solicitudes.filter(s => s.solicitudOriginalId && s.estado === 'pendiente').map(s => s.solicitudOriginalId)
  )

  return (
    <motion.div
      className="flex flex-col items-center justify-start h-full gap-4 px-6 py-5 select-none overflow-y-auto"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="text-center">
        {apelandoId ? <Gavel size={36} style={{ color: 'var(--kiosco-advertencia)' }} /> : <FileText size={36} style={{ color: 'var(--kiosco-advertencia)' }} />}
        <p className="text-lg md:text-xl font-bold mt-1" style={{ color: 'var(--kiosco-texto)' }}>
          {apelandoId ? 'Apelar solicitud' : 'Reportar asistencia'}
        </p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--kiosco-texto-mut)' }}>{nombre}</p>
      </div>

      {/* Solicitudes anteriores */}
      {solicitudes.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-lg">
          {solicitudes.map((sol) => {
            const fechaFmt = sol.fecha ? sol.fecha.split('-').reverse().join('/') : '—'
            const puedeApelar = sol.estado === 'rechazada' && !sol.solicitudOriginalId && !idsYaApelados.has(sol.id)
            return (
              <div key={sol.id} className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: sol.estado === 'aprobada' ? 'rgba(74,222,128,0.1)' : sol.estado === 'rechazada' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)',
                  border: `1px solid ${sol.estado === 'aprobada' ? 'rgba(74,222,128,0.2)' : sol.estado === 'rechazada' ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)'}`,
                  color: sol.estado === 'aprobada' ? 'var(--kiosco-accion-entrada)' : sol.estado === 'rechazada' ? 'var(--kiosco-accion-cancelar)' : 'var(--kiosco-accion-salida)',
                }}
              >
                {sol.estado === 'aprobada' ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : sol.estado === 'rechazada' ? <XCircle size={14} className="mt-0.5 shrink-0" /> : <Clock size={14} className="mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <p className="font-semibold">{fechaFmt} — {sol.estado === 'aprobada' ? 'Aprobada' : sol.estado === 'rechazada' ? 'Rechazada' : 'En revisión'}</p>
                  {sol.estado === 'rechazada' && sol.notasResolucion && <p className="opacity-80 mt-0.5">{sol.notasResolucion}</p>}
                </div>
                {puedeApelar && (
                  <button onClick={() => apelar(sol)} className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: 'rgba(248,113,113,0.2)', color: 'var(--kiosco-accion-cancelar)' }}>
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
        {/* Fecha — input escribible + pills */}
        <InputFechaKiosco valor={fecha} onChange={setFecha} />

        {/* Horas — input escribible + dropdown */}
        <div className="grid grid-cols-2 gap-3">
          <InputHoraKiosco etiqueta="Hora entrada" valor={horaEntrada} onChange={setHoraEntrada} />
          <InputHoraKiosco etiqueta="Hora salida" valor={horaSalida} onChange={setHoraSalida} />
        </div>

        {/* Motivo */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--kiosco-texto-mut)' }}>
            Motivo <span style={{ color: 'var(--kiosco-texto-dim)' }}>(obligatorio)</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={apelandoId ? 'Explicá por qué debería reconsiderarse...' : 'Explicá por qué no pudiste fichar...'}
            rows={2}
            maxLength={300}
            className="w-full rounded-xl text-sm p-3 resize-none outline-none"
            style={{ backgroundColor: 'var(--kiosco-card)', color: 'var(--kiosco-texto)', border: '1px solid var(--kiosco-border)' }}
          />
          <p className="text-[10px] text-right mt-0.5" style={{ color: 'var(--kiosco-texto-dim)' }}>{motivo.length}/300</p>
        </div>

        {/* Aviso */}
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', color: 'rgba(252,211,77,0.7)' }}
        >
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>Será evaluada por un supervisor.</p>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button onClick={alCancelar} disabled={cargando}
            className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: 'var(--kiosco-card)', color: 'var(--kiosco-texto-sec)', border: '1px solid var(--kiosco-border)' }}
          >
            Cancelar
          </button>
          <button onClick={manejarEnvio} disabled={!esValido}
            className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--texto-marca)', color: '#fff' }}
          >
            {cargando
              ? <span className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><Send size={14} /> {apelandoId ? 'Apelar' : 'Enviar'}</>
            }
          </button>
        </div>
      </div>
    </motion.div>
  )
}

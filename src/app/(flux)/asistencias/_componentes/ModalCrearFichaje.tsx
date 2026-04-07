'use client'

import { useState, useEffect, useCallback } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Select } from '@/componentes/ui/Select'
import { TextArea } from '@/componentes/ui/TextArea'
import { Boton } from '@/componentes/ui/Boton'
import { AlertTriangle, Plus } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

// ─── Tipos ───────────────────────────────────────────────────

interface Miembro {
  id: string
  nombre: string
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  onCreado: () => void
  /** Si viene pre-seteado desde la matriz (celda vacía) */
  miembroId?: string | null
  miembroNombre?: string | null
  fecha?: string | null
}

// ─── Componente ──────────────────────────────────────────────

export function ModalCrearFichaje({ abierto, onCerrar, onCreado, miembroId, miembroNombre, fecha: fechaProp }: PropiedadesModal) {
  const { formatoHora } = useFormato()
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [miembroSeleccionado, setMiembroSeleccionado] = useState('')
  const [fecha, setFecha] = useState('')
  const [entrada, setEntrada] = useState('')
  const [salida, setSalida] = useState('')
  const [estado, setEstado] = useState('cerrado')
  const [tipo, setTipo] = useState('normal')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Cargar miembros
  useEffect(() => {
    if (!abierto) return
    fetch('/api/asistencias/matriz?desde=2026-01-01&hasta=2026-01-01')
      .then(r => r.json())
      .then(data => setMiembros(data.miembros || []))
      .catch(() => {})
  }, [abierto])

  // Pre-setear datos cuando viene de la matriz
  useEffect(() => {
    if (abierto) {
      setMiembroSeleccionado(miembroId || '')
      setFecha(fechaProp || '')
      setEntrada('')
      setSalida('')
      setEstado('cerrado')
      setTipo('normal')
      setNotas('')
      setError('')
    }
  }, [abierto, miembroId, fechaProp])

  const crear = useCallback(async () => {
    if (!miembroSeleccionado) { setError('Seleccioná un empleado'); return }
    if (!fecha) { setError('Seleccioná una fecha'); return }
    if (!entrada) { setError('Ingresá hora de entrada'); return }

    setError('')
    setGuardando(true)

    try {
      // Construir timestamps
      const horaEntrada = `${fecha}T${entrada}:00`
      const horaSalida = salida ? `${fecha}T${salida}:00` : null

      const res = await fetch('/api/asistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: miembroSeleccionado,
          fecha,
          hora_entrada: new Date(horaEntrada).toISOString(),
          hora_salida: horaSalida ? new Date(horaSalida).toISOString() : null,
          estado: salida ? estado : 'activo',
          tipo,
          notas: notas || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.error?.includes('duplicate') || data.error?.includes('unique') || data.error?.includes('already')) {
          setError('Ya existe un fichaje para este empleado en esta fecha. Editá el existente.')
        } else {
          setError(data.error || 'Error al crear')
        }
        return
      }

      onCreado()
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }, [miembroSeleccionado, fecha, entrada, salida, estado, tipo, notas, onCreado, onCerrar])

  const nombreMiembro = miembroNombre || miembros.find(m => m.id === miembroSeleccionado)?.nombre || ''

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Agregar fichaje"
      tamano="md"
      acciones={
        <div className="flex items-center justify-end w-full gap-2">
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" tamano="sm" onClick={crear} cargando={guardando}>
            <Plus size={13} className="mr-1" /> Crear fichaje
          </Boton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Empleado */}
        {miembroId ? (
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">Empleado</label>
            <p className="text-sm font-medium text-texto-primario">{nombreMiembro}</p>
          </div>
        ) : (
          <Select
            etiqueta="Empleado"
            opciones={miembros.map(m => ({ valor: m.id, etiqueta: m.nombre }))}
            valor={miembroSeleccionado}
            onChange={setMiembroSeleccionado}
            placeholder="Seleccionar empleado..."
          />
        )}

        {/* Fecha */}
        {fechaProp ? (
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">Fecha</label>
            <p className="text-sm text-texto-primario">
              {new Date(fechaProp + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-superficie-elevada/40 border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario focus:border-texto-marca focus:outline-none transition-colors"
            />
          </div>
        )}

        {/* Horarios */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">Entrada</label>
            <input
              type="time"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              className="w-full bg-superficie-elevada/40 border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario focus:border-texto-marca focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">Salida</label>
            <input
              type="time"
              value={salida}
              onChange={(e) => setSalida(e.target.value)}
              className="w-full bg-superficie-elevada/40 border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario focus:border-texto-marca focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Estado y tipo */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            etiqueta="Estado"
            opciones={[
              { valor: 'cerrado', etiqueta: 'Cerrado' },
              { valor: 'activo', etiqueta: 'En turno' },
              { valor: 'ausente', etiqueta: 'Ausente' },
            ]}
            valor={estado}
            onChange={setEstado}
          />
          <Select
            etiqueta="Tipo"
            opciones={[
              { valor: 'normal', etiqueta: 'Normal' },
              { valor: 'tardanza', etiqueta: 'Tardanza' },
              { valor: 'flexible', etiqueta: 'Flexible' },
            ]}
            valor={tipo}
            onChange={setTipo}
          />
        </div>

        {/* Notas */}
        <TextArea
          etiqueta="Notas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Motivo del fichaje manual..."
          rows={2}
        />
      </div>
    </Modal>
  )
}

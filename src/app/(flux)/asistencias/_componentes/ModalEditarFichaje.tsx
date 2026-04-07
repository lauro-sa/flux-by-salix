'use client'

import { useState, useEffect } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { TextArea } from '@/componentes/ui/TextArea'
import { Boton } from '@/componentes/ui/Boton'

// ─── Tipos ───────────────────────────────────────────────────

interface RegistroEditable {
  id: string
  miembro_nombre: string
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  inicio_almuerzo: string | null
  fin_almuerzo: string | null
  salida_particular: string | null
  vuelta_particular: string | null
  estado: string
  tipo: string
  notas: string | null
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  registro: RegistroEditable | null
  onGuardado: () => void
}

// ─── Helpers ─────────────────────────────────────────────────

function aDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  // Formato: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function deDatetimeLocal(val: string): string | null {
  if (!val) return null
  return new Date(val).toISOString()
}

// ─── Componente ──────────────────────────────────────────────

export function ModalEditarFichaje({ abierto, onCerrar, registro, onGuardado }: PropiedadesModal) {
  const [entrada, setEntrada] = useState('')
  const [salida, setSalida] = useState('')
  const [inicioAlm, setInicioAlm] = useState('')
  const [finAlm, setFinAlm] = useState('')
  const [salidaPart, setSalidaPart] = useState('')
  const [vueltaPart, setVueltaPart] = useState('')
  const [estado, setEstado] = useState('cerrado')
  const [tipo, setTipo] = useState('normal')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Cargar datos del registro al abrir
  useEffect(() => {
    if (registro) {
      setEntrada(aDatetimeLocal(registro.hora_entrada))
      setSalida(aDatetimeLocal(registro.hora_salida))
      setInicioAlm(aDatetimeLocal(registro.inicio_almuerzo))
      setFinAlm(aDatetimeLocal(registro.fin_almuerzo))
      setSalidaPart(aDatetimeLocal(registro.salida_particular))
      setVueltaPart(aDatetimeLocal(registro.vuelta_particular))
      setEstado(registro.estado)
      setTipo(registro.tipo)
      setNotas(registro.notas || '')
    }
  }, [registro])

  const guardar = async () => {
    if (!registro) return
    setGuardando(true)
    try {
      const res = await fetch('/api/asistencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: registro.id,
          hora_entrada: deDatetimeLocal(entrada),
          hora_salida: deDatetimeLocal(salida),
          inicio_almuerzo: deDatetimeLocal(inicioAlm),
          fin_almuerzo: deDatetimeLocal(finAlm),
          salida_particular: deDatetimeLocal(salidaPart),
          vuelta_particular: deDatetimeLocal(vueltaPart),
          estado,
          tipo,
          notas: notas || null,
        }),
      })
      if (res.ok) {
        onGuardado()
        onCerrar()
      }
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!registro || !confirm('¿Eliminar este registro de asistencia?')) return
    setGuardando(true)
    try {
      const res = await fetch('/api/asistencias', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: registro.id }),
      })
      if (res.ok) {
        onGuardado()
        onCerrar()
      }
    } finally {
      setGuardando(false)
    }
  }

  if (!registro) return null

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Editar fichaje — ${registro.miembro_nombre}`}
      tamano="md"
      acciones={
        <div className="flex items-center justify-between w-full">
          <Boton variante="peligro" tamano="sm" onClick={eliminar} disabled={guardando}>
            Eliminar
          </Boton>
          <div className="flex items-center gap-2">
            <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
            <Boton variante="primario" tamano="sm" onClick={guardar} cargando={guardando}>Guardar</Boton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-texto-terciario">
          Fecha: {new Date(registro.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {/* Estado y tipo */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            etiqueta="Estado"
            opciones={[
              { valor: 'activo', etiqueta: 'En turno' },
              { valor: 'cerrado', etiqueta: 'Cerrado' },
              { valor: 'auto_cerrado', etiqueta: 'Sin salida' },
              { valor: 'ausente', etiqueta: 'Ausente' },
              { valor: 'almuerzo', etiqueta: 'En almuerzo' },
              { valor: 'particular', etiqueta: 'En trámite' },
            ]}
            valor={estado}
            onChange={setEstado}
          />
          <Select
            etiqueta="Tipo"
            opciones={[
              { valor: 'normal', etiqueta: 'Normal' },
              { valor: 'tardanza', etiqueta: 'Tardanza' },
              { valor: 'ausencia', etiqueta: 'Ausencia' },
              { valor: 'flexible', etiqueta: 'Flexible' },
            ]}
            valor={tipo}
            onChange={setTipo}
          />
        </div>

        {/* Timestamps principales */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1">Entrada</label>
            <input
              type="datetime-local"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              className="w-full bg-superficie-tarjeta border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1">Salida</label>
            <input
              type="datetime-local"
              value={salida}
              onChange={(e) => setSalida(e.target.value)}
              className="w-full bg-superficie-tarjeta border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario"
            />
          </div>
        </div>

        {/* Almuerzo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1">Inicio almuerzo</label>
            <input
              type="datetime-local"
              value={inicioAlm}
              onChange={(e) => setInicioAlm(e.target.value)}
              className="w-full bg-superficie-tarjeta border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1">Fin almuerzo</label>
            <input
              type="datetime-local"
              value={finAlm}
              onChange={(e) => setFinAlm(e.target.value)}
              className="w-full bg-superficie-tarjeta border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario"
            />
          </div>
        </div>

        {/* Trámite */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1">Salida trámite</label>
            <input
              type="datetime-local"
              value={salidaPart}
              onChange={(e) => setSalidaPart(e.target.value)}
              className="w-full bg-superficie-tarjeta border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1">Vuelta trámite</label>
            <input
              type="datetime-local"
              value={vueltaPart}
              onChange={(e) => setVueltaPart(e.target.value)}
              className="w-full bg-superficie-tarjeta border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario"
            />
          </div>
        </div>

        {/* Notas */}
        <TextArea
          etiqueta="Notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Motivo de la edición..."
          rows={2}
        />
      </div>
    </Modal>
  )
}

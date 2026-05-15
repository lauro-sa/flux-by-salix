'use client'

/**
 * ModalLicencia — Crear o editar una licencia de un contrato.
 *
 * Campos:
 *   - Tipo (lista cerrada; "Otro" requiere nota).
 *   - Fecha de inicio (obligatoria).
 *   - Fecha de fin (opcional → licencia abierta).
 *   - Goce de sueldo (toggle).
 *   - Notas (opcional, obligatorio si tipo = otro).
 *
 * El servidor enforza el constraint de NO-superposición entre
 * licencias del mismo contrato; si choca, mostramos el error tal cual.
 */

import { useState } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useToast } from '@/componentes/feedback/Toast'
import type { LicenciaContrato, TipoLicencia } from '@/tipos/nominas'

interface Props {
  contratoId: string
  /** Si presente: modo edición. Si null: modo creación. */
  editando: LicenciaContrato | null
  onCerrar: () => void
  onGuardado: () => void
}

const OPCIONES_TIPO: { valor: TipoLicencia; etiqueta: string }[] = [
  { valor: 'medica', etiqueta: 'Licencia médica' },
  { valor: 'maternidad', etiqueta: 'Maternidad' },
  { valor: 'paternidad', etiqueta: 'Paternidad' },
  { valor: 'estudio', etiqueta: 'Estudio' },
  { valor: 'examen', etiqueta: 'Examen' },
  { valor: 'duelo', etiqueta: 'Duelo' },
  { valor: 'matrimonio', etiqueta: 'Matrimonio' },
  { valor: 'mudanza', etiqueta: 'Mudanza' },
  { valor: 'vacaciones', etiqueta: 'Vacaciones' },
  { valor: 'suspension_disciplinaria', etiqueta: 'Suspensión disciplinaria' },
  { valor: 'suspension_economica', etiqueta: 'Suspensión económica' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export function ModalLicencia({ contratoId, editando, onCerrar, onGuardado }: Props) {
  const toast = useToast()

  const [tipo, setTipo] = useState<TipoLicencia>(editando?.tipo ?? 'medica')
  const [fechaInicio, setFechaInicio] = useState(editando?.fecha_inicio ?? '')
  const [fechaFin, setFechaFin] = useState<string | null>(editando?.fecha_fin ?? null)
  const [goceSueldo, setGoceSueldo] = useState(editando?.goce_sueldo ?? true)
  const [notas, setNotas] = useState(editando?.notas ?? '')
  const [guardando, setGuardando] = useState(false)

  const esOtro = tipo === 'otro'
  const fechasInvalidas = !!fechaFin && !!fechaInicio && fechaFin < fechaInicio
  const notaFaltante = esOtro && !notas.trim()
  const puedeGuardar = !!fechaInicio && !fechasInvalidas && !notaFaltante && !guardando

  const handleGuardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      const body = {
        tipo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || null,
        goce_sueldo: goceSueldo,
        notas: notas.trim() || null,
      }
      const res = editando
        ? await fetch(`/api/nominas/licencias/${editando.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/nominas/contratos/${contratoId}/licencias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.mostrar('error', data.error || 'No se pudo guardar la licencia')
        setGuardando(false)
        return
      }

      toast.mostrar('exito', editando ? 'Licencia actualizada' : 'Licencia creada')
      onGuardado()
    } catch (err) {
      console.error('[ModalLicencia] error:', err)
      toast.mostrar('error', 'Error de red')
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={() => { if (!guardando) onCerrar() }}
      titulo={editando ? 'Editar licencia' : 'Nueva licencia'}
      tamano="md"
      acciones={
        <div className="flex items-center justify-end gap-2 w-full">
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton tamano="sm" onClick={handleGuardar} cargando={guardando} disabled={!puedeGuardar}>
            {editando ? 'Guardar' : 'Crear licencia'}
          </Boton>
        </div>
      }
    >
      <div className="space-y-4">
        <Select
          etiqueta="Tipo de licencia"
          valor={tipo}
          onChange={v => setTipo(v as TipoLicencia)}
          opciones={OPCIONES_TIPO.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectorFecha
            etiqueta="Inicio"
            valor={fechaInicio}
            onChange={v => setFechaInicio(v || '')}
          />
          <SelectorFecha
            etiqueta="Fin (opcional)"
            valor={fechaFin}
            onChange={v => setFechaFin(v)}
            placeholder="Abierta"
            limpiable
          />
        </div>
        {fechasInvalidas && (
          <p className="text-xs text-insignia-peligro -mt-2">
            La fecha de fin no puede ser anterior al inicio.
          </p>
        )}

        <div className="flex items-start gap-3 p-3 rounded-card border border-borde-sutil bg-superficie-tarjeta">
          <input
            type="checkbox"
            checked={goceSueldo}
            onChange={e => setGoceSueldo(e.target.checked)}
            className="mt-1 size-4 accent-texto-marca"
          />
          <div>
            <p className="text-sm font-medium text-texto-primario">Con goce de sueldo</p>
            <p className="text-[11px] text-texto-terciario mt-0.5">
              Si está activado, los días pagan normal. Si no, el motor los descuenta del recibo proporcionalmente.
            </p>
          </div>
        </div>

        <div>
          <Input
            tipo="text"
            etiqueta={esOtro ? 'Notas (obligatoria)' : 'Notas (opcional)'}
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder={esOtro
              ? 'Describí brevemente el motivo de la licencia'
              : 'Detalles, número de certificado, etc.'}
          />
          {notaFaltante && (
            <p className="text-xs text-insignia-peligro mt-1">
              Cuando el tipo es &quot;Otro&quot; tenés que dejar una nota.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

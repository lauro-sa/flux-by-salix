'use client'

/**
 * ModalTerminarContrato — Cerrar un contrato vigente.
 *
 * Pide:
 *   - Fecha de baja (default: hoy; no anterior al inicio del contrato).
 *   - Motivo de baja (lista cerrada de causales laborales).
 *   - Nota opcional (obligatoria si el motivo es "Otro").
 *
 * Al confirmar llama a:
 *   PATCH /api/nominas/contratos/[id]  body: { accion: 'terminar', ... }
 *
 * Una vez cerrado, el motor del recibo ya no le calcula nada para
 * períodos posteriores y la card de Contrato vigente cambia a estado
 * "Terminado" con la metadata del cierre.
 */

import { useState } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useToast } from '@/componentes/feedback/Toast'
import { AlertTriangle } from 'lucide-react'
import type { ContratoLaboral, MotivoFinContrato } from '@/tipos/nominas'

interface Props {
  contrato: ContratoLaboral
  locale?: string
  onCerrar: () => void
  onTerminado: () => void
}

const OPCIONES_MOTIVO: { valor: MotivoFinContrato; etiqueta: string }[] = [
  { valor: 'renuncia', etiqueta: 'Renuncia' },
  { valor: 'despido_sin_causa', etiqueta: 'Despido sin causa' },
  { valor: 'despido_con_causa', etiqueta: 'Despido con causa' },
  { valor: 'fin_plazo', etiqueta: 'Fin de plazo' },
  { valor: 'mutuo_acuerdo', etiqueta: 'Mutuo acuerdo' },
  { valor: 'abandono', etiqueta: 'Abandono de trabajo' },
  { valor: 'jubilacion', etiqueta: 'Jubilación' },
  { valor: 'fallecimiento', etiqueta: 'Fallecimiento' },
  { valor: 'otro', etiqueta: 'Otro' },
]

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ModalTerminarContrato({ contrato, onCerrar, onTerminado }: Props) {
  const toast = useToast()
  const [fechaFin, setFechaFin] = useState<string>(hoyIso())
  const [motivo, setMotivo] = useState<MotivoFinContrato>('renuncia')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const motivoEsOtro = motivo === 'otro'
  const fechaInvalida = fechaFin < contrato.fecha_inicio
  const notaFaltante = motivoEsOtro && !nota.trim()
  const puedeGuardar = !fechaInvalida && !notaFaltante && !guardando

  const handleGuardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/nominas/contratos/${contrato.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'terminar',
          fecha_fin: fechaFin,
          motivo_fin: motivo,
          nota_fin: nota.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.mostrar('error', data.error || 'No se pudo terminar el contrato')
        setGuardando(false)
        return
      }
      toast.mostrar('exito', 'Contrato terminado')
      onTerminado()
    } catch (err) {
      console.error('[ModalTerminarContrato] error:', err)
      toast.mostrar('error', 'Error de red')
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={() => { if (!guardando) onCerrar() }}
      titulo="Terminar contrato"
      tamano="md"
      acciones={
        <div className="flex items-center justify-end gap-2 w-full">
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            tamano="sm"
            onClick={handleGuardar}
            cargando={guardando}
            disabled={!puedeGuardar}
          >
            Terminar contrato
          </Boton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Aviso: efecto en nómina */}
        <div className="rounded-card border border-insignia-advertencia/30 bg-insignia-advertencia/10 p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-insignia-advertencia shrink-0 mt-0.5" />
          <p className="text-xs text-texto-secundario">
            El empleado dejará de aparecer en Liquidaciones desde el período siguiente a la fecha de baja.
            Los pagos ya registrados no cambian.
          </p>
        </div>

        <SelectorFecha
          etiqueta="Fecha de baja"
          valor={fechaFin}
          onChange={v => setFechaFin(v || hoyIso())}
        />
        {fechaInvalida && (
          <p className="text-xs text-insignia-peligro -mt-2">
            La fecha de baja no puede ser anterior al inicio del contrato ({contrato.fecha_inicio}).
          </p>
        )}

        <Select
          etiqueta="Motivo de la baja"
          valor={motivo}
          onChange={v => setMotivo(v as MotivoFinContrato)}
          opciones={OPCIONES_MOTIVO.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
        />

        <div>
          <Input
            tipo="text"
            etiqueta={motivoEsOtro ? 'Nota (obligatoria)' : 'Nota (opcional)'}
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder={motivoEsOtro
              ? 'Explicá brevemente el motivo de la baja'
              : 'Detalles del cierre, número de telegrama, etc.'}
          />
          {notaFaltante && (
            <p className="text-xs text-insignia-peligro mt-1">
              Cuando el motivo es &quot;Otro&quot; tenés que dejar una nota para que quede registro.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

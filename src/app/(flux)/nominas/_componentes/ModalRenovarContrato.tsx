'use client'

/**
 * ModalRenovarContrato — Renovar un contrato con plazo definido.
 *
 * Aplica cuando el contrato vigente tiene `condicion` plazo_fijo, temporal
 * o pasantia. La renovación cierra el contrato actual con
 * `motivo_fin = 'renovacion'` y abre uno nuevo IDÉNTICO en condiciones
 * económicas (modalidad, monto, frecuencia, sector, turno, régimen).
 *
 * Pide al operador la fecha de inicio del nuevo contrato (default: día
 * siguiente al inicio del actual + duración previa, o mañana). Si querés
 * cambiar condiciones aprovechando la renovación, usá "Cambiar
 * condiciones" en su lugar — ese flujo permite editar todos los campos.
 *
 * Llama a POST /api/nominas/contratos con motivo_fin='renovacion' para
 * que el backend cierre el anterior y cree el nuevo en una sola operación.
 */

import { useMemo, useState } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useToast } from '@/componentes/feedback/Toast'
import { RotateCw } from 'lucide-react'
import type { ContratoLaboral } from '@/tipos/nominas'

interface Props {
  contrato: ContratoLaboral
  onCerrar: () => void
  onRenovado: () => void
}

/** Suma N días a una fecha YYYY-MM-DD en horario neutral (mediodía local). */
function sumarDias(fechaIso: string, dias: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  dt.setDate(dt.getDate() + dias)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ModalRenovarContrato({ contrato, onCerrar, onRenovado }: Props) {
  const toast = useToast()
  const [guardando, setGuardando] = useState(false)

  // Default sugerido: mañana. Si querés calzarla con el día siguiente al
  // vencimiento del contrato vigente, ajustá manualmente — el sistema no
  // guarda fecha_fin prevista mientras el contrato está vigente.
  const defaultInicio = useMemo(() => sumarDias(hoyIso(), 1), [])
  const [fechaInicio, setFechaInicio] = useState<string>(defaultInicio)

  const fechaInvalida = fechaInicio <= contrato.fecha_inicio
  const puedeGuardar = !fechaInvalida && !guardando

  const handleGuardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      const res = await fetch('/api/nominas/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: contrato.miembro_id,
          fecha_inicio: fechaInicio,
          // Hereda condiciones del contrato actual — la renovación
          // no cambia las condiciones económicas.
          condicion: contrato.condicion,
          modalidad_calculo: contrato.modalidad_calculo,
          monto_base: contrato.monto_base,
          frecuencia_pago: contrato.frecuencia_pago,
          sector_id: contrato.sector_id,
          turno_id: contrato.turno_id,
          regimen: contrato.regimen,
          motivo_cambio: 'Renovación del contrato anterior',
          // El backend usa motivo_fin para cerrar el vigente anterior,
          // no para el nuevo contrato.
          motivo_fin: 'renovacion',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo renovar el contrato')
        setGuardando(false)
        return
      }
      toast.mostrar('exito', 'Contrato renovado')
      onRenovado()
    } catch (err) {
      console.error('[ModalRenovarContrato] error:', err)
      toast.mostrar('error', 'Error de red')
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={() => { if (!guardando) onCerrar() }}
      titulo="Renovar contrato"
      tamano="md"
      accionPrimaria={{
        etiqueta: 'Renovar',
        onClick: handleGuardar,
        cargando: guardando,
      }}
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
    >
      <div className="space-y-4">
        <div className="rounded-card border border-texto-marca/30 bg-texto-marca/10 p-3 flex items-start gap-2">
          <RotateCw size={14} className="text-texto-marca shrink-0 mt-0.5" />
          <p className="text-xs text-texto-secundario">
            Se renovará el contrato con las <strong>mismas condiciones</strong> (modalidad, monto,
            frecuencia, sector, turno y régimen). El contrato actual quedará cerrado el día
            anterior a la nueva fecha de inicio, con motivo &ldquo;Renovación&rdquo;.
            Si necesitás cambiar algo, usá &ldquo;Cambiar condiciones&rdquo; en su lugar.
          </p>
        </div>

        <SelectorFecha
          etiqueta="Nueva fecha de inicio"
          valor={fechaInicio}
          onChange={v => setFechaInicio(v || defaultInicio)}
        />
        {fechaInvalida && (
          <p className="text-xs text-insignia-peligro -mt-2">
            La fecha de inicio del nuevo contrato debe ser posterior al inicio del actual ({contrato.fecha_inicio}).
          </p>
        )}
        <p className="text-xs text-texto-terciario -mt-2">
          El contrato actual quedará cerrado el día anterior automáticamente.
        </p>
      </div>
    </Modal>
  )
}

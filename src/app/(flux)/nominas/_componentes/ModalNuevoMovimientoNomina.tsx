'use client'

/**
 * Modal "Nuevo movimiento" — Crea adelanto / descuento / bono one-off.
 *
 * Reutilizable: lo usan dos lugares de Nóminas que antes tenían cada uno
 * su propio formulario inline:
 *   1. Tab "Adelantos" de la ficha del empleado (historial global).
 *   2. Card "Ajustes del período" del editor de liquidación (atajo
 *      cargado contextualmente desde el período abierto).
 *
 * Toda la creación va al endpoint POST /api/adelantos, que se encarga
 * de generar las cuotas según frecuencia. Los descuentos y bonos son
 * siempre one-off (1 cuota); solo los adelantos admiten múltiples cuotas.
 */

import { useEffect, useState } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useToast } from '@/componentes/feedback/Toast'

type TipoMovimiento = 'adelanto' | 'descuento' | 'bono'

interface Props {
  abierto: boolean
  onCerrar: () => void
  miembroId: string
  /** Tipo preseleccionado al abrir el modal (default: 'adelanto') */
  tipoInicial?: TipoMovimiento
  /** Fecha preseleccionada al abrir (default: hoy). Útil cuando el modal
   *  se abre desde un período específico para que la fecha caiga dentro. */
  fechaInicial?: string
  /** Callback después de crear con éxito. */
  onCreado: () => void | Promise<void>
}

export function ModalNuevoMovimientoNomina({
  abierto, onCerrar, miembroId, tipoInicial = 'adelanto', fechaInicial, onCreado,
}: Props) {
  const toast = useToast()

  const [tipo, setTipo] = useState<TipoMovimiento>(tipoInicial)
  const [monto, setMonto] = useState('')
  const [cuotas, setCuotas] = useState('1')
  const [fechaSolicitud, setFechaSolicitud] = useState(
    fechaInicial || new Date().toISOString().slice(0, 10),
  )
  const [notas, setNotas] = useState('')
  const [creando, setCreando] = useState(false)

  // Cuando el modal se abre, restablecer al estado inicial (los valores
  // preseleccionados podrían haber cambiado entre aperturas).
  useEffect(() => {
    if (abierto) {
      setTipo(tipoInicial)
      setMonto('')
      setCuotas('1')
      setFechaSolicitud(fechaInicial || new Date().toISOString().slice(0, 10))
      setNotas('')
    }
  }, [abierto, tipoInicial, fechaInicial])

  const crear = async () => {
    const montoNum = parseFloat(monto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast.mostrar('advertencia', 'Ingresá un monto válido')
      return
    }
    setCreando(true)
    try {
      const res = await fetch('/api/adelantos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: miembroId,
          tipo,
          monto_total: montoNum,
          // Descuentos y bonos siempre one-off; solo el adelanto admite cuotas.
          cuotas_totales: tipo === 'adelanto' ? Math.max(1, parseInt(cuotas) || 1) : 1,
          fecha_solicitud: fechaSolicitud,
          fecha_inicio_descuento: fechaSolicitud,
          frecuencia_descuento: 'mensual',
          notas: notas.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo crear el movimiento')
        return
      }
      toast.mostrar(
        'exito',
        tipo === 'bono' ? 'Bono registrado'
        : tipo === 'descuento' ? 'Descuento registrado'
        : 'Adelanto registrado',
      )
      await onCreado()
      onCerrar()
    } finally {
      setCreando(false)
    }
  }

  const tituloPorTipo =
    tipo === 'bono' ? 'Nuevo bono'
    : tipo === 'descuento' ? 'Nuevo descuento'
    : 'Nuevo adelanto'

  const labelConfirmar =
    tipo === 'bono' ? 'Registrar bono'
    : tipo === 'descuento' ? 'Registrar descuento'
    : 'Registrar adelanto'

  const montoNum = parseFloat(monto) || 0

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => { if (!creando) onCerrar() }}
      titulo={tituloPorTipo}
      tamano="lg"
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
      accionPrimaria={{
        etiqueta: labelConfirmar,
        onClick: crear,
        cargando: creando,
        disabled: !monto || montoNum <= 0,
      }}
    >
      <div className="space-y-4">
        {/* ─── Tipo de movimiento ─── */}
        <div>
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
            Tipo
          </p>
          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-card bg-superficie-elevada border border-borde-sutil">
            <TipoToggle activo={tipo === 'adelanto'} color="advertencia" onClick={() => setTipo('adelanto')}>
              Adelanto
            </TipoToggle>
            <TipoToggle activo={tipo === 'descuento'} color="peligro" onClick={() => setTipo('descuento')}>
              Descuento
            </TipoToggle>
            <TipoToggle activo={tipo === 'bono'} color="exito" onClick={() => setTipo('bono')}>
              Bono
            </TipoToggle>
          </div>
          <p className="text-[11px] text-texto-terciario mt-2">
            {tipo === 'adelanto' && 'Préstamo al empleado que se descuenta automáticamente en futuros recibos.'}
            {tipo === 'descuento' && 'Descuento puntual del recibo (rotura, multa, etc.). Se aplica en una sola liquidación.'}
            {tipo === 'bono' && 'Pago extra del patrón. Suma al neto en una sola liquidación.'}
          </p>
        </div>

        {/* ─── Monto + fecha ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InputMoneda
            etiqueta="Monto"
            value={monto}
            onChange={setMonto}
            moneda="ARS"
            placeholder="0,00"
          />
          <SelectorFecha
            etiqueta={
              tipo === 'adelanto' ? 'Fecha de entrega'
              : tipo === 'bono' ? 'Fecha del bono'
              : 'Fecha del descuento'
            }
            valor={fechaSolicitud}
            onChange={v => setFechaSolicitud(v || new Date().toISOString().slice(0, 10))}
            limpiable={false}
          />
        </div>

        {/* ─── Cuotas (solo adelanto) ─── */}
        {tipo === 'adelanto' && (
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
              Cuotas
            </label>
            <select
              value={cuotas}
              onChange={e => setCuotas(e.target.value)}
              className="w-full text-sm bg-superficie-elevada border border-borde-sutil rounded-card px-3 py-2 text-texto-primario"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>
                  {n} cuota{n !== 1 ? 's' : ''}
                  {montoNum > 0 ? ` · ${(montoNum / n).toLocaleString('es-AR', { maximumFractionDigits: 2 })} c/u` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ─── Motivo / notas ─── */}
        <Input
          tipo="text"
          etiqueta="Motivo (opcional)"
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder={
            tipo === 'adelanto' ? 'Ej: adelanto vacaciones'
            : tipo === 'bono' ? 'Ej: sobreesfuerzo del fin de semana'
            : 'Ej: rotura de herramienta'
          }
        />
      </div>
    </Modal>
  )
}

function TipoToggle({
  activo, color, onClick, children,
}: {
  activo: boolean
  color: 'advertencia' | 'peligro' | 'exito'
  onClick: () => void
  children: React.ReactNode
}) {
  const colorActivo =
    color === 'advertencia' ? 'bg-insignia-advertencia/15 text-insignia-advertencia'
    : color === 'peligro' ? 'bg-insignia-peligro/15 text-insignia-peligro'
    : 'bg-insignia-exito/15 text-insignia-exito'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm py-2 rounded transition-colors font-medium ${
        activo ? colorActivo : 'text-texto-terciario hover:text-texto-secundario'
      }`}
    >
      {children}
    </button>
  )
}

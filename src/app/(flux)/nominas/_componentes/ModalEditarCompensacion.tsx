'use client'

/**
 * ModalEditarCompensacion — Editor de la compensación base del empleado.
 *
 * Reemplaza al editor inline que vivía dentro de la card "Compensación base"
 * del editor de nóminas. La card pasa a ser solo lectura + botón "Editar".
 *
 * El modal trabaja con estado local: los cambios NO se persisten hasta que
 * el operador clickea "Guardar cambios". "Cancelar" descarta todo.
 *
 * La persistencia la hace el caller (página padre) recibiendo el objeto
 * completo en `onGuardar`. Ahí se reusa el flujo de `guardarCompensacion`
 * que ya inserta entradas en `historial_compensacion` por cada campo
 * modificado.
 *
 * 4 campos editables:
 *   • tipo:       'por_dia' | 'fijo' (modalidad del cálculo)
 *   • monto:      número (valor del jornal o sueldo del período)
 *   • frecuencia: 'semanal' | 'quincenal' | 'mensual'
 *   • dias:       5 | 6 | 7 (días de la semana que trabaja)
 */

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Landmark } from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { useToast } from '@/componentes/feedback/Toast'

export type TipoCompensacion = 'por_dia' | 'fijo'
export type FrecuenciaCompensacion = 'semanal' | 'quincenal' | 'mensual'
export type DiasSemana = 5 | 6 | 7

export interface CompensacionInput {
  tipo: TipoCompensacion
  monto: number
  frecuencia: FrecuenciaCompensacion
  dias: DiasSemana
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  valoresIniciales: CompensacionInput
  /**
   * Se invoca al confirmar. El padre persiste los cambios y dispara
   * cualquier side-effect (historial, recalcular nómina). Solo se llama
   * con los campos que efectivamente cambiaron.
   */
  onGuardar: (
    nueva: CompensacionInput,
    cambios: Partial<CompensacionInput>,
  ) => Promise<void> | void
}

function fmtMonto(v: number): string {
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function ModalEditarCompensacion({
  abierto, onCerrar, valoresIniciales, onGuardar,
}: Props) {
  const toast = useToast()

  const [tipo, setTipo] = useState<TipoCompensacion>(valoresIniciales.tipo)
  const [monto, setMonto] = useState(String(valoresIniciales.monto || ''))
  const [frecuencia, setFrecuencia] = useState<FrecuenciaCompensacion>(valoresIniciales.frecuencia)
  const [dias, setDias] = useState<DiasSemana>(valoresIniciales.dias)
  const [guardando, setGuardando] = useState(false)

  // Restaurar valores iniciales cada vez que se abre el modal.
  useEffect(() => {
    if (abierto) {
      setTipo(valoresIniciales.tipo)
      setMonto(String(valoresIniciales.monto || ''))
      setFrecuencia(valoresIniciales.frecuencia)
      setDias(valoresIniciales.dias)
    }
  }, [abierto, valoresIniciales])

  const montoNum = parseFloat(monto) || 0
  const proyeccionMensual = useMemo(() => {
    if (tipo === 'fijo') {
      // Si es fijo: el monto es del período. Para "mensual" lo dejamos
      // tal cual; para quincenal x2; semanal x4.33 (aprox).
      if (frecuencia === 'mensual') return montoNum
      if (frecuencia === 'quincenal') return montoNum * 2
      return montoNum * 4.33
    }
    // por_dia: monto × días/sem × 4.33
    return montoNum * dias * 4.33
  }, [tipo, frecuencia, dias, montoNum])

  const cambios = useMemo<Partial<CompensacionInput>>(() => {
    const c: Partial<CompensacionInput> = {}
    if (tipo !== valoresIniciales.tipo) c.tipo = tipo
    if (montoNum !== valoresIniciales.monto) c.monto = montoNum
    if (frecuencia !== valoresIniciales.frecuencia) c.frecuencia = frecuencia
    if (dias !== valoresIniciales.dias) c.dias = dias
    return c
  }, [tipo, montoNum, frecuencia, dias, valoresIniciales])

  const hayCambios = Object.keys(cambios).length > 0

  const handleGuardar = async () => {
    if (montoNum <= 0) {
      toast.mostrar('advertencia', 'Ingresá un monto válido')
      return
    }
    if (!hayCambios) {
      onCerrar()
      return
    }
    setGuardando(true)
    try {
      await onGuardar({ tipo, monto: montoNum, frecuencia, dias }, cambios)
      toast.mostrar('exito', 'Compensación actualizada')
      onCerrar()
    } catch (e) {
      console.error('[ModalEditarCompensacion] error guardando:', e)
      toast.mostrar('error', 'No se pudo guardar la compensación')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => { if (!guardando) onCerrar() }}
      titulo="Compensación base"
      tamano="lg"
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
      accionPrimaria={{
        etiqueta: hayCambios ? 'Guardar cambios' : 'Cerrar',
        onClick: hayCambios ? handleGuardar : onCerrar,
        cargando: guardando,
        disabled: montoNum <= 0,
      }}
    >
      <div className="space-y-5">
        {/* ─── Tipo de pago ─── */}
        <div>
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
            Tipo de pago
          </p>
          <div className="grid grid-cols-2 gap-3">
            <OpcionTipo
              activa={tipo === 'por_dia'}
              titulo="Cobra por día"
              desc="Gana un monto por cada día que trabaja."
              icono={<CalendarDays size={20} />}
              onClick={() => setTipo('por_dia')}
            />
            <OpcionTipo
              activa={tipo === 'fijo'}
              titulo="Sueldo fijo"
              desc="Cobra un monto fijo por período completo."
              icono={<Landmark size={20} />}
              onClick={() => setTipo('fijo')}
            />
          </div>
        </div>

        {/* ─── Monto + proyección ─── */}
        <div>
          <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
            {tipo === 'por_dia' ? '¿Cuánto gana por día trabajado?' : '¿Cuánto gana por período?'}
          </label>
          <InputMoneda
            value={monto}
            onChange={setMonto}
            moneda="ARS"
            placeholder="0,00"
          />
          {montoNum > 0 && (
            <p className="text-[11px] text-texto-terciario mt-2">
              Proyección mensual:{' '}
              <span className="text-insignia-exito font-medium tabular-nums">
                {fmtMonto(proyeccionMensual)}
              </span>
            </p>
          )}
        </div>

        {/* ─── Divisor sutil ─── */}
        <div className="border-t border-white/[0.06]" />

        {/* ─── Frecuencia + días en grid ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
              ¿Cada cuánto cobra?
            </p>
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-card bg-superficie-elevada border border-borde-sutil">
              <PillSegmento activo={frecuencia === 'semanal'} onClick={() => setFrecuencia('semanal')}>
                Semanal
              </PillSegmento>
              <PillSegmento activo={frecuencia === 'quincenal'} onClick={() => setFrecuencia('quincenal')}>
                Quincenal
              </PillSegmento>
              <PillSegmento activo={frecuencia === 'mensual'} onClick={() => setFrecuencia('mensual')}>
                Mensual
              </PillSegmento>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
              Días por semana
            </p>
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-card bg-superficie-elevada border border-borde-sutil">
              <PillSegmento activo={dias === 5} onClick={() => setDias(5)}>L-V</PillSegmento>
              <PillSegmento activo={dias === 6} onClick={() => setDias(6)}>L-S</PillSegmento>
              <PillSegmento activo={dias === 7} onClick={() => setDias(7)}>7/7</PillSegmento>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Subcomponentes ───

function OpcionTipo({
  activa, titulo, desc, icono, onClick,
}: {
  activa: boolean
  titulo: string
  desc: string
  icono: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 p-3 rounded-card border text-left transition-all ${
        activa
          ? 'border-texto-marca bg-texto-marca/5'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
      }`}
    >
      <div className={`size-10 rounded-card flex items-center justify-center shrink-0 ${
        activa ? 'bg-texto-marca/15 text-texto-marca' : 'bg-superficie-hover text-texto-terciario'
      }`}>
        {icono}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${activa ? 'text-texto-marca' : 'text-texto-primario'}`}>
          {titulo}
        </p>
        <p className="text-xs text-texto-terciario mt-0.5 leading-snug">{desc}</p>
      </div>
    </button>
  )
}

function PillSegmento({
  activo, onClick, children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm py-2 rounded transition-colors font-medium ${
        activo
          ? 'bg-texto-marca/15 text-texto-marca'
          : 'text-texto-terciario hover:text-texto-secundario'
      }`}
    >
      {children}
    </button>
  )
}

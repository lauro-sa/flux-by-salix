'use client'

/**
 * ModalEditarContrato — Corregir un contrato cargado por error.
 *
 * Diferencia con "Cambiar condiciones":
 *   - Editar: el contrato sigue siendo el mismo, solo se corrigen
 *     datos. NO crea historial. Solo disponible cuando el contrato
 *     todavía no tiene recibos asociados (sino afectaría retroactivamente
 *     liquidaciones ya emitidas).
 *   - Cambiar condiciones (EditorContrato con motivo_fin=cambio_condiciones):
 *     cierra el contrato actual + crea uno nuevo. Es el flujo correcto
 *     para aumentos o cambios reales en condiciones.
 *
 * Política de campos:
 *   - Administrativos (sector, turno, condición, régimen, fecha_inicio,
 *     motivo_cambio, notas, pdf_url): siempre editables.
 *   - Económicos (modalidad_calculo, monto_base, frecuencia_pago):
 *     editables solo si no hay pagos_nomina con este contrato. El
 *     backend devuelve 409 si se intenta editarlos con pagos existentes.
 *     La UI los muestra disabled en ese caso con tooltip explicativo.
 *
 * Llama a PATCH /api/nominas/contratos/[id] con `accion: 'editar'`.
 */

import { useEffect, useState } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useToast } from '@/componentes/feedback/Toast'
import { Pencil, Lock } from 'lucide-react'
import type {
  ContratoLaboral,
  CondicionContrato,
  ModalidadCalculo,
  FrecuenciaPago,
  RegimenContrato,
} from '@/tipos/nominas'

interface OpcionRef {
  id: string
  nombre: string
}

interface Props {
  contrato: ContratoLaboral
  sectores: OpcionRef[]
  turnos: OpcionRef[]
  onCerrar: () => void
  onActualizado: () => void
}

const OPCIONES_CONDICION: { valor: CondicionContrato; etiqueta: string }[] = [
  { valor: 'tiempo_indeterminado', etiqueta: 'Tiempo indeterminado' },
  { valor: 'plazo_fijo', etiqueta: 'Plazo fijo' },
  { valor: 'temporal', etiqueta: 'Temporal' },
  { valor: 'pasantia', etiqueta: 'Pasantía' },
  { valor: 'otro', etiqueta: 'Otro' },
]

const OPCIONES_MODALIDAD: { valor: ModalidadCalculo; etiqueta: string }[] = [
  { valor: 'por_hora', etiqueta: 'Por hora' },
  { valor: 'por_dia', etiqueta: 'Por día' },
  { valor: 'fijo_semanal', etiqueta: 'Fijo semanal' },
  { valor: 'fijo_quincenal', etiqueta: 'Fijo quincenal' },
  { valor: 'fijo_mensual', etiqueta: 'Fijo mensual' },
]

const OPCIONES_FRECUENCIA: { valor: FrecuenciaPago; etiqueta: string }[] = [
  { valor: 'diaria', etiqueta: 'Diaria' },
  { valor: 'semanal', etiqueta: 'Semanal' },
  { valor: 'quincenal', etiqueta: 'Quincenal' },
  { valor: 'mensual', etiqueta: 'Mensual' },
]

const OPCIONES_REGIMEN: { valor: RegimenContrato; etiqueta: string }[] = [
  { valor: 'informal', etiqueta: 'Informal' },
  { valor: 'monotributo', etiqueta: 'Monotributo' },
  { valor: 'relacion_dependencia', etiqueta: 'Relación de dependencia' },
]

export function ModalEditarContrato({
  contrato, sectores, turnos, onCerrar, onActualizado,
}: Props) {
  const toast = useToast()
  const economicosBloqueados = !!contrato.tiene_pagos

  // ─── State (prefilled desde el contrato) ───
  const [sectorId, setSectorId] = useState<string>(contrato.sector_id ?? '')
  const [turnoId, setTurnoId] = useState<string>(contrato.turno_id ?? '')
  const [condicion, setCondicion] = useState<CondicionContrato>(contrato.condicion)
  const [regimen, setRegimen] = useState<RegimenContrato>(contrato.regimen)
  const [fechaInicio, setFechaInicio] = useState<string>(contrato.fecha_inicio)

  const [modalidad, setModalidad] = useState<ModalidadCalculo>(contrato.modalidad_calculo)
  const [montoBase, setMontoBase] = useState<string>(String(contrato.monto_base))
  const [frecuenciaPago, setFrecuenciaPago] = useState<FrecuenciaPago>(contrato.frecuencia_pago)

  const [motivoCambio, setMotivoCambio] = useState<string>(contrato.motivo_cambio ?? '')
  const [notas, setNotas] = useState<string>(contrato.notas ?? '')
  const [pdfUrl, setPdfUrl] = useState<string>(contrato.pdf_url ?? '')

  const [guardando, setGuardando] = useState(false)

  // Si llega un contrato distinto (improbable por uso, pero por las dudas),
  // re-prefillear el form.
  useEffect(() => {
    setSectorId(contrato.sector_id ?? '')
    setTurnoId(contrato.turno_id ?? '')
    setCondicion(contrato.condicion)
    setRegimen(contrato.regimen)
    setFechaInicio(contrato.fecha_inicio)
    setModalidad(contrato.modalidad_calculo)
    setMontoBase(String(contrato.monto_base))
    setFrecuenciaPago(contrato.frecuencia_pago)
    setMotivoCambio(contrato.motivo_cambio ?? '')
    setNotas(contrato.notas ?? '')
    setPdfUrl(contrato.pdf_url ?? '')
  }, [contrato])

  const guardar = async () => {
    const monto = Number(montoBase)
    if (!Number.isFinite(monto) || monto < 0) {
      toast.mostrar('error', 'Monto inválido')
      return
    }

    // Armamos solo los campos que cambiaron — el endpoint acepta payload
    // parcial. Mandar todo siempre no rompe nada, pero es ruido innecesario.
    const cambios: Record<string, unknown> = { accion: 'editar' }
    if ((contrato.sector_id ?? '') !== sectorId) cambios.sector_id = sectorId || null
    if ((contrato.turno_id ?? '') !== turnoId) cambios.turno_id = turnoId || null
    if (contrato.condicion !== condicion) cambios.condicion = condicion
    if (contrato.regimen !== regimen) cambios.regimen = regimen
    if (contrato.fecha_inicio !== fechaInicio) cambios.fecha_inicio = fechaInicio
    if (contrato.modalidad_calculo !== modalidad) cambios.modalidad_calculo = modalidad
    if (contrato.monto_base !== monto) cambios.monto_base = monto
    if (contrato.frecuencia_pago !== frecuenciaPago) cambios.frecuencia_pago = frecuenciaPago
    if ((contrato.motivo_cambio ?? '') !== motivoCambio) cambios.motivo_cambio = motivoCambio || null
    if ((contrato.notas ?? '') !== notas) cambios.notas = notas || null
    if ((contrato.pdf_url ?? '') !== pdfUrl) cambios.pdf_url = pdfUrl || null

    if (Object.keys(cambios).length === 1) {
      toast.mostrar('info', 'No hay cambios para guardar')
      return
    }

    setGuardando(true)
    try {
      const res = await fetch(`/api/nominas/contratos/${contrato.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo guardar')
        return
      }
      toast.mostrar('exito', 'Contrato actualizado')
      onActualizado()
    } catch (err) {
      console.error('[ModalEditarContrato] error', err)
      toast.mostrar('error', 'Error de red al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const opcionesSector = [{ valor: '', etiqueta: 'Sin sector' }, ...sectores.map(s => ({ valor: s.id, etiqueta: s.nombre }))]
  const opcionesTurno = [{ valor: '', etiqueta: 'Sin turno' }, ...turnos.map(t => ({ valor: t.id, etiqueta: t.nombre }))]

  return (
    <Modal
      abierto
      onCerrar={() => { if (!guardando) onCerrar() }}
      titulo="Editar contrato"
      tamano="5xl"
      accionPrimaria={{ etiqueta: 'Guardar', onClick: guardar, cargando: guardando }}
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
    >
      <div className="space-y-5">
        {/* Aviso */}
        <div className="rounded-card border border-texto-marca/30 bg-texto-marca/10 p-3 flex items-start gap-2">
          <Pencil size={14} className="text-texto-marca shrink-0 mt-0.5" />
          <p className="text-xs text-texto-secundario">
            Corregí los datos del contrato vigente. Esta acción <strong>no crea historial</strong> —
            usala cuando te equivocaste cargando. Si el cambio es real (un aumento, un cambio de
            modalidad acordado), usá &ldquo;Cambiar condiciones&rdquo; en su lugar para preservar
            la fecha desde la cual aplica.
          </p>
        </div>

        {economicosBloqueados && (
          <div className="rounded-card border border-insignia-advertencia/30 bg-insignia-advertencia/10 p-3 flex items-start gap-2">
            <Lock size={14} className="text-insignia-advertencia shrink-0 mt-0.5" />
            <p className="text-xs text-texto-secundario">
              Este contrato ya tiene recibos generados. <strong>Modalidad, monto y frecuencia</strong> quedaron
              bloqueados para no afectar liquidaciones pasadas. Para cambiarlos, cerrá el modal y usá
              &ldquo;Cambiar condiciones&rdquo;.
            </p>
          </div>
        )}

        {/* ─── Identidad (ancho completo) ─── */}
        <section>
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Identidad</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select etiqueta="Sector" valor={sectorId} opciones={opcionesSector} onChange={setSectorId} />
            <Select etiqueta="Turno" valor={turnoId} opciones={opcionesTurno} onChange={setTurnoId} />
            <Select
              etiqueta="Condición"
              valor={condicion}
              opciones={OPCIONES_CONDICION.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
              onChange={(v) => setCondicion(v as CondicionContrato)}
            />
          </div>
        </section>

        {/* ─── 2 columnas: Cálculo (izq) + Régimen/docs (der) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-5 pt-4 border-t border-white/[0.07]">

          {/* COL IZQUIERDA — Cálculo */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Cálculo del haber</h3>
            {/* Cuando hay pagos, bloqueamos visual e interactivamente los
                campos económicos. El backend también valida; esto es solo
                UX para que el operador no pierda tiempo intentando. */}
            <div className={economicosBloqueados ? 'pointer-events-none opacity-50' : ''} title={economicosBloqueados ? 'Hay recibos generados — usá "Cambiar condiciones" para modificar montos.' : undefined}>
              <Select
                etiqueta="Modalidad de cálculo"
                valor={modalidad}
                opciones={OPCIONES_MODALIDAD.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
                onChange={(v) => setModalidad(v as ModalidadCalculo)}
              />
            </div>
            <InputMoneda
              etiqueta="Monto base"
              value={montoBase}
              onChange={setMontoBase}
              disabled={economicosBloqueados}
            />
            <div className={economicosBloqueados ? 'pointer-events-none opacity-50' : ''}>
              <Select
                etiqueta="Frecuencia de pago"
                valor={frecuenciaPago}
                opciones={OPCIONES_FRECUENCIA.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
                onChange={(v) => setFrecuenciaPago(v as FrecuenciaPago)}
              />
            </div>
            <SelectorFecha
              etiqueta="Fecha de inicio"
              valor={fechaInicio}
              onChange={(v) => setFechaInicio(v || contrato.fecha_inicio)}
            />
          </section>

          {/* Divisor vertical */}
          <div className="hidden md:block bg-white/[0.07]" />

          {/* COL DERECHA — Régimen + docs */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Régimen y documentos</h3>
            <Select
              etiqueta="Régimen fiscal"
              valor={regimen}
              opciones={OPCIONES_REGIMEN.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
              onChange={(v) => setRegimen(v as RegimenContrato)}
            />
            <Input
              etiqueta="PDF del contrato (URL)"
              value={pdfUrl}
              onChange={e => setPdfUrl(e.target.value)}
              placeholder="https://..."
            />
            <Input
              etiqueta="Motivo del cambio"
              value={motivoCambio}
              onChange={e => setMotivoCambio(e.target.value)}
              placeholder="Corrección de carga inicial"
            />
            <div>
              <label className="block text-sm text-texto-secundario mb-1.5">Notas</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-superficie-tarjeta border border-borde-sutil px-3 py-2 text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:border-texto-marca/50 resize-none"
                placeholder="Detalles adicionales del contrato"
              />
            </div>
          </section>
        </div>
      </div>
    </Modal>
  )
}

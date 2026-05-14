'use client'

/**
 * EditorContrato — Modal para crear un contrato nuevo para un miembro.
 *
 * Layout (CLAUDE.md "patrón ModalTipoActividad"):
 *   ┌─────────────────────────────────────────────────────┐
 *   │ Identidad: Sector + Turno + Condición  (ancho full) │
 *   ├──── border ────────────────────────────────────────│
 *   │ COL IZQ — Cálculo            │ COL DER — Documentos │
 *   ├─────────────────────────────────────────────────────┤
 *   │                  [Cancelar] [Crear contrato]        │
 *   └─────────────────────────────────────────────────────┘
 *
 * Al guardar, llama a POST /api/nominas/contratos. El backend cierra
 * el contrato vigente anterior (si existe) y crea el nuevo en
 * sucesión. La doble escritura legacy (miembros.compensacion_*) se
 * hace también del lado servidor.
 *
 * Si el miembro ya tiene un contrato vigente, los defaults del form
 * se prefilean desde ahí — el caso típico es "subir el sueldo": el
 * usuario solo cambia monto + motivo y guarda.
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 5).
 */

import { useEffect, useState } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useToast } from '@/componentes/feedback/Toast'
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
  abierto: boolean
  miembroId: string
  /** Si presente, los defaults del form se prefilean desde acá. */
  contratoActual?: ContratoLaboral | null
  /** Catálogos de sector y turno para los selects. */
  sectores: OpcionRef[]
  turnos: OpcionRef[]
  onCerrar: () => void
  /** Se llama después de un POST exitoso con el contrato creado. */
  onCreado: (nuevo: ContratoLaboral) => void
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

/** Devuelve la fecha de hoy en formato YYYY-MM-DD (zona local). */
function hoyIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function EditorContrato({
  abierto, miembroId, contratoActual, sectores, turnos, onCerrar, onCreado,
}: Props) {
  const toast = useToast()

  // ─── State ───
  const [fechaInicio, setFechaInicio] = useState<string>(hoyIso())
  const [condicion, setCondicion] = useState<CondicionContrato>('tiempo_indeterminado')
  const [sectorId, setSectorId] = useState<string>('')
  const [turnoId, setTurnoId] = useState<string>('')

  const [modalidad, setModalidad] = useState<ModalidadCalculo>('fijo_mensual')
  const [montoBase, setMontoBase] = useState<string>('0')
  const [frecuenciaPago, setFrecuenciaPago] = useState<FrecuenciaPago>('mensual')

  const [regimen, setRegimen] = useState<RegimenContrato>('informal')
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [motivoCambio, setMotivoCambio] = useState<string>('')
  const [notas, setNotas] = useState<string>('')

  const [guardando, setGuardando] = useState(false)

  // ─── Prefill desde contratoActual cuando se abre ───
  useEffect(() => {
    if (!abierto) return
    if (contratoActual) {
      setFechaInicio(hoyIso())
      setCondicion(contratoActual.condicion)
      setSectorId(contratoActual.sector_id ?? '')
      setTurnoId(contratoActual.turno_id ?? '')
      setModalidad(contratoActual.modalidad_calculo)
      setMontoBase(String(contratoActual.monto_base))
      setFrecuenciaPago(contratoActual.frecuencia_pago)
      setRegimen(contratoActual.regimen)
      setPdfUrl('')
      setMotivoCambio('')
      setNotas('')
    } else {
      // Sin contrato previo: defaults conservadores.
      setFechaInicio(hoyIso())
      setCondicion('tiempo_indeterminado')
      setSectorId('')
      setTurnoId('')
      setModalidad('fijo_mensual')
      setMontoBase('0')
      setFrecuenciaPago('mensual')
      setRegimen('informal')
      setPdfUrl('')
      setMotivoCambio('')
      setNotas('')
    }
  }, [abierto, contratoActual])

  const guardar = async () => {
    const monto = Number(montoBase)
    if (!fechaInicio) return toast.mostrar('error', 'Fecha de inicio requerida')
    if (!Number.isFinite(monto) || monto < 0) return toast.mostrar('error', 'Monto inválido')

    setGuardando(true)
    try {
      const res = await fetch('/api/nominas/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: miembroId,
          fecha_inicio: fechaInicio,
          condicion,
          modalidad_calculo: modalidad,
          monto_base: monto,
          frecuencia_pago: frecuenciaPago,
          sector_id: sectorId || null,
          turno_id: turnoId || null,
          regimen,
          pdf_url: pdfUrl || null,
          motivo_cambio: motivoCambio || null,
          notas: notas || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo crear el contrato')
        return
      }
      toast.mostrar('exito', 'Contrato creado')
      onCreado(data.contrato as ContratoLaboral)
      onCerrar()
    } catch (err) {
      console.error('[EditorContrato] error', err)
      toast.mostrar('error', 'Error de red al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const opcionesSector = [{ valor: '', etiqueta: 'Sin sector' }, ...sectores.map(s => ({ valor: s.id, etiqueta: s.nombre }))]
  const opcionesTurno = [{ valor: '', etiqueta: 'Sin turno' }, ...turnos.map(t => ({ valor: t.id, etiqueta: t.nombre }))]

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={contratoActual ? 'Nuevo contrato (cierra el vigente)' : 'Crear contrato'}
      tamano="5xl"
      accionPrimaria={{ etiqueta: 'Crear contrato', onClick: guardar, cargando: guardando }}
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
    >
      <div className="space-y-5">

        {/* ─── Sección Identidad (ancho completo) ─── */}
        <section>
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Identidad</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              etiqueta="Sector"
              valor={sectorId}
              opciones={opcionesSector}
              onChange={setSectorId}
            />
            <Select
              etiqueta="Turno"
              valor={turnoId}
              opciones={opcionesTurno}
              onChange={setTurnoId}
            />
            <Select
              etiqueta="Condición"
              valor={condicion}
              opciones={OPCIONES_CONDICION.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
              onChange={(v) => setCondicion(v as CondicionContrato)}
            />
          </div>
        </section>

        {/* ─── 2 columnas: Cálculo (izq) + Documentos/Régimen (der) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-5 pt-4 border-t border-white/[0.07]">

          {/* COL IZQUIERDA — Cálculo del haber */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Cálculo del haber</h3>
            <Select
              etiqueta="Modalidad de cálculo"
              valor={modalidad}
              opciones={OPCIONES_MODALIDAD.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
              onChange={(v) => setModalidad(v as ModalidadCalculo)}
            />
            <InputMoneda
              etiqueta="Monto base"
              value={montoBase}
              onChange={setMontoBase}
            />
            <Select
              etiqueta="Frecuencia de pago"
              valor={frecuenciaPago}
              opciones={OPCIONES_FRECUENCIA.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
              onChange={(v) => setFrecuenciaPago(v as FrecuenciaPago)}
            />
            <SelectorFecha
              etiqueta="Fecha de inicio"
              valor={fechaInicio}
              onChange={(v) => setFechaInicio(v || hoyIso())}
            />
          </section>

          {/* Divisor vertical solo desktop */}
          <div className="hidden md:block bg-white/[0.07]" />

          {/* COL DERECHA — Régimen y documentos */}
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
              placeholder="Aumento de sueldo, cambio de modalidad, etc."
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

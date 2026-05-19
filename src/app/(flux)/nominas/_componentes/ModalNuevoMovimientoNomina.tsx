'use client'

/**
 * Modal "Nuevo ajuste del período" — Crea adelanto, descuento, bono o
 * concepto del catálogo (one-off) para el empleado.
 *
 * Reutilizable: lo usan dos lugares de Nóminas que antes tenían cada uno
 * su propio formulario inline:
 *   1. Tab "Adelantos" de la ficha del empleado (historial global).
 *   2. Card "Ajustes del período" del editor de liquidación (atajo
 *      cargado contextualmente desde el período abierto).
 *
 * Tipos soportados (4):
 *   • adelanto  → préstamo en cuotas, va a /api/adelantos.
 *   • descuento → one-off, va a /api/adelantos (1 cuota).
 *   • bono      → one-off, va a /api/adelantos (1 cuota, signo +).
 *   • concepto  → agrega un concepto del catálogo SOLO a este período,
 *                 va a /api/nominas/ajustes-periodo con tipo_ajuste='agregar'.
 *                 Requiere `periodoInicio`/`periodoFin` y
 *                 `conceptosEnContratoIds` para filtrar el catálogo.
 *
 * Aviso "fuera del período": si el editor pasa `periodoInicio`/`periodoFin`
 * y la fecha elegida cae fuera del rango, mostramos un cartel claro
 * explicando que el ajuste no aplicará a este período sino al que
 * corresponda según su fecha. Esto evita el error típico de poner "hoy"
 * cuando ya pasó el cierre del período.
 */

import { useEffect, useMemo, useState } from 'react'
import { Info, Tag } from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { Select } from '@/componentes/ui/Select'
import { useToast } from '@/componentes/feedback/Toast'
import type { ConceptoNomina } from '@/tipos/nominas'

type TipoMovimiento = 'adelanto' | 'descuento' | 'bono' | 'concepto'

interface Props {
  abierto: boolean
  onCerrar: () => void
  miembroId: string
  /** Tipo preseleccionado al abrir el modal (default: 'adelanto') */
  tipoInicial?: TipoMovimiento
  /** Fecha preseleccionada al abrir (default: hoy). Útil cuando el modal
   *  se abre desde un período específico para que la fecha caiga dentro. */
  fechaInicial?: string
  /** Período abierto en el editor (opcional). Si se pasa, mostramos
   *  aviso cuando la fecha del ajuste cae fuera del rango y habilitamos
   *  el tipo 'concepto'. */
  periodoInicio?: string
  periodoFin?: string
  /** Para el tipo 'concepto': IDs de conceptos ya asignados al contrato
   *  vigente (se excluyen del picker para forzar el flujo correcto de
   *  override desde el desglose). Si no se pasa, no se filtra. */
  conceptosEnContratoIds?: Set<string>
  /** Callback después de crear con éxito. */
  onCreado: () => void | Promise<void>
}

export function ModalNuevoMovimientoNomina({
  abierto, onCerrar, miembroId, tipoInicial = 'adelanto', fechaInicial,
  periodoInicio, periodoFin, conceptosEnContratoIds, onCreado,
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

  // Estado específico del tipo 'concepto' — solo se carga si llega a usarse.
  const [catalogo, setCatalogo] = useState<ConceptoNomina[]>([])
  const [conceptoIdSel, setConceptoIdSel] = useState<string>('')
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false)

  // Cuando el modal se abre, restablecer al estado inicial (los valores
  // preseleccionados podrían haber cambiado entre aperturas).
  useEffect(() => {
    if (abierto) {
      setTipo(tipoInicial)
      setMonto('')
      setCuotas('1')
      setFechaSolicitud(fechaInicial || new Date().toISOString().slice(0, 10))
      setNotas('')
      setConceptoIdSel('')
    }
  }, [abierto, tipoInicial, fechaInicial])

  // Cargar catálogo cuando el usuario entra al modo 'concepto'. Se hace
  // bajo demanda — si nunca elige ese tipo, no hay request extra.
  useEffect(() => {
    if (!abierto || tipo !== 'concepto' || catalogo.length > 0) return
    setCargandoCatalogo(true)
    fetch('/api/nominas/conceptos')
      .then(r => r.json())
      .then(data => {
        const lista = (data.conceptos ?? []) as ConceptoNomina[]
        setCatalogo(lista.filter(c => c.activo))
      })
      .catch(err => console.error('[ModalNuevoMovimientoNomina] error cargando catálogo:', err))
      .finally(() => setCargandoCatalogo(false))
  }, [abierto, tipo, catalogo.length])

  // Prefill del monto al elegir un concepto con valor por default.
  useEffect(() => {
    if (tipo !== 'concepto' || !conceptoIdSel) return
    const c = catalogo.find(x => x.id === conceptoIdSel)
    if (c && c.valor !== null && c.valor !== undefined && !monto) {
      setMonto(String(Number(c.valor)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptoIdSel, tipo])

  // Conceptos elegibles: activos + NO ya asignados al contrato vigente.
  const conceptosElegibles = useMemo(
    () => catalogo.filter(c => !conceptosEnContratoIds?.has(c.id)),
    [catalogo, conceptosEnContratoIds],
  )

  const opcionesConcepto = useMemo(
    () => conceptosElegibles.map(c => ({
      valor: c.id,
      etiqueta: c.nombre,
      descripcion: c.tipo === 'haber' ? 'Suma al neto' : 'Resta del neto',
    })),
    [conceptosElegibles],
  )

  const conceptoSeleccionado = catalogo.find(c => c.id === conceptoIdSel)

  // ── Detección "fuera del período" para los tipos basados en fecha ──
  // Si el modal recibió periodoInicio/Fin y el operador eligió una fecha
  // que cae fuera, mostramos un aviso amarillo. No bloqueamos el guardado:
  // hay casos legítimos donde querés que aplique al próximo período.
  const fueraDelPeriodo = useMemo(() => {
    if (!periodoInicio || !periodoFin) return false
    if (tipo === 'concepto') return false  // concepto siempre aplica al período abierto
    return fechaSolicitud < periodoInicio || fechaSolicitud > periodoFin
  }, [tipo, fechaSolicitud, periodoInicio, periodoFin])

  // ── Submit ──
  const crear = async () => {
    const montoNum = parseFloat(monto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast.mostrar('advertencia', 'Ingresá un monto válido')
      return
    }

    setCreando(true)
    try {
      if (tipo === 'concepto') {
        if (!conceptoIdSel) {
          toast.mostrar('advertencia', 'Elegí un concepto')
          return
        }
        if (!periodoInicio || !periodoFin) {
          toast.mostrar('error', 'Falta el período para agregar el concepto')
          return
        }
        const res = await fetch('/api/nominas/ajustes-periodo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            miembro_id: miembroId,
            periodo_inicio: periodoInicio,
            periodo_fin: periodoFin,
            concepto_id: conceptoIdSel,
            tipo_ajuste: 'agregar',
            monto_override: montoNum,
            motivo: notas.trim() || null,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.mostrar('error', data.error || 'No se pudo agregar el concepto')
          return
        }
        toast.mostrar('exito', 'Concepto agregado al período')
        await onCreado()
        onCerrar()
        return
      }

      // adelanto / descuento / bono → endpoint legacy /api/adelantos
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
    : tipo === 'concepto' ? 'Agregar concepto del catálogo'
    : 'Nuevo adelanto'

  const labelConfirmar =
    tipo === 'bono' ? 'Registrar bono'
    : tipo === 'descuento' ? 'Registrar descuento'
    : tipo === 'concepto' ? 'Agregar al período'
    : 'Registrar adelanto'

  const montoNum = parseFloat(monto) || 0

  // El tipo 'concepto' solo está disponible cuando el modal se abre desde
  // un período concreto (sino no tiene sentido — no hay período al cual
  // aplicarlo).
  const conceptoDisponible = !!periodoInicio && !!periodoFin

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
        disabled: !monto || montoNum <= 0 || (tipo === 'concepto' && !conceptoIdSel),
      }}
    >
      <div className="space-y-4">
        {/* ─── Tipo de movimiento ─── */}
        <div>
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
            Tipo
          </p>
          <div className={`grid ${conceptoDisponible ? 'grid-cols-4' : 'grid-cols-3'} gap-1 p-0.5 rounded-card bg-superficie-elevada border border-borde-sutil`}>
            <TipoToggle activo={tipo === 'adelanto'} color="advertencia" onClick={() => setTipo('adelanto')}>
              Adelanto
            </TipoToggle>
            <TipoToggle activo={tipo === 'descuento'} color="peligro" onClick={() => setTipo('descuento')}>
              Descuento
            </TipoToggle>
            <TipoToggle activo={tipo === 'bono'} color="exito" onClick={() => setTipo('bono')}>
              Bono
            </TipoToggle>
            {conceptoDisponible && (
              <TipoToggle activo={tipo === 'concepto'} color="info" onClick={() => setTipo('concepto')}>
                Concepto
              </TipoToggle>
            )}
          </div>
          <p className="text-[11px] text-texto-terciario mt-2">
            {tipo === 'adelanto' && 'Préstamo al empleado que se descuenta automáticamente en futuros recibos.'}
            {tipo === 'descuento' && 'Descuento puntual del recibo (rotura, multa, etc.). Se aplica en una sola liquidación.'}
            {tipo === 'bono' && 'Pago extra del patrón. Suma al neto en una sola liquidación.'}
            {tipo === 'concepto' && 'Suma o resta un concepto del catálogo SOLO en esta liquidación, sin modificar el contrato.'}
          </p>
        </div>

        {/* ─── Selector de concepto (solo modo 'concepto') ─── */}
        {tipo === 'concepto' && (
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
              <Tag size={11} className="inline mr-1" />
              Concepto del catálogo
            </label>
            {cargandoCatalogo ? (
              <p className="text-xs text-texto-terciario py-2">Cargando catálogo…</p>
            ) : conceptosElegibles.length === 0 ? (
              <p className="text-xs text-texto-terciario py-2">
                No hay conceptos del catálogo disponibles. Todos los activos ya están en el contrato.
              </p>
            ) : (
              <>
                <Select
                  opciones={opcionesConcepto}
                  valor={conceptoIdSel}
                  onChange={setConceptoIdSel}
                  placeholder="Elegí un concepto…"
                />
                {conceptoSeleccionado?.descripcion && (
                  <p className="text-[11px] text-texto-terciario italic mt-1.5">
                    {conceptoSeleccionado.descripcion}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── Monto + fecha (fecha NO aplica al modo 'concepto') ─── */}
        <div className={`grid grid-cols-1 ${tipo === 'concepto' ? '' : 'md:grid-cols-2'} gap-3`}>
          <InputMoneda
            etiqueta="Monto"
            value={monto}
            onChange={setMonto}
            moneda="ARS"
            placeholder="0,00"
          />
          {tipo !== 'concepto' && (
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
          )}
        </div>

        {/* ─── Aviso "fuera del período" ─── */}
        {fueraDelPeriodo && periodoInicio && periodoFin && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-insignia-advertencia/10 border border-insignia-advertencia/30">
            <Info size={13} className="text-insignia-advertencia mt-0.5 shrink-0" />
            <p className="text-[11px] text-texto-secundario leading-relaxed">
              La fecha elegida está fuera del período abierto
              <span className="text-texto-primario font-medium"> ({fmtRango(periodoInicio, periodoFin)})</span>.
              Este {tipo === 'bono' ? 'bono' : tipo === 'descuento' ? 'descuento' : 'adelanto'} no va a aparecer acá; se aplicará al período que corresponda según su fecha.
            </p>
          </div>
        )}

        {/* ─── Cuotas (solo adelanto) ─── */}
        {tipo === 'adelanto' && (
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
              Cuotas
            </label>
            <Select
              opciones={Array.from({ length: 12 }, (_, i) => i + 1).map(n => ({
                valor: String(n),
                etiqueta: `${n} cuota${n !== 1 ? 's' : ''}`,
                descripcion: montoNum > 0
                  ? `${(montoNum / n).toLocaleString('es-AR', { maximumFractionDigits: 2 })} c/u`
                  : undefined,
              }))}
              valor={cuotas}
              onChange={setCuotas}
            />
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
            : tipo === 'concepto' ? 'Ej: bono navideño'
            : 'Ej: rotura de herramienta'
          }
        />
      </div>
    </Modal>
  )
}

// ─── Helpers ───

function fmtRango(desde: string, hasta: string): string {
  const f = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }
  return `${f(desde)} – ${f(hasta)}`
}

// ─── Subcomponentes ───

function TipoToggle({
  activo, color, onClick, children,
}: {
  activo: boolean
  color: 'advertencia' | 'peligro' | 'exito' | 'info'
  onClick: () => void
  children: React.ReactNode
}) {
  const colorActivo =
    color === 'advertencia' ? 'bg-insignia-advertencia/15 text-insignia-advertencia'
    : color === 'peligro' ? 'bg-insignia-peligro/15 text-insignia-peligro'
    : color === 'info' ? 'bg-insignia-info/15 text-insignia-info'
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

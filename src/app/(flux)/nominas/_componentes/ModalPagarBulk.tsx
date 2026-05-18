'use client'

/**
 * ModalPagarBulk — Modal para registrar pagos de múltiples empleados de
 * un saque desde el dashboard de Liquidaciones.
 *
 * Se abre cuando el operador clickea "Pagar (N)" en el KpiHeroAccionPrincipal.
 * Lista los empleados pendientes con datos pre-poblados (monto del snapshot,
 * cuenta destino predeterminada, método sugerido) y permite editar inline
 * antes de confirmar.
 *
 * Al confirmar: dispara POST /api/nominas/pagos para cada empleado en
 * paralelo. Muestra resumen con éxitos/fallos.
 *
 * No se pide comprobante en bulk — el flujo estándar (Tango/Bejerman) es:
 * 1) confirmar pagos masivamente, 2) adjuntar el comprobante después, por
 * empleado, desde la card. La transferencia bancaria típica es un solo
 * lote, así que el mismo comprobante puede aplicarse 1×1 sin fricción.
 *
 * Visualmente: cada empleado es una "fila-card" con avatar+ring (consistente
 * con CardEmpleadoNomina), nombre + cuenta sutiles, monto en tabular grande,
 * método y cuenta en selects pulidos. Footer con total alineado al CTA.
 */

import { useEffect, useState, useMemo } from 'react'
import { Banknote, Building2, Wallet, Loader2, CheckCircle2, XCircle, Info } from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { useToast } from '@/componentes/feedback/Toast'

export interface EmpleadoPagable {
  miembro_id: string
  nombre: string
  monto_neto: number
  cuenta_destino?: {
    tipo_pago: string
    banco: string | null
    etiqueta: string | null
  } | null
}

interface CuentaUsable {
  id: string
  tipo_pago: 'banco' | 'digital'
  etiqueta: string | null
  banco: string | null
  alias: string | null
  activa: boolean
  predeterminada: boolean
}

type MetodoPago = 'efectivo' | 'transferencia' | 'cuenta_digital' | 'cheque' | 'otro'

interface EstadoFila {
  miembro_id: string
  nombre: string
  monto: string           // string para inputs de moneda
  metodoPago: MetodoPago
  cuentaId: string | null // FK a info_bancaria
  cuentas: CuentaUsable[] // opciones cargadas
  fechaPago: string
  estadoEnvio: 'pendiente' | 'enviando' | 'ok' | 'error'
  errorMensaje?: string
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  empleados: EmpleadoPagable[]
  periodoInicio: string
  periodoFin: string
  /** Callback después de terminar el batch — la vista padre refresca el período. */
  onFinalizado: () => Promise<void> | void
}

function fmtMonto(v: number): string {
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const METODOS: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'cuenta_digital', etiqueta: 'Cuenta digital' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'cheque', etiqueta: 'Cheque' },
  { valor: 'otro', etiqueta: 'Otro' },
]

// ─── Avatar con ring de color hash (mismo patrón que CardEmpleadoNomina) ───
const PALETA_RING = [
  'ring-rose-300/50',
  'ring-amber-300/50',
  'ring-emerald-300/50',
  'ring-sky-300/50',
  'ring-violet-300/50',
  'ring-fuchsia-300/50',
  'ring-teal-300/50',
  'ring-orange-300/50',
]

function colorRingPorId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return PALETA_RING[Math.abs(h) % PALETA_RING.length]
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function ModalPagarBulk({
  abierto, onCerrar, empleados, periodoInicio, periodoFin, onFinalizado,
}: Props) {
  const toast = useToast()
  const [filas, setFilas] = useState<EstadoFila[]>([])
  const [cargandoCuentas, setCargandoCuentas] = useState(true)
  const [procesando, setProcesando] = useState(false)

  // Cargar cuentas por miembro en paralelo (uno por empleado). Cada empleado
  // puede tener varias cuentas; el modal expone solo las activas.
  useEffect(() => {
    if (!abierto) return
    let cancelado = false
    setCargandoCuentas(true)

    void (async () => {
      const hoy = new Date().toISOString().slice(0, 10)
      const filasIniciales = await Promise.all(
        empleados.map(async (e): Promise<EstadoFila> => {
          let cuentas: CuentaUsable[] = []
          try {
            const res = await fetch(`/api/miembros/${e.miembro_id}/info-bancaria`)
            const data = await res.json()
            const lista = (data.cuentas ?? []) as CuentaUsable[]
            cuentas = lista.filter(c => c.activa)
          } catch { /* sin cuentas → efectivo por default */ }

          const predeterminada = cuentas.find(c => c.predeterminada) ?? cuentas[0] ?? null
          // Método sugerido: digital si la cuenta es billetera, transferencia
          // si es banco, efectivo si no hay cuenta cargada.
          const metodoSugerido: MetodoPago = predeterminada
            ? predeterminada.tipo_pago === 'digital' ? 'cuenta_digital' : 'transferencia'
            : 'efectivo'

          return {
            miembro_id: e.miembro_id,
            nombre: e.nombre,
            monto: String(Math.round(e.monto_neto)),
            metodoPago: metodoSugerido,
            cuentaId: predeterminada?.id ?? null,
            cuentas,
            fechaPago: hoy,
            estadoEnvio: 'pendiente',
          }
        }),
      )
      if (!cancelado) {
        setFilas(filasIniciales)
        setCargandoCuentas(false)
      }
    })()

    return () => { cancelado = true }
  }, [abierto, empleados])

  const totalAPagar = useMemo(
    () => filas.reduce((s, f) => s + (parseFloat(f.monto) || 0), 0),
    [filas],
  )

  const actualizarFila = (id: string, cambios: Partial<EstadoFila>) => {
    setFilas(prev => prev.map(f => f.miembro_id === id ? { ...f, ...cambios } : f))
  }

  const procesarBatch = async () => {
    setProcesando(true)
    // Marcar todas en 'enviando' antes del Promise.all para que la UI se
    // actualice de una. Los resultados se aplican uno por uno cuando
    // cada request termina.
    setFilas(prev => prev.map(f => ({ ...f, estadoEnvio: 'enviando' as const, errorMensaje: undefined })))

    const resultados = await Promise.all(filas.map(async (f) => {
      const monto = parseFloat(f.monto)
      if (!Number.isFinite(monto) || monto <= 0) {
        return { id: f.miembro_id, ok: false, mensaje: 'Monto inválido' }
      }
      // Cheque/efectivo no necesitan cuenta; transferencia/cuenta_digital sí.
      if ((f.metodoPago === 'transferencia' || f.metodoPago === 'cuenta_digital') && !f.cuentaId) {
        return { id: f.miembro_id, ok: false, mensaje: 'Sin cuenta destino' }
      }
      try {
        const res = await fetch('/api/nominas/pagos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            miembro_id: f.miembro_id,
            periodo_inicio: periodoInicio,
            periodo_fin: periodoFin,
            monto_abonado: monto,
            metodo_pago: f.metodoPago,
            fecha_pago: f.fechaPago,
            info_bancaria_id: f.cuentaId,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          return { id: f.miembro_id, ok: false, mensaje: data.error || `HTTP ${res.status}` }
        }
        return { id: f.miembro_id, ok: true }
      } catch (e) {
        return { id: f.miembro_id, ok: false, mensaje: e instanceof Error ? e.message : 'Error de red' }
      }
    }))

    // Aplicar resultados a las filas.
    setFilas(prev => prev.map(f => {
      const r = resultados.find(x => x.id === f.miembro_id)
      if (!r) return f
      return r.ok
        ? { ...f, estadoEnvio: 'ok' as const, errorMensaje: undefined }
        : { ...f, estadoEnvio: 'error' as const, errorMensaje: r.mensaje }
    }))

    const exitosos = resultados.filter(r => r.ok).length
    const fallidos = resultados.length - exitosos
    if (fallidos === 0) {
      toast.mostrar('exito', `${exitosos} pago${exitosos === 1 ? '' : 's'} registrado${exitosos === 1 ? '' : 's'}`)
    } else if (exitosos > 0) {
      toast.mostrar('advertencia', `${exitosos} OK · ${fallidos} fallaron`)
    } else {
      toast.mostrar('error', 'No se pudo registrar ningún pago')
    }

    setProcesando(false)
    await onFinalizado()
  }

  const todasOk = filas.length > 0 && filas.every(f => f.estadoEnvio === 'ok')
  const hayFallos = filas.some(f => f.estadoEnvio === 'error')
  const exitosos = filas.filter(f => f.estadoEnvio === 'ok').length

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => { if (!procesando) onCerrar() }}
      titulo={todasOk
        ? `${exitosos} pago${exitosos === 1 ? '' : 's'} registrado${exitosos === 1 ? '' : 's'}`
        : `Registrar pago · ${filas.length} ${filas.length === 1 ? 'empleado' : 'empleados'}`}
      tamano="4xl"
      accionSecundaria={{ etiqueta: todasOk ? 'Cerrar' : 'Cancelar', onClick: onCerrar }}
      accionPrimaria={todasOk ? undefined : {
        etiqueta: hayFallos ? 'Reintentar fallidos' : `Confirmar ${fmtMonto(totalAPagar)}`,
        onClick: procesarBatch,
        cargando: procesando,
        disabled: filas.length === 0 || totalAPagar <= 0,
      }}
    >
      {cargandoCuentas ? (
        <div className="flex items-center justify-center py-16 text-texto-terciario">
          <Loader2 size={20} className="animate-spin mr-2" />
          Cargando cuentas…
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Aviso del flujo: comprobante después ── */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-insignia-info/[0.06] border border-insignia-info/[0.15]">
            <Info size={13} className="text-insignia-info mt-0.5 shrink-0" />
            <p className="text-[11px] text-texto-secundario leading-relaxed">
              Confirmá el lote ahora. Después podés adjuntar el comprobante a cada empleado desde su card.
            </p>
          </div>

          {/* ── Filas ── */}
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] overflow-hidden">
            {filas.map((f, i) => (
              <FilaPagoBulk
                key={f.miembro_id}
                fila={f}
                primera={i === 0}
                actualizar={(cambios) => actualizarFila(f.miembro_id, cambios)}
                deshabilitado={procesando || f.estadoEnvio === 'ok'}
              />
            ))}
          </div>

          {/* ── Footer total ── */}
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-texto-terciario">
                {filas.length} empleado{filas.length === 1 ? '' : 's'}
              </p>
              <p className="text-[11px] text-texto-terciario">Total a pagar</p>
            </div>
            <p className="text-2xl font-bold text-insignia-exito tabular-nums leading-none">
              {fmtMonto(totalAPagar)}
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Fila individual ────────────────────────────────────────────

function FilaPagoBulk({
  fila, actualizar, deshabilitado, primera,
}: {
  fila: EstadoFila
  actualizar: (cambios: Partial<EstadoFila>) => void
  deshabilitado: boolean
  primera: boolean
}) {
  const necesitaCuenta = fila.metodoPago === 'transferencia' || fila.metodoPago === 'cuenta_digital'

  // Fondo por estado de envío. Sutil — no compite con el contenido.
  const bgEstado =
    fila.estadoEnvio === 'ok'      ? 'bg-insignia-exito/[0.04]'
    : fila.estadoEnvio === 'error' ? 'bg-insignia-peligro/[0.05]'
    : 'hover:bg-white/[0.02]'

  const ring = colorRingPorId(fila.miembro_id)

  // Texto helper a la derecha del select (tipo cuenta + banco).
  const cuentaActiva = fila.cuentaId ? fila.cuentas.find(c => c.id === fila.cuentaId) : null

  return (
    <div className={`${bgEstado} transition-colors ${!primera ? 'border-t border-white/[0.04]' : ''}`}>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_160px_180px] gap-3 items-center px-3.5 py-3">
        {/* ── Identidad ── */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 size-9 rounded-full bg-white/[0.04] ring-2 ${ring} flex items-center justify-center`}>
            <span className="text-[11px] font-semibold text-texto-secundario tracking-wider">
              {iniciales(fila.nombre)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-texto-primario truncate">{fila.nombre}</p>
              {fila.estadoEnvio === 'ok' && <CheckCircle2 size={13} className="text-insignia-exito shrink-0" />}
              {fila.estadoEnvio === 'error' && <XCircle size={13} className="text-insignia-peligro shrink-0" />}
              {fila.estadoEnvio === 'enviando' && <Loader2 size={11} className="animate-spin text-texto-terciario shrink-0" />}
            </div>
            {fila.errorMensaje ? (
              <p className="text-[10px] text-insignia-peligro mt-0.5 truncate">{fila.errorMensaje}</p>
            ) : cuentaActiva ? (
              <p className="text-[10px] text-texto-terciario truncate flex items-center gap-1">
                {cuentaActiva.tipo_pago === 'digital' ? <Wallet size={9} /> : <Building2 size={9} />}
                {cuentaActiva.etiqueta || cuentaActiva.banco || (cuentaActiva.tipo_pago === 'digital' ? 'Billetera' : 'Banco')}
                {cuentaActiva.predeterminada && <span className="text-insignia-info">★</span>}
              </p>
            ) : fila.metodoPago === 'efectivo' ? (
              <p className="text-[10px] text-texto-terciario flex items-center gap-1">
                <Banknote size={9} /> Pago en efectivo
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Monto ── */}
        <div>
          <InputMoneda
            value={fila.monto}
            onChange={(v) => actualizar({ monto: v })}
            moneda="ARS"
            placeholder="0"
          />
        </div>

        {/* ── Método ── */}
        <select
          value={fila.metodoPago}
          onChange={(e) => actualizar({ metodoPago: e.target.value as MetodoPago })}
          disabled={deshabilitado}
          className="h-9 px-2.5 rounded-lg text-sm bg-superficie-tarjeta border border-white/[0.06] text-texto-primario hover:border-white/[0.12] focus:outline-none focus:border-texto-marca/50 focus:ring-1 focus:ring-texto-marca/30 disabled:opacity-50 transition-colors"
        >
          {METODOS.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
        </select>

        {/* ── Cuenta (solo si aplica) ── */}
        {necesitaCuenta ? (
          <select
            value={fila.cuentaId ?? ''}
            onChange={(e) => actualizar({ cuentaId: e.target.value || null })}
            disabled={deshabilitado}
            className={`h-9 px-2.5 rounded-lg text-sm bg-superficie-tarjeta border text-texto-primario hover:border-white/[0.12] focus:outline-none focus:border-texto-marca/50 focus:ring-1 focus:ring-texto-marca/30 disabled:opacity-50 transition-colors ${
              !fila.cuentaId
                ? 'border-insignia-advertencia/30 text-insignia-advertencia'
                : 'border-white/[0.06]'
            }`}
          >
            <option value="">Elegir cuenta…</option>
            {fila.cuentas.map(c => (
              <option key={c.id} value={c.id}>
                {c.etiqueta || c.banco || (c.tipo_pago === 'digital' ? 'Billetera' : 'Banco')}
                {c.predeterminada ? ' ★' : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="h-9 px-2.5 flex items-center text-[11px] text-texto-terciario/70 italic">
            {fila.metodoPago === 'efectivo' ? 'No requiere cuenta' :
             fila.metodoPago === 'cheque' ? 'Físico' : '—'}
          </div>
        )}
      </div>
    </div>
  )
}

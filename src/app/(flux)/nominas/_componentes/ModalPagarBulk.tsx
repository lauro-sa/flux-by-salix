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
 * No reemplaza al modal individual del detalle del empleado — ese sigue
 * sirviendo para casos puntuales con comprobante adjunto, referencia
 * personalizada, etc. Este es el "atajo" para liquidar la pila pendiente.
 */

import { useEffect, useState, useMemo } from 'react'
import { Banknote, Building2, Wallet, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
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

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => { if (!procesando) onCerrar() }}
      titulo={todasOk ? '✓ Pagos registrados' : `Registrar pago de ${filas.length} ${filas.length === 1 ? 'empleado' : 'empleados'}`}
      tamano="3xl"
      accionSecundaria={{ etiqueta: todasOk ? 'Cerrar' : 'Cancelar', onClick: onCerrar }}
      accionPrimaria={todasOk ? undefined : {
        etiqueta: hayFallos ? 'Reintentar fallidos' : `Confirmar ${fmtMonto(totalAPagar)}`,
        onClick: procesarBatch,
        cargando: procesando,
        disabled: filas.length === 0 || totalAPagar <= 0,
      }}
    >
      {cargandoCuentas ? (
        <div className="flex items-center justify-center py-12 text-texto-terciario">
          <Loader2 size={20} className="animate-spin mr-2" />
          Cargando cuentas...
        </div>
      ) : (
        <div className="space-y-2">
          {filas.map((f) => (
            <FilaPagoBulk
              key={f.miembro_id}
              fila={f}
              actualizar={(cambios) => actualizarFila(f.miembro_id, cambios)}
              deshabilitado={procesando || f.estadoEnvio === 'ok'}
            />
          ))}

          {/* Resumen al pie */}
          <div className="mt-4 pt-3 border-t border-borde-sutil flex items-center justify-between gap-3">
            <p className="text-xs text-texto-terciario">
              {filas.length} empleado{filas.length === 1 ? '' : 's'} · Total a pagar
            </p>
            <p className="text-xl font-bold text-insignia-exito tabular-nums">
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
  fila, actualizar, deshabilitado,
}: {
  fila: EstadoFila
  actualizar: (cambios: Partial<EstadoFila>) => void
  deshabilitado: boolean
}) {
  const necesitaCuenta = fila.metodoPago === 'transferencia' || fila.metodoPago === 'cuenta_digital'

  const colorBorde = fila.estadoEnvio === 'ok' ? 'border-insignia-exito/40 bg-insignia-exito/5'
    : fila.estadoEnvio === 'error' ? 'border-insignia-peligro/40 bg-insignia-peligro/5'
    : 'border-borde-sutil bg-superficie-tarjeta'

  return (
    <div className={`rounded-card border ${colorBorde} px-3 py-2.5`}>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_180px_160px_24px] gap-2 items-center">
        {/* Nombre + estado */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-texto-primario truncate">{fila.nombre}</span>
            {fila.estadoEnvio === 'ok' && <CheckCircle2 size={14} className="text-insignia-exito" />}
            {fila.estadoEnvio === 'error' && <XCircle size={14} className="text-insignia-peligro" />}
            {fila.estadoEnvio === 'enviando' && <Loader2 size={12} className="animate-spin text-texto-terciario" />}
          </div>
          {fila.errorMensaje && (
            <p className="text-[10px] text-insignia-peligro mt-0.5">{fila.errorMensaje}</p>
          )}
        </div>

        {/* Monto */}
        <InputMoneda
          value={fila.monto}
          onChange={(v) => actualizar({ monto: v })}
          moneda="ARS"
          placeholder="0"
        />

        {/* Método */}
        <select
          value={fila.metodoPago}
          onChange={(e) => actualizar({ metodoPago: e.target.value as MetodoPago })}
          disabled={deshabilitado}
          className="h-9 px-2 rounded-lg text-sm bg-superficie-elevada border border-borde-sutil text-texto-primario disabled:opacity-50"
        >
          {METODOS.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
        </select>

        {/* Cuenta (solo si aplica) */}
        {necesitaCuenta ? (
          <select
            value={fila.cuentaId ?? ''}
            onChange={(e) => actualizar({ cuentaId: e.target.value || null })}
            disabled={deshabilitado}
            className="h-9 px-2 rounded-lg text-sm bg-superficie-elevada border border-borde-sutil text-texto-primario disabled:opacity-50"
          >
            <option value="">Sin cuenta</option>
            {fila.cuentas.map(c => (
              <option key={c.id} value={c.id}>
                {c.etiqueta || c.banco || (c.tipo_pago === 'digital' ? 'Billetera' : 'Banco')}
                {c.predeterminada ? ' ★' : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="h-9 px-2 flex items-center text-[11px] text-texto-terciario/60">
            {fila.metodoPago === 'efectivo' ? 'En mano' : '—'}
          </div>
        )}

        {/* Icono tipo cuenta destino */}
        <div className="text-texto-terciario/60 flex justify-end">
          {necesitaCuenta && fila.cuentaId && (
            fila.cuentas.find(c => c.id === fila.cuentaId)?.tipo_pago === 'digital'
              ? <Wallet size={14} />
              : <Building2 size={14} />
          )}
          {fila.metodoPago === 'efectivo' && <Banknote size={14} />}
        </div>
      </div>
    </div>
  )
}

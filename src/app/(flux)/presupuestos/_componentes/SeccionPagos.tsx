'use client'

/**
 * SeccionPagos — Lista los pagos registrados contra un presupuesto y permite
 * agregar nuevos, editar o eliminar. Muestra un resumen por cuota con su
 * estado derivado (pendiente / parcial / cobrada) y el saldo.
 *
 * Se usa en: EditorPresupuesto, dentro del bloque de detalle del presupuesto.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CreditCard, Plus, Paperclip, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { ModalRegistrarPago } from './ModalRegistrarPago'
import {
  ETIQUETAS_METODO_PAGO,
  type PresupuestoPago,
} from '@/tipos/presupuesto-pago'
import type { CuotaPago } from '@/tipos/presupuesto'

interface PropsSeccionPagos {
  presupuestoId: string
  presupuestoNumero: string
  monedaPresupuesto: string
  totalPresupuesto: number
  cuotas: CuotaPago[]
  /** Si false → solo lectura (sin botones de agregar/editar/eliminar). */
  editable: boolean
  /** Cuando cambia, fuerza recarga de pagos (lo dispara el padre cuando un
   *  pago externo — ej. modal del chatter — fue guardado). */
  recargaNonce?: number
}

export default function SeccionPagos({
  presupuestoId,
  presupuestoNumero,
  monedaPresupuesto,
  totalPresupuesto,
  cuotas,
  editable,
  recargaNonce = 0,
}: PropsSeccionPagos) {
  const { mostrar } = useToast()
  const formato = useFormato()

  const [pagos, setPagos] = useState<PresupuestoPago[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [pagoEditar, setPagoEditar] = useState<PresupuestoPago | null>(null)
  const [cuotaIdInicial, setCuotaIdInicial] = useState<string | null>(null)
  const [pagoAEliminar, setPagoAEliminar] = useState<PresupuestoPago | null>(null)

  // ─── Cargar pagos ──────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/pagos`)
      if (res.ok) {
        const data = await res.json()
        setPagos(data.pagos || [])
      }
    } catch {
      /* silencioso */
    } finally {
      setCargando(false)
    }
  }, [presupuestoId])

  useEffect(() => {
    if (presupuestoId) cargar()
  }, [presupuestoId, cargar, recargaNonce])

  // ─── Agrupar pagos por cuota (y "a cuenta") ────────────────────────────
  const pagosPorCuota = useMemo(() => {
    const grupos = new Map<string, PresupuestoPago[]>()
    for (const p of pagos) {
      const clave = p.cuota_id || '__a_cuenta__'
      const arr = grupos.get(clave) || []
      arr.push(p)
      grupos.set(clave, arr)
    }
    return grupos
  }, [pagos])

  // ─── Total cobrado (todos los pagos en moneda del presupuesto) ─────────
  const totalCobrado = useMemo(
    () => pagos.reduce((s, p) => s + Number(p.monto_en_moneda_presupuesto || 0), 0),
    [pagos]
  )

  const abrirCrear = useCallback((cuotaId: string | null) => {
    setPagoEditar(null)
    setCuotaIdInicial(cuotaId)
    setModalAbierto(true)
  }, [])

  const abrirEditar = useCallback((pago: PresupuestoPago) => {
    setPagoEditar(pago)
    setCuotaIdInicial(null)
    setModalAbierto(true)
  }, [])

  const eliminarPago = useCallback(async () => {
    if (!pagoAEliminar) return
    try {
      const res = await fetch(
        `/api/presupuestos/${presupuestoId}/pagos/${pagoAEliminar.id}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        mostrar('error', err.error || 'No se pudo eliminar el pago')
        return
      }
      mostrar('exito', 'Pago eliminado')
      setPagoAEliminar(null)
      await cargar()
    } catch {
      mostrar('error', 'Error al eliminar')
    }
  }, [pagoAEliminar, presupuestoId, mostrar, cargar])

  // ─── Render de un pago ─────────────────────────────────────────────────
  const renderPago = (p: PresupuestoPago) => {
    const monto = Number(p.monto)
    const monedaPago = p.moneda
    const tieneCotizacion = monedaPago !== monedaPresupuesto

    return (
      <div
        key={p.id}
        className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-borde-sutil bg-superficie-tarjeta hover:bg-white/[0.02] group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-texto-primario tabular-nums">
              {monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {monedaPago}
            </span>
            {tieneCotizacion && (
              <span className="text-xs text-texto-terciario">
                ≈ {Number(p.monto_en_moneda_presupuesto).toLocaleString('es-AR', {
                  maximumFractionDigits: 2,
                })}{' '}
                {monedaPresupuesto}
              </span>
            )}
            <span className="text-xs text-texto-terciario">
              · {ETIQUETAS_METODO_PAGO[p.metodo]}
            </span>
            {p.referencia && (
              <span className="text-xs text-texto-terciario">· {p.referencia}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-texto-terciario mt-0.5">
            <span>{formato.fecha(p.fecha_pago, { corta: true })}</span>
            {p.creado_por_nombre && <span>— {p.creado_por_nombre}</span>}
            {p.comprobante_url && (
              <a
                href={p.comprobante_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-texto-marca hover:underline"
              >
                <Paperclip className="size-3" />
                Comprobante
              </a>
            )}
          </div>
          {p.descripcion && (
            <p className="text-xs text-texto-secundario mt-1">{p.descripcion}</p>
          )}
        </div>

        {editable && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={() => abrirEditar(p)}
              className="size-7 rounded-boton flex items-center justify-center text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06]"
              aria-label="Editar pago"
              title="Editar"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPagoAEliminar(p)}
              className="size-7 rounded-boton flex items-center justify-center text-texto-terciario hover:text-texto-peligro hover:bg-white/[0.06]"
              aria-label="Eliminar pago"
              title="Eliminar"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─── Render de un grupo (cuota o "a cuenta") ───────────────────────────
  const renderGrupoCuota = (cuota: CuotaPago) => {
    const lista = pagosPorCuota.get(cuota.id) || []
    const totalCuota = Number(cuota.monto)
    const pagado = lista.reduce((s, p) => s + Number(p.monto_en_moneda_presupuesto || 0), 0)
    const saldo = Math.max(0, totalCuota - pagado)
    const colorEstado =
      cuota.estado === 'cobrada'
        ? 'text-insignia-exito'
        : cuota.estado === 'parcial'
          ? 'text-insignia-advertencia'
          : 'text-texto-terciario'
    const etiquetaEstado =
      cuota.estado === 'cobrada' ? 'Cobrada' : cuota.estado === 'parcial' ? 'Parcial' : 'Pendiente'

    return (
      <div key={cuota.id} className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-texto-primario">
              Cuota {cuota.numero}
              {cuota.descripcion ? ` — ${cuota.descripcion}` : ''}
            </span>
            <span className={`text-xs font-medium ${colorEstado}`}>{etiquetaEstado}</span>
          </div>
          <div className="text-xs text-texto-terciario tabular-nums">
            {pagado.toLocaleString('es-AR', { maximumFractionDigits: 2 })} /{' '}
            {totalCuota.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {monedaPresupuesto}
            {saldo > 0 && cuota.estado !== 'cobrada' && (
              <span className="ml-2 text-texto-secundario">
                · saldo {saldo.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>
        {lista.length > 0 && <div className="space-y-1.5">{lista.map(renderPago)}</div>}
        {editable && cuota.estado !== 'cobrada' && (
          <button
            type="button"
            onClick={() => abrirCrear(cuota.id)}
            className="flex items-center gap-1.5 text-xs text-texto-marca hover:underline pl-1"
          >
            <Plus className="size-3.5" /> Registrar pago
          </button>
        )}
      </div>
    )
  }

  // ─── Render principal ──────────────────────────────────────────────────
  if (cargando) return null

  // Mostramos TODAS las cuotas (incluyendo sintéticas, generadas en vivo
  // desde la condición de pago hasta que se materializan al primer pago).
  // El modal y el endpoint POST saben manejarlas.
  const cuotasVisibles = cuotas
  const pagosACuenta = pagosPorCuota.get('__a_cuenta__') || []

  // Si no hay cuotas (ni sintéticas ni reales) y no hay pagos, no mostrar
  // la sección. Caso: presupuesto sin condición de pago tipo hitos.
  if (cuotasVisibles.length === 0 && pagos.length === 0) {
    if (!editable) return null
    return (
      <div className="px-6 py-4 border-t border-borde-sutil">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-texto-terciario font-medium uppercase tracking-wider flex items-center gap-1">
            <CreditCard size={12} /> Pagos
          </span>
          <button
            type="button"
            onClick={() => abrirCrear(null)}
            className="flex items-center gap-1.5 text-xs text-texto-marca hover:underline"
          >
            <Plus className="size-3.5" /> Registrar pago
          </button>
        </div>
        <p className="text-xs text-texto-terciario">Aún no hay pagos registrados.</p>

        <ModalRegistrarPago
          abierto={modalAbierto}
          onCerrar={() => setModalAbierto(false)}
          presupuestoId={presupuestoId}
          presupuestoNumero={presupuestoNumero}
          monedaPresupuesto={monedaPresupuesto}
          totalPresupuesto={totalPresupuesto}
          cuotas={cuotasVisibles}
          pago={pagoEditar}
          cuotaIdInicial={cuotaIdInicial}
          onPagoGuardado={() => cargar()}
        />
      </div>
    )
  }

  return (
    <div className="px-6 py-4 border-t border-borde-sutil">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-texto-terciario font-medium uppercase tracking-wider flex items-center gap-1">
          <CreditCard size={12} /> Pagos
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-texto-terciario tabular-nums">
            Total cobrado:{' '}
            <strong className="text-texto-primario">
              {totalCobrado.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {monedaPresupuesto}
            </strong>
          </span>
          {editable && (
            <button
              type="button"
              onClick={() => abrirCrear(null)}
              className="flex items-center gap-1.5 text-xs text-texto-marca hover:underline"
            >
              <Plus className="size-3.5" /> Registrar pago
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {cuotasVisibles.map(renderGrupoCuota)}

        {pagosACuenta.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-texto-primario">A cuenta (sin imputar)</span>
            <div className="space-y-1.5">{pagosACuenta.map(renderPago)}</div>
          </div>
        )}
      </div>

      <ModalRegistrarPago
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        presupuestoId={presupuestoId}
        presupuestoNumero={presupuestoNumero}
        monedaPresupuesto={monedaPresupuesto}
        totalPresupuesto={totalPresupuesto}
        cuotas={cuotasVisibles}
        pago={pagoEditar}
        cuotaIdInicial={cuotaIdInicial}
        onPagoGuardado={() => cargar()}
      />

      <ModalConfirmacion
        abierto={!!pagoAEliminar}
        onCerrar={() => setPagoAEliminar(null)}
        onConfirmar={eliminarPago}
        titulo="Eliminar pago"
        descripcion={
          pagoAEliminar
            ? `¿Eliminar el pago de ${Number(pagoAEliminar.monto).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${pagoAEliminar.moneda}? Si tenía comprobante adjunto también será eliminado.`
            : ''
        }
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
      />
    </div>
  )
}

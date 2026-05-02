'use client'

/**
 * SeccionPagos — Lista los pagos registrados contra un presupuesto y permite
 * agregar nuevos, editar o eliminar. Muestra un resumen por cuota con su
 * estado derivado (pendiente / parcial / cobrada) y el saldo. También lista
 * pagos "a cuenta" y "adicionales" (entradas de dinero fuera del presupuesto).
 *
 * Se usa en: EditorPresupuesto, dentro del bloque de detalle del presupuesto.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CreditCard, Plus, Paperclip, Pencil, Trash2, Sparkles, ReceiptText, AlertCircle } from 'lucide-react'

// Métodos donde tiene sentido pedir comprobante.
const METODOS_REQUIEREN_COMPROBANTE = ['transferencia', 'deposito', 'cheque'] as const
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { ModalRegistrarPago } from './ModalRegistrarPago'
import {
  ETIQUETAS_METODO_PAGO,
  type PresupuestoPago,
} from '@/tipos/presupuesto-pago'
import type { CuotaPago, Moneda } from '@/tipos/presupuesto'
import { EstadosCuota, type EstadoCuota } from '@/tipos/cuota'
import {
  calcularResumenesCuotas,
  calcularTotalCobradoPresupuesto,
  calcularTotalAdicionales,
  TOLERANCIA_SALDO,
} from '@/lib/calculo-cuotas'

interface PropsSeccionPagos {
  presupuestoId: string
  presupuestoNumero: string
  monedaPresupuesto: string
  totalPresupuesto: number
  cuotas: CuotaPago[]
  /** Si false → solo lectura (sin botones de agregar/editar/eliminar). */
  editable: boolean
  /** Lista de monedas activas configuradas, para el selector del modal. */
  monedasDisponibles?: Moneda[]
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
  monedasDisponibles,
  recargaNonce = 0,
}: PropsSeccionPagos) {
  const { mostrar } = useToast()
  const formato = useFormato()

  const [pagos, setPagos] = useState<PresupuestoPago[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [pagoEditar, setPagoEditar] = useState<PresupuestoPago | null>(null)
  const [cuotaIdInicial, setCuotaIdInicial] = useState<string | null>(null)
  const [adicionalInicial, setAdicionalInicial] = useState(false)
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

  // ─── Agrupar pagos por destino ─────────────────────────────────────────
  // 'cuota:<id>' | '__a_cuenta__' | '__adicional__'
  const pagosPorDestino = useMemo(() => {
    const grupos = new Map<string, PresupuestoPago[]>()
    for (const p of pagos) {
      const clave = p.es_adicional
        ? '__adicional__'
        : p.cuota_id || '__a_cuenta__'
      const arr = grupos.get(clave) || []
      arr.push(p)
      grupos.set(clave, arr)
    }
    return grupos
  }, [pagos])

  // ─── Totales y resúmenes (lib unificada) ───────────────────────────────
  // calculo-cuotas.ts mantiene una sola fuente de verdad para "qué se sumó"
  // y "con qué tolerancia se considera cobrada una cuota". Antes había
  // sumas y tolerancias dispersas que podían dar resultados distintos.
  const totalCobrado = useMemo(() => calcularTotalCobradoPresupuesto(pagos), [pagos])
  const resumenesCuotas = useMemo(
    () => calcularResumenesCuotas(cuotas, pagos),
    [cuotas, pagos]
  )
  const resumenPorCuotaId = useMemo(() => {
    const m = new Map<string, (typeof resumenesCuotas)[number]>()
    for (const r of resumenesCuotas) m.set(r.cuota.id, r)
    return m
  }, [resumenesCuotas])

  const totalAdicionales = useMemo(() => calcularTotalAdicionales(pagos), [pagos])

  const abrirCrear = useCallback((cuotaId: string | null) => {
    setPagoEditar(null)
    setCuotaIdInicial(cuotaId)
    setAdicionalInicial(false)
    setModalAbierto(true)
  }, [])

  const abrirCrearAdicional = useCallback(() => {
    setPagoEditar(null)
    setCuotaIdInicial(null)
    setAdicionalInicial(true)
    setModalAbierto(true)
  }, [])

  const abrirEditar = useCallback((pago: PresupuestoPago) => {
    setPagoEditar(pago)
    setCuotaIdInicial(null)
    setAdicionalInicial(false)
    setModalAbierto(true)
  }, [])

  const eliminarPago = useCallback(async () => {
    if (!pagoAEliminar) return
    const idPago = pagoAEliminar.id
    try {
      const res = await fetch(
        `/api/presupuestos/${presupuestoId}/pagos/${idPago}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        mostrar('error', err.error || 'No se pudo eliminar el pago')
        return
      }
      setPagoAEliminar(null)
      await cargar()
      // Toast con acción "Deshacer": llama al endpoint /restaurar.
      // El soft-delete mantiene los comprobantes en Storage por 7 días, así
      // que la restauración es completa (no perdemos archivos adjuntos).
      mostrar('exito', 'Pago eliminado', {
        duracion: 6000,
        accion: {
          etiqueta: 'Deshacer',
          onClick: async () => {
            try {
              const r = await fetch(
                `/api/presupuestos/${presupuestoId}/pagos/${idPago}/restaurar`,
                { method: 'POST' }
              )
              if (!r.ok) {
                const e = await r.json().catch(() => ({}))
                mostrar('error', e.error || 'No se pudo restaurar el pago')
                return
              }
              mostrar('exito', 'Pago restaurado')
              await cargar()
            } catch {
              mostrar('error', 'Error al restaurar')
            }
          },
        },
      })
    } catch {
      mostrar('error', 'Error al eliminar')
    }
  }, [pagoAEliminar, presupuestoId, mostrar, cargar])

  // ─── Abrir comprobante en pestaña nueva pidiendo signed URL al backend ──
  // El bucket privado obliga a pasar por el endpoint /descargar; los legacy
  // públicos también pasan por acá para unificar el flujo y no exponer URLs.
  const abrirComprobante = useCallback(async (pagoId: string, comprobanteId: string) => {
    try {
      const res = await fetch(
        `/api/presupuestos/${presupuestoId}/pagos/${pagoId}/comprobantes/${comprobanteId}/descargar`,
      )
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        mostrar('error', e.error || 'No se pudo abrir el comprobante')
        return
      }
      const data = (await res.json()) as { url: string }
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch {
      mostrar('error', 'No se pudo abrir el comprobante')
    }
  }, [presupuestoId, mostrar])

  // ─── Render de un pago ─────────────────────────────────────────────────
  const renderPago = (p: PresupuestoPago) => {
    const monto = Number(p.monto)
    const percepciones = Number(p.monto_percepciones || 0)
    const monedaPago = p.moneda
    const tieneCotizacion = monedaPago !== monedaPresupuesto

    // Lista de comprobantes desde la tabla canónica. Conservamos `id` para
    // pedir la signed URL al endpoint de descarga (bucket privado).
    const comprobantes = (p.comprobantes || []).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
    }))

    return (
      <div
        key={p.id}
        className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-borde-sutil bg-superficie-tarjeta hover:bg-white/[0.02] group"
      >
        <div className="flex-1 min-w-0">
          {/* Total cobrado como dato principal (= monto al banco + percepciones).
              El desglose va una línea abajo cuando hay retenciones. */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-texto-primario tabular-nums">
              {(monto + percepciones).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {monedaPago}
            </span>
            {percepciones > 0 && (
              <span className="text-xxs text-texto-terciario">total cobrado</span>
            )}
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
          {percepciones > 0 && (
            <p className="text-xxs text-texto-terciario tabular-nums mt-0.5">
              <span>{monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {monedaPago} al banco</span>
              <span className="mx-1.5">·</span>
              <span className="text-insignia-advertencia">
                {percepciones.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {monedaPago} retenciones
              </span>
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-texto-terciario mt-0.5 flex-wrap">
            <span>{formato.fecha(p.fecha_pago, { corta: true })}</span>
            {p.creado_por_nombre && <span>— {p.creado_por_nombre}</span>}
            {comprobantes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => abrirComprobante(p.id, c.id)}
                className="flex items-center gap-1 text-texto-marca hover:underline"
                title={c.nombre}
              >
                {c.tipo === 'percepcion' ? (
                  <ReceiptText className="size-3" />
                ) : (
                  <Paperclip className="size-3" />
                )}
                {c.tipo === 'percepcion' ? 'Retención' : 'Comprobante'}
              </button>
            ))}
          </div>
          {p.es_adicional && p.concepto_adicional && (
            <p className="text-xs text-insignia-info mt-1 flex items-center gap-1">
              <Sparkles className="size-3" />
              {p.concepto_adicional}
            </p>
          )}
          {p.descripcion && (
            <p className="text-xs text-texto-secundario mt-1">{p.descripcion}</p>
          )}

          {/* Advertencia: pago por transferencia/depósito/cheque sin comprobante.
              Click → abre modal en modo edición para adjuntarlo. */}
          {editable
            && (METODOS_REQUIEREN_COMPROBANTE as readonly string[]).includes(p.metodo)
            && comprobantes.length === 0 && (
            <button
              type="button"
              onClick={() => abrirEditar(p)}
              className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-insignia-advertencia/30 bg-insignia-advertencia/10 text-xxs text-insignia-advertencia hover:bg-insignia-advertencia/15 transition-colors cursor-pointer"
              title="Agregar el comprobante de la transferencia"
            >
              <AlertCircle className="size-3" />
              Falta el comprobante
              <span className="text-texto-terciario ml-0.5">· adjuntar</span>
            </button>
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

  // ─── Render de un grupo de cuota ───────────────────────────────────────
  const renderGrupoCuota = (cuota: CuotaPago) => {
    const lista = pagosPorDestino.get(cuota.id) || []
    const resumen = resumenPorCuotaId.get(cuota.id)
    const totalCuota = resumen?.totalCuota ?? Number(cuota.monto)
    const pagado = resumen?.pagado ?? 0
    const saldo = resumen?.saldo ?? Math.max(0, totalCuota - pagado)
    // Preferimos el estado persistido por trigger (cuota.estado), pero usamos
    // el derivado por la lib como fallback si la cuota es sintética (no en BD).
    const estadoEfectivo = (cuota.estado || resumen?.estadoDerivado || EstadosCuota.PENDIENTE) as EstadoCuota
    const colorEstado =
      estadoEfectivo === EstadosCuota.COBRADA
        ? 'text-insignia-exito'
        : estadoEfectivo === EstadosCuota.PARCIAL
          ? 'text-insignia-advertencia'
          : 'text-texto-terciario'
    const etiquetaEstado =
      estadoEfectivo === EstadosCuota.COBRADA ? 'Cobrada' : estadoEfectivo === EstadosCuota.PARCIAL ? 'Parcial' : 'Pendiente'

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
            {saldo > TOLERANCIA_SALDO && estadoEfectivo !== EstadosCuota.COBRADA && (
              <span className="ml-2 text-texto-secundario">
                · saldo {saldo.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>
        {lista.length > 0 && <div className="space-y-1.5">{lista.map(renderPago)}</div>}
        {editable && estadoEfectivo !== EstadosCuota.COBRADA && (
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
  const cuotasVisibles = cuotas
  const pagosACuenta = pagosPorDestino.get('__a_cuenta__') || []
  const pagosAdicionales = pagosPorDestino.get('__adicional__') || []

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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => abrirCrear(null)}
              className="flex items-center gap-1.5 text-xs text-texto-marca hover:underline"
            >
              <Plus className="size-3.5" /> Registrar pago
            </button>
            <button
              type="button"
              onClick={abrirCrearAdicional}
              className="flex items-center gap-1.5 text-xs text-insignia-info hover:underline"
              title="Trabajo extra cobrado fuera del presupuesto"
            >
              <Sparkles className="size-3.5" /> Adicional
            </button>
          </div>
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
          adicionalInicial={adicionalInicial}
          monedasDisponibles={monedasDisponibles}
          onPagoGuardado={() => cargar()}
        />
      </div>
    )
  }

  return (
    <div className="px-6 py-4 border-t border-borde-sutil">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-xs text-texto-terciario font-medium uppercase tracking-wider flex items-center gap-1">
          <CreditCard size={12} /> Pagos
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-texto-terciario tabular-nums">
            Cobrado:{' '}
            <strong className="text-texto-primario">
              {totalCobrado.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {monedaPresupuesto}
            </strong>
            {totalAdicionales > 0 && (
              <span className="ml-2 text-insignia-info">
                + {totalAdicionales.toLocaleString('es-AR', { maximumFractionDigits: 2 })} en adicionales
              </span>
            )}
          </span>
          {editable && (
            <>
              <button
                type="button"
                onClick={() => abrirCrear(null)}
                className="flex items-center gap-1.5 text-xs text-texto-marca hover:underline"
              >
                <Plus className="size-3.5" /> Registrar pago
              </button>
              <button
                type="button"
                onClick={abrirCrearAdicional}
                className="flex items-center gap-1.5 text-xs text-insignia-info hover:underline"
                title="Trabajo extra cobrado fuera del presupuesto"
              >
                <Sparkles className="size-3.5" /> Adicional
              </button>
            </>
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

        {pagosAdicionales.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-texto-primario flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-insignia-info" />
                Adicionales
              </span>
              <span className="text-xs text-texto-terciario">
                fuera del presupuesto
              </span>
            </div>
            <div className="space-y-1.5">{pagosAdicionales.map(renderPago)}</div>
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
        adicionalInicial={adicionalInicial}
        onPagoGuardado={() => cargar()}
      />

      <ModalConfirmacion
        abierto={!!pagoAEliminar}
        onCerrar={() => setPagoAEliminar(null)}
        onConfirmar={eliminarPago}
        titulo="Eliminar pago"
        descripcion={
          pagoAEliminar
            ? `¿Eliminar el pago de ${Number(pagoAEliminar.monto).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${pagoAEliminar.moneda}? Si tenía comprobantes adjuntos también serán eliminados.`
            : ''
        }
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
      />
    </div>
  )
}

'use client'

/**
 * ModalRegistrarPago — Registrar / editar un pago contra un presupuesto.
 *
 * Decisiones de diseño:
 *  - Card de contexto prominente arriba: muestra a qué se está cobrando
 *    (cuota X de N con su saldo, o "total del presupuesto" si no hay cuotas).
 *  - Pre-relleno inteligente:
 *      · sin cuotas → monto = total del presupuesto
 *      · con cuotas → próxima con saldo > 0 (su saldo pendiente)
 *      · todas cobradas → "a cuenta", monto vacío
 *  - Monto + moneda como elemento principal abajo del header.
 *  - Resto de campos compactos en grilla 2 columnas.
 *  - Comprobante como zona discreta al final.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Paperclip, X as XIcon, MessageSquare, Info, CreditCard } from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { Lightbox } from '@/componentes/ui/Lightbox'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { formatearFechaISO } from '@/lib/formato-fecha'
import {
  METODOS_PAGO_OPCIONES,
  type MetodoPago,
  type PresupuestoPago,
} from '@/tipos/presupuesto-pago'
import type { CuotaPago } from '@/tipos/presupuesto'

interface PropsModalRegistrarPago {
  abierto: boolean
  onCerrar: () => void
  presupuestoId: string
  presupuestoNumero: string
  monedaPresupuesto: string
  totalPresupuesto: number
  cuotas: CuotaPago[]
  /** Pago existente para editar. Si null/undefined → modo crear. */
  pago?: PresupuestoPago | null
  /** Cuota preseleccionada al abrir (sobrescribe la lógica inteligente). */
  cuotaIdInicial?: string | null
  /** ID de chatter de origen (cuando se abre desde un mensaje) */
  chatterOrigenId?: string | null
  /** ID de mensaje de inbox de origen */
  mensajeOrigenId?: string | null
  onPagoGuardado?: (pago: PresupuestoPago) => void
}

interface ResumenCuota {
  cuota: CuotaPago
  pagado: number
  saldo: number
  totalCuota: number
}

function fmtMoneda(monto: number, moneda: string) {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: 2,
    }).format(monto)
  } catch {
    return `${monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${moneda}`
  }
}

export function ModalRegistrarPago({
  abierto,
  onCerrar,
  presupuestoId,
  presupuestoNumero,
  monedaPresupuesto,
  totalPresupuesto,
  cuotas,
  pago,
  cuotaIdInicial,
  chatterOrigenId,
  mensajeOrigenId,
  onPagoGuardado,
}: PropsModalRegistrarPago) {
  const { mostrar } = useToast()
  const { zonaHoraria } = useFormato()
  const inputArchivoRef = useRef<HTMLInputElement>(null)
  const modoEditar = !!pago

  // ─── Estado del formulario ─────────────────────────────────────────────
  const [cuotaId, setCuotaId] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState(monedaPresupuesto)
  const [cotizacion, setCotizacion] = useState('1')
  const [fechaPago, setFechaPago] = useState<string | null>(null)
  // Hora del pago en formato HH:MM (24h). Al abrir el modal se setea con la
  // hora actual del cliente — así un pago "cargado ahora con fecha de ayer"
  // queda al final de ayer, entre los eventos de ese día que ya ocurrieron.
  const [horaPago, setHoraPago] = useState<string | null>(null)
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [archivoPreviewUrl, setArchivoPreviewUrl] = useState<string | null>(null)
  const [comprobanteExistente, setComprobanteExistente] = useState<{ url: string; nombre: string; tipo: string | null } | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Resumen de pagos por cuota (para detectar la próxima a cobrar)
  const [resumenes, setResumenes] = useState<ResumenCuota[]>([])
  const [totalCobradoPresupuesto, setTotalCobradoPresupuesto] = useState(0)
  const [cargandoResumen, setCargandoResumen] = useState(false)

  // "Hoy" calculado en la zona horaria de la empresa — evita el bug de
  // toISOString() que devuelve UTC y a la noche en AR adelanta un día.
  const hoyISO = useMemo(() => formatearFechaISO(new Date(), zonaHoraria), [zonaHoraria])

  // Aceptamos tanto cuotas materializadas en BD como sintéticas (generadas
  // en vivo desde la condición de pago tipo "hitos" cuando todavía no se
  // cobró ninguna). El backend del POST sabe materializar las sintéticas
  // antes de imputar el primer pago.
  const cuotasUtiles = cuotas
  const tieneCuotas = cuotasUtiles.length > 0

  // ─── Cargar pagos existentes para calcular saldos ──────────────────────
  useEffect(() => {
    if (!abierto || modoEditar) return

    setCargandoResumen(true)
    fetch(`/api/presupuestos/${presupuestoId}/pagos`)
      .then((r) => r.json())
      .then((data: { pagos?: PresupuestoPago[] }) => {
        const pagos = data.pagos || []
        const totalCobrado = pagos.reduce(
          (s, p) => s + Number(p.monto_en_moneda_presupuesto || 0),
          0
        )
        setTotalCobradoPresupuesto(totalCobrado)

        const map = new Map<string, number>()
        for (const p of pagos) {
          if (!p.cuota_id) continue
          map.set(p.cuota_id, (map.get(p.cuota_id) || 0) + Number(p.monto_en_moneda_presupuesto || 0))
        }
        const lista: ResumenCuota[] = cuotasUtiles.map((c) => {
          const total = Number(c.monto)
          const pagado = map.get(c.id) || 0
          return { cuota: c, totalCuota: total, pagado, saldo: Math.max(0, total - pagado) }
        })
        setResumenes(lista)
      })
      .catch(() => {
        setResumenes([])
        setTotalCobradoPresupuesto(0)
      })
      .finally(() => setCargandoResumen(false))
  }, [abierto, modoEditar, presupuestoId, cuotasUtiles])

  const proximaCuota = useMemo<ResumenCuota | null>(
    () => resumenes.find((r) => r.saldo > 0.0001) || null,
    [resumenes]
  )

  const cuotaSeleccionada = useMemo<ResumenCuota | null>(() => {
    if (!cuotaId) return null
    return resumenes.find((r) => r.cuota.id === cuotaId) || null
  }, [cuotaId, resumenes])

  // Saldo total del presupuesto (lo que falta cobrar globalmente)
  const saldoPresupuesto = useMemo(
    () => Math.max(0, totalPresupuesto - totalCobradoPresupuesto),
    [totalPresupuesto, totalCobradoPresupuesto]
  )

  // ─── Reset al abrir ────────────────────────────────────────────────────
  useEffect(() => {
    if (!abierto) return

    if (pago) {
      setCuotaId(pago.cuota_id)
      setMonto(pago.monto)
      setMoneda(pago.moneda)
      setCotizacion(pago.cotizacion_cambio)
      setFechaPago(pago.fecha_pago.slice(0, 10))
      // Extraer HH:MM de la fecha_pago (timestamptz ISO). Si la empresa está
      // en otra zona, el cliente ya la ve convertida a su local. Simple: usar
      // la hora local del Date.
      const dp = new Date(pago.fecha_pago)
      setHoraPago(`${String(dp.getHours()).padStart(2, '0')}:${String(dp.getMinutes()).padStart(2, '0')}`)
      setMetodo(pago.metodo)
      setReferencia(pago.referencia || '')
      setDescripcion(pago.descripcion || '')
      setComprobanteExistente(
        pago.comprobante_url
          ? {
            url: pago.comprobante_url,
            nombre: pago.comprobante_nombre || 'comprobante',
            tipo: pago.comprobante_tipo || null,
          }
          : null
      )
      setArchivo(null)
      return
    }

    setMoneda(monedaPresupuesto)
    setCotizacion('1')
    setFechaPago(hoyISO)
    // Hora actual local (HH:MM)
    {
      const ahora = new Date()
      setHoraPago(`${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`)
    }
    setMetodo('transferencia')
    setReferencia('')
    setDescripcion('')
    setComprobanteExistente(null)
    setArchivo(null)
  }, [abierto, pago, monedaPresupuesto, hoyISO])

  // ─── Pre-relleno inteligente ───────────────────────────────────────────
  useEffect(() => {
    if (!abierto || modoEditar) return
    if (cargandoResumen) return

    // 1) Si el padre forzó una cuota → respetarla y pre-cargar su saldo
    if (cuotaIdInicial !== undefined && cuotaIdInicial !== null) {
      const r = resumenes.find((x) => x.cuota.id === cuotaIdInicial)
      setCuotaId(cuotaIdInicial)
      setMonto(r ? String(r.saldo) : '')
      return
    }

    // 2) Hay cuotas con saldo → próxima cuota con su saldo
    if (proximaCuota) {
      setCuotaId(proximaCuota.cuota.id)
      setMonto(String(proximaCuota.saldo))
      return
    }

    // 3) No hay cuotas → "a cuenta" del presupuesto, monto = saldo total
    if (!tieneCuotas) {
      setCuotaId(null)
      setMonto(saldoPresupuesto > 0 ? String(saldoPresupuesto) : String(totalPresupuesto))
      return
    }

    // 4) Tiene cuotas pero todas cobradas → "a cuenta", vacío
    setCuotaId(null)
    setMonto('')
  }, [
    abierto, modoEditar, cargandoResumen, cuotaIdInicial,
    proximaCuota, resumenes, tieneCuotas, totalPresupuesto, saldoPresupuesto,
  ])

  // ─── Cambio manual de cuota → re-sugerir saldo ─────────────────────────
  const cambiarCuota = useCallback(
    (nuevaCuotaId: string | null) => {
      setCuotaId(nuevaCuotaId)
      if (modoEditar) return
      if (!nuevaCuotaId) {
        setMonto(saldoPresupuesto > 0 ? String(saldoPresupuesto) : '')
        return
      }
      const r = resumenes.find((x) => x.cuota.id === nuevaCuotaId)
      if (r) setMonto(String(r.saldo > 0 ? r.saldo : r.totalCuota))
    },
    [modoEditar, resumenes, saldoPresupuesto]
  )

  // ─── Opciones del selector de cuota ────────────────────────────────────
  const opcionesCuota = useMemo(() => {
    const opciones: { valor: string; etiqueta: string }[] = [
      { valor: '__a_cuenta__', etiqueta: 'A cuenta (sin imputar)' },
    ]
    const fuente = resumenes.length > 0
      ? resumenes.map((r) => ({ cuota: r.cuota, saldo: r.saldo }))
      : cuotasUtiles.map((c) => ({ cuota: c, saldo: Number(c.monto) }))
    for (const f of fuente) {
      const c = f.cuota
      const sufijo =
        c.estado === 'cobrada'
          ? ' · cobrada'
          : f.saldo > 0
            ? ` · saldo ${fmtMoneda(f.saldo, monedaPresupuesto)}`
            : ''
      opciones.push({
        valor: c.id,
        etiqueta: `Cuota ${c.numero}${c.descripcion ? ` — ${c.descripcion}` : ''}${sufijo}`,
      })
    }
    return opciones
  }, [resumenes, cuotasUtiles, monedaPresupuesto])

  // ─── Diferencia de moneda ──────────────────────────────────────────────
  const monedaDistinta = moneda !== monedaPresupuesto
  const montoEnPresupuesto = useMemo(() => {
    const m = Number(monto) || 0
    const c = Number(cotizacion) || 1
    return m * c
  }, [monto, cotizacion])

  // ─── Manejar comprobante ───────────────────────────────────────────────
  const seleccionarArchivo = useCallback(() => inputArchivoRef.current?.click(), [])
  const onArchivoCambio = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setArchivo(f)
  }, [])
  const quitarArchivo = useCallback(() => {
    setArchivo(null)
    if (inputArchivoRef.current) inputArchivoRef.current.value = ''
  }, [])

  // URL temporal para previsualizar el archivo recién adjuntado (no es lo
  // mismo que `comprobante_url` del pago guardado — esa ya vive en Storage).
  // Liberamos la URL al cambiar de archivo o al cerrar para evitar leaks.
  useEffect(() => {
    if (!archivo) {
      setArchivoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(archivo)
    setArchivoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  // Pegar imagen/PDF desde el portapapeles → se adjunta como comprobante.
  // Funciona desde cualquier lugar del modal (incluido el textarea de
  // descripción): si el clipboard trae un archivo, lo capturamos y
  // prevenimos el paste por defecto. Si solo hay texto, deja al browser
  // pegarlo donde esté el cursor.
  useEffect(() => {
    if (!abierto || modoEditar) return
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.kind !== 'file') continue
        const f = item.getAsFile()
        if (!f) continue
        const tipo = f.type
        if (tipo.startsWith('image/') || tipo === 'application/pdf') {
          e.preventDefault()
          setArchivo(f)
          mostrar('exito', `Comprobante adjuntado${f.name ? `: ${f.name}` : ''}`)
          return
        }
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [abierto, modoEditar, mostrar])

  // ─── Guardar ───────────────────────────────────────────────────────────
  const handleGuardar = useCallback(async () => {
    const montoNum = Number(monto)
    if (!isFinite(montoNum) || montoNum <= 0) {
      mostrar('error', 'Ingresá un monto válido')
      return
    }
    if (!fechaPago) {
      mostrar('error', 'Falta la fecha del pago')
      return
    }

    // Combinar fecha + hora en ISO local. Si no hay hora (edge case), usar 00:00.
    const [hh, mm] = (horaPago || '00:00').split(':').map((n) => parseInt(n, 10) || 0)
    const fechaHoraLocal = new Date(`${fechaPago}T00:00:00`)
    fechaHoraLocal.setHours(hh, mm, 0, 0)
    const fechaPagoISO = fechaHoraLocal.toISOString()

    setGuardando(true)
    try {
      const datos = {
        cuota_id: cuotaId === '__a_cuenta__' ? null : cuotaId,
        monto: montoNum,
        moneda,
        cotizacion_cambio: Number(cotizacion) || 1,
        fecha_pago: fechaPagoISO,
        metodo,
        referencia: referencia.trim() || null,
        descripcion: descripcion.trim() || null,
        chatter_origen_id: chatterOrigenId || null,
        mensaje_origen_id: mensajeOrigenId || null,
      }

      let respuesta: Response
      if (modoEditar && pago) {
        respuesta = await fetch(`/api/presupuestos/${presupuestoId}/pagos/${pago.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
      } else if (archivo) {
        const fd = new FormData()
        fd.append('archivo', archivo)
        fd.append('datos', JSON.stringify(datos))
        respuesta = await fetch(`/api/presupuestos/${presupuestoId}/pagos`, { method: 'POST', body: fd })
      } else {
        respuesta = await fetch(`/api/presupuestos/${presupuestoId}/pagos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
      }

      if (!respuesta.ok) {
        const err = await respuesta.json().catch(() => ({}))
        mostrar('error', err.error || 'Error al guardar el pago')
        return
      }

      const pagoGuardado = await respuesta.json() as PresupuestoPago
      mostrar('exito', modoEditar ? 'Pago actualizado' : 'Pago registrado')
      onPagoGuardado?.(pagoGuardado)
      onCerrar()
    } catch {
      mostrar('error', 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }, [
    monto, fechaPago, horaPago, cuotaId, moneda, cotizacion, metodo, referencia, descripcion,
    archivo, modoEditar, pago, presupuestoId, chatterOrigenId, mensajeOrigenId,
    mostrar, onCerrar, onPagoGuardado,
  ])

  // ─── Card de contexto: contenido según el caso ─────────────────────────
  // Devuelve { titulo, detalle, montoSugerido } para la card visual del header
  const contexto = useMemo(() => {
    if (modoEditar) return null
    if (cargandoResumen) return { titulo: 'Cargando…', detalle: '', montoSugerido: 0 }

    const ref = cuotaSeleccionada || proximaCuota

    // Caso: cuota seleccionada/sugerida con saldo
    if (ref && ref.saldo > 0.0001) {
      return {
        titulo: `Cuota ${ref.cuota.numero} de ${cuotasUtiles.length}${ref.cuota.descripcion ? ` — ${ref.cuota.descripcion}` : ''}`,
        detalle: ref.pagado > 0
          ? `Saldo ${fmtMoneda(ref.saldo, monedaPresupuesto)} · ya cobrado ${fmtMoneda(ref.pagado, monedaPresupuesto)} de ${fmtMoneda(ref.totalCuota, monedaPresupuesto)}`
          : `Saldo ${fmtMoneda(ref.saldo, monedaPresupuesto)} de ${fmtMoneda(ref.totalCuota, monedaPresupuesto)}`,
        montoSugerido: ref.saldo,
      }
    }

    // Caso: cuota seleccionada pero ya cobrada
    if (ref && ref.saldo <= 0.0001) {
      return {
        titulo: `Cuota ${ref.cuota.numero}${ref.cuota.descripcion ? ` — ${ref.cuota.descripcion}` : ''}`,
        detalle: 'Esta cuota ya está cobrada — el pago se sumará igualmente',
        montoSugerido: 0,
      }
    }

    // Caso: presupuesto sin cuotas
    if (!tieneCuotas) {
      const cobrado = totalCobradoPresupuesto
      const saldo = saldoPresupuesto
      return {
        titulo: 'Pago a cuenta del presupuesto',
        detalle: cobrado > 0
          ? `Saldo ${fmtMoneda(saldo, monedaPresupuesto)} · ya cobrado ${fmtMoneda(cobrado, monedaPresupuesto)} de ${fmtMoneda(totalPresupuesto, monedaPresupuesto)}`
          : `Total a cobrar ${fmtMoneda(totalPresupuesto, monedaPresupuesto)}`,
        montoSugerido: saldo > 0 ? saldo : totalPresupuesto,
      }
    }

    // Caso: tiene cuotas pero todas cobradas → "a cuenta"
    return {
      titulo: 'Pago a cuenta',
      detalle: 'Todas las cuotas figuran cobradas. Este pago se sumará al total.',
      montoSugerido: 0,
    }
  }, [
    modoEditar, cargandoResumen, cuotaSeleccionada, proximaCuota,
    cuotasUtiles.length, monedaPresupuesto, tieneCuotas,
    totalCobradoPresupuesto, saldoPresupuesto, totalPresupuesto,
  ])

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={modoEditar ? 'Editar pago' : `Registrar pago · ${presupuestoNumero}`}
      tamano="lg"
      accionPrimaria={{
        etiqueta: modoEditar ? 'Guardar cambios' : 'Registrar pago',
        onClick: handleGuardar,
        cargando: guardando,
      }}
      accionSecundaria={{
        etiqueta: 'Cancelar',
        onClick: onCerrar,
        disabled: guardando,
      }}
    >
      <div className="space-y-3.5">
        {/* ─── Card de contexto (jerarquía 1) ────────────────────────── */}
        {!modoEditar && contexto && (
          <div className="flex items-start gap-3 px-3.5 py-3 rounded-lg border border-borde-sutil bg-superficie-tarjeta">
            <div className="size-8 rounded-full bg-insignia-exito/10 text-insignia-exito flex items-center justify-center shrink-0">
              <CreditCard className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-texto-primario leading-tight">
                {contexto.titulo}
              </p>
              {contexto.detalle && (
                <p className="text-xs text-texto-terciario mt-0.5 leading-snug">
                  {contexto.detalle}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ─── Monto + Moneda (jerarquía 2: dato principal) ──────────── */}
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label className="block text-xs text-texto-secundario mb-1">Monto</label>
            <InputMoneda value={monto} onChange={setMonto} moneda={moneda} placeholder="0,00" />
          </div>
          <div className="w-20">
            <label className="block text-xs text-texto-secundario mb-1">Moneda</label>
            <Input
              value={moneda}
              onChange={(e) => setMoneda(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="ARS"
            />
          </div>
        </div>

        {/* ─── Cotización (solo si difiere) ──────────────────────────── */}
        {monedaDistinta && (
          <div className="rounded-lg border border-texto-marca/30 bg-texto-marca/5 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Info className="size-3.5 text-texto-marca shrink-0" />
              <span className="text-xs text-texto-secundario">
                El presupuesto está en{' '}
                <strong className="text-texto-primario">{monedaPresupuesto}</strong>.
                Indicá la cotización del pago.
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-xs text-texto-secundario mb-1">
                  1 {moneda} = X {monedaPresupuesto}
                </label>
                <Input
                  value={cotizacion}
                  onChange={(e) => setCotizacion(e.target.value)}
                  tipo="number"
                  formato={null}
                  placeholder="1"
                />
              </div>
              <div className="text-xs text-texto-secundario pb-2.5">
                ≈ <strong className="text-texto-primario">
                  {fmtMoneda(montoEnPresupuesto, monedaPresupuesto)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* ─── Imputar a + Método (grilla 2 cols) ────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-texto-secundario mb-1">Imputar a</label>
            <Select
              opciones={opcionesCuota}
              valor={cuotaId === null ? '__a_cuenta__' : cuotaId}
              onChange={(v) => cambiarCuota(v === '__a_cuenta__' ? null : v)}
              placeholder="Seleccionar"
            />
          </div>
          <div>
            <label className="block text-xs text-texto-secundario mb-1">Método</label>
            <Select
              opciones={METODOS_PAGO_OPCIONES.map((m) => ({ valor: m.valor, etiqueta: m.etiqueta }))}
              valor={metodo}
              onChange={(v) => setMetodo(v as MetodoPago)}
            />
          </div>
        </div>

        {/* ─── Fecha + Hora ───────────────────────────────────────────── */}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="block text-xs text-texto-secundario mb-1">Fecha</label>
            <SelectorFecha valor={fechaPago} onChange={setFechaPago} />
          </div>
          <div className="w-24">
            <label className="block text-xs text-texto-secundario mb-1">Hora</label>
            <SelectorHora valor={horaPago} onChange={setHoraPago} />
          </div>
        </div>

        {/* ─── Referencia ────────────────────────────────────────────── */}
        <div>
          <label className="block text-xs text-texto-secundario mb-1">
            Referencia <span className="text-texto-terciario">· opcional</span>
          </label>
          <Input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder={
              metodo === 'cheque'
                ? 'N° de cheque'
                : metodo === 'transferencia' || metodo === 'deposito'
                  ? 'N° de operación'
                  : 'Referencia'
            }
          />
        </div>

        {/* ─── Descripción ───────────────────────────────────────────── */}
        <div>
          <label className="block text-xs text-texto-secundario mb-1">
            Descripción <span className="text-texto-terciario">· opcional</span>
          </label>
          <TextArea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Concepto, contexto o notas internas"
            rows={2}
          />
        </div>

        {/* ─── Comprobante (sólo modo crear) ─────────────────────────── */}
        {!modoEditar && (
          <div>
            <input
              ref={inputArchivoRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={onArchivoCambio}
              className="hidden"
            />
            {archivo && archivoPreviewUrl ? (
              <PreviewArchivo
                url={archivoPreviewUrl}
                nombre={archivo.name}
                tipo={archivo.type}
                tamanoBytes={archivo.size}
                onQuitar={quitarArchivo}
              />
            ) : (
              <button
                type="button"
                onClick={seleccionarArchivo}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-borde-sutil bg-transparent hover:bg-white/[0.03] text-xs text-texto-secundario w-full"
                title="También podés pegar una imagen o PDF (Ctrl/Cmd + V)"
              >
                <Paperclip className="size-3.5" />
                Adjuntar comprobante
                <span className="text-texto-terciario">· o pegá con ⌘V</span>
              </button>
            )}
          </div>
        )}

        {/* ─── Comprobante existente (modo editar) ───────────────────── */}
        {modoEditar && comprobanteExistente && (
          <div>
            <label className="block text-xs text-texto-secundario mb-1">Comprobante</label>
            <PreviewArchivo
              url={comprobanteExistente.url}
              nombre={comprobanteExistente.nombre}
              tipo={comprobanteExistente.tipo || ''}
            />
          </div>
        )}

        {/* ─── Origen del chatter (chip discreto) ────────────────────── */}
        {(chatterOrigenId || mensajeOrigenId) && !modoEditar && (
          <div className="flex items-center gap-1.5 text-xs text-texto-terciario pt-1">
            <MessageSquare className="size-3" />
            Vinculado al mensaje del chatter de origen
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Preview del archivo (fila compacta + lightbox al click) ─────────────
function PreviewArchivo({
  url,
  nombre,
  tipo,
  tamanoBytes,
  onQuitar,
}: {
  url: string
  nombre: string
  tipo: string
  tamanoBytes?: number
  onQuitar?: () => void
}) {
  const [lightbox, setLightbox] = useState(false)
  const esImagen = tipo.startsWith('image/')
  const esPDF = tipo === 'application/pdf' || nombre.toLowerCase().endsWith('.pdf')

  const tamano =
    tamanoBytes !== undefined
      ? tamanoBytes < 1024 * 1024
        ? `${(tamanoBytes / 1024).toFixed(0)} KB`
        : `${(tamanoBytes / 1024 / 1024).toFixed(1)} MB`
      : null

  return (
    <>
      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-borde-sutil bg-superficie-tarjeta">
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="flex items-center gap-2.5 flex-1 min-w-0 group cursor-pointer"
          title="Ver comprobante"
        >
          {/* Miniatura compacta (40x40) */}
          {esImagen ? (
            <div className="size-10 rounded border border-borde-sutil bg-black/20 overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : esPDF ? (
            <div className="size-10 rounded bg-insignia-peligro/10 text-insignia-peligro flex items-center justify-center shrink-0 text-[10px] font-semibold">
              PDF
            </div>
          ) : (
            <div className="size-10 rounded bg-white/[0.05] text-texto-terciario flex items-center justify-center shrink-0">
              <Paperclip className="size-4" />
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm text-texto-primario truncate group-hover:text-texto-marca transition-colors">
              {nombre}
            </p>
            <p className="text-xxs text-texto-terciario">
              {tamano ? `${tamano} · ` : ''}Click para ver
            </p>
          </div>
        </button>
        {onQuitar && (
          <button
            type="button"
            onClick={onQuitar}
            className="size-7 rounded-boton flex items-center justify-center text-texto-terciario hover:text-texto-peligro hover:bg-white/[0.06] shrink-0"
            aria-label="Quitar archivo"
            title="Quitar"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      {lightbox && (
        <Lightbox
          url={url}
          nombre={nombre}
          tipo={tipo}
          onCerrar={() => setLightbox(false)}
        />
      )}
    </>
  )
}


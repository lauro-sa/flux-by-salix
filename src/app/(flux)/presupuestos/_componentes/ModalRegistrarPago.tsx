'use client'

/**
 * ModalRegistrarPago — Registro y edición de pagos contra un presupuesto.
 *
 * Diseño visual orientado a guiar al usuario por las distintas situaciones:
 *   1. Card de contexto con progreso de cobro del presupuesto.
 *   2. Imputación como tarjetas seleccionables (no dropdown). Una por cuota,
 *      "Pagaron el total" cuando hay 2+ cuotas, "A cuenta", y "Adicional".
 *   3. Calculadora de montos: muestra Te llegó + Percepciones = Total cobrado
 *      con indicador ✓/⚠ contra el saldo esperado. Popover "Calcular" para
 *      casos donde sólo conocés el bruto y la net que llegó al banco.
 *   4. Detalles compactos (método/fecha/hora/referencia).
 *   5. Drop zone de comprobantes con dos tipos (pago/percepciones).
 *   6. Descripción opcional colapsada como "Agregar nota".
 *
 * Pagaron el total con N cuotas: el modal envía N POSTs secuenciales,
 * uno por cuota pendiente, repartiendo monto y percepciones proporcional
 * al saldo de cada cuota. Cada cuota se marca como cobrada por el trigger
 * `recalcular_estado_cuota`, y el presupuesto auto-pasa a `completado`.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Paperclip, MessageSquare, CreditCard, Trash2, ReceiptText, Sparkles,
  Check, AlertCircle, Calculator, Upload, Mail, FileText, Image as ImageIcon,
} from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { Lightbox } from '@/componentes/ui/Lightbox'
import { Popover } from '@/componentes/ui/Popover'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { formatearFechaISO } from '@/lib/formato-fecha'
import {
  ETIQUETAS_METODO_PAGO,
  METODOS_PAGO_OPCIONES,
  type MetodoPago,
  type PresupuestoPago,
  type PresupuestoPagoComprobante,
  type TipoComprobantePago,
} from '@/tipos/presupuesto-pago'
import type { CuotaPago, Moneda } from '@/tipos/presupuesto'
import type { AdjuntoChatter } from '@/tipos/chatter'
import {
  calcularResumenesCuotas,
  calcularTotalCobradoPresupuesto,
  calcularSaldoPresupuesto,
  TOLERANCIA_SALDO,
  type ResumenCuota as ResumenCuotaLib,
} from '@/lib/calculo-cuotas'

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
  /** Si true, abrir como adicional (sobrescribe lógica de cuota). */
  adicionalInicial?: boolean
  /** Monedas activas configuradas en la empresa (config_presupuestos.monedas).
   *  Si viene poblada se usa un Select; si está vacía o undefined, fallback
   *  a Input texto libre por compat. */
  monedasDisponibles?: Moneda[]
  /** ID de chatter de origen (cuando se abre desde un mensaje) */
  chatterOrigenId?: string | null
  /** ID de mensaje de inbox de origen */
  mensajeOrigenId?: string | null
  /** Adjuntos del mensaje/correo de origen — el usuario puede tildar
   *  cuáles tomar como comprobante del pago en lugar de re-subir archivos. */
  adjuntosOrigen?: AdjuntoChatter[]
  /** Texto descriptivo del origen para el card del selector
   *  (ej: "correo de Romina Fraiese"). */
  origenDescripcion?: string | null
  /** Callback al guardar exitoso. En "Pagaron el total" multi-cuota
   *  se llama una sola vez (sin pago concreto) tras crear todos los pagos. */
  onPagoGuardado?: (pago?: PresupuestoPago) => void
}

// Alias del tipo de la lib unificada para mantener legibilidad en el modal.
type ResumenCuota = ResumenCuotaLib

// Valores especiales del state "imputacion"
const VALOR_A_CUENTA = '__a_cuenta__'
const VALOR_TOTAL = '__total__'
const VALOR_ADICIONAL = '__adicional__'

interface ArchivoLocal {
  id: string
  file: File
  tipo: TipoComprobantePago
  previewUrl: string
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

// Redondeo a 2 decimales para distribuir montos sin perder centavos
function r2(n: number) {
  return Math.round(n * 100) / 100
}

// Métodos donde no tiene sentido cobrar sin un respaldo documental.
// Coincide con el chequeo de SeccionPagos para que el usuario reciba el mismo
// criterio en ambos lugares.
const METODOS_REQUIEREN_COMPROBANTE: ReadonlySet<MetodoPago> = new Set([
  'transferencia',
  'deposito',
  'cheque',
])

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
  adicionalInicial,
  monedasDisponibles,
  chatterOrigenId,
  mensajeOrigenId,
  adjuntosOrigen,
  origenDescripcion,
  onPagoGuardado,
}: PropsModalRegistrarPago) {
  const { mostrar } = useToast()
  const { zonaHoraria } = useFormato()
  const inputArchivoRef = useRef<HTMLInputElement>(null)
  const inputArchivoEdicionRef = useRef<HTMLInputElement>(null)
  const dropzoneRef = useRef<HTMLDivElement>(null)
  const modoEditar = !!pago

  // ─── Estado del formulario ─────────────────────────────────────────────
  const [imputacion, setImputacion] = useState<string>(VALOR_A_CUENTA)
  const [monto, setMonto] = useState('')
  const [montoPercepciones, setMontoPercepciones] = useState('')
  const [moneda, setMoneda] = useState(monedaPresupuesto)
  const [cotizacion, setCotizacion] = useState('1')
  const [fechaPago, setFechaPago] = useState<string | null>(null)
  const [horaPago, setHoraPago] = useState<string | null>(null)
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [conceptoAdicional, setConceptoAdicional] = useState('')
  const [mostrarNotas, setMostrarNotas] = useState(false)
  const [tipoSiguienteArchivo, setTipoSiguienteArchivo] = useState<TipoComprobantePago>('comprobante')
  const [arrastrando, setArrastrando] = useState(false)

  const [archivosLocales, setArchivosLocales] = useState<ArchivoLocal[]>([])
  const [comprobantesExistentes, setComprobantesExistentes] = useState<PresupuestoPagoComprobante[]>([])
  // Tipo elegido por adjunto del correo origen (si la entrada está, está
  // tildado y se sube como ese tipo; si no, no se incluye).
  const [tiposAdjuntosOrigen, setTiposAdjuntosOrigen] = useState<Record<number, TipoComprobantePago>>({})
  // URLs firmadas de los comprobantes existentes (bucket privado obliga a
  // pasar por el endpoint /descargar). Se llenan al cargar el pago en modo
  // editar. Las URLs duran 5 min — al expirar se vuelven a firmar al next render.
  const [urlsFirmadas, setUrlsFirmadas] = useState<Record<string, string>>({})

  const [guardando, setGuardando] = useState(false)
  const [subiendoExtra, setSubiendoExtra] = useState(false)

  const [resumenes, setResumenes] = useState<ResumenCuota[]>([])
  const [totalCobradoPresupuesto, setTotalCobradoPresupuesto] = useState(0)
  const [cargandoResumen, setCargandoResumen] = useState(false)

  const esAdicional = imputacion === VALOR_ADICIONAL
  const esACuenta = imputacion === VALOR_A_CUENTA
  const esTotal = imputacion === VALOR_TOTAL
  const cuotaIdSeleccionada = (esAdicional || esACuenta || esTotal) ? null : imputacion

  const hoyISO = useMemo(() => formatearFechaISO(new Date(), zonaHoraria), [zonaHoraria])
  const cuotasUtiles = cuotas
  const tieneCuotas = cuotasUtiles.length > 0
  const hayMultiplesCuotas = cuotasUtiles.length > 1

  // ─── Cargar pagos existentes para calcular saldos ──────────────────────
  useEffect(() => {
    if (!abierto || modoEditar) return

    setCargandoResumen(true)
    fetch(`/api/presupuestos/${presupuestoId}/pagos`)
      .then((r) => r.json())
      .then((data: { pagos?: PresupuestoPago[] }) => {
        const pagos = data.pagos || []
        // Lib unificada: misma lógica que SeccionPagos y backend (excluye
        // adicionales, suma monto_en_moneda_presupuesto, tolerancia 0.01).
        setTotalCobradoPresupuesto(calcularTotalCobradoPresupuesto(pagos))
        setResumenes(calcularResumenesCuotas(cuotasUtiles, pagos))
      })
      .catch(() => {
        setResumenes([])
        setTotalCobradoPresupuesto(0)
      })
      .finally(() => setCargandoResumen(false))
  }, [abierto, modoEditar, presupuestoId, cuotasUtiles])

  const proximaCuota = useMemo<ResumenCuota | null>(
    () => resumenes.find((r) => r.saldo > TOLERANCIA_SALDO) || null,
    [resumenes]
  )

  const cuotaSeleccionada = useMemo<ResumenCuota | null>(() => {
    if (!cuotaIdSeleccionada) return null
    return resumenes.find((r) => r.cuota.id === cuotaIdSeleccionada) || null
  }, [cuotaIdSeleccionada, resumenes])

  const saldoPresupuesto = useMemo(
    () => calcularSaldoPresupuesto(totalPresupuesto, totalCobradoPresupuesto),
    [totalPresupuesto, totalCobradoPresupuesto]
  )

  // Aviso visual: el método elegido suele requerir respaldo documental
  // (transferencia / depósito / cheque) y aún no se adjuntó ningún comprobante
  // de tipo 'comprobante'. Las percepciones no sustituyen al comprobante.
  // No bloquea el guardado; solo marca al usuario antes de confirmar.
  const faltaComprobantePago = useMemo(() => {
    if (!METODOS_REQUIEREN_COMPROBANTE.has(metodo)) return false
    const tieneNuevo = archivosLocales.some((a) => a.tipo === 'comprobante')
    const tieneExistente = comprobantesExistentes.some((c) => c.tipo === 'comprobante')
    const tieneDesdeCorreo = Object.values(tiposAdjuntosOrigen).some((t) => t === 'comprobante')
    return !tieneNuevo && !tieneExistente && !tieneDesdeCorreo
  }, [metodo, archivosLocales, comprobantesExistentes, tiposAdjuntosOrigen])

  const porcentajeCobrado = useMemo(() => {
    if (totalPresupuesto <= 0) return 0
    return Math.min(100, (totalCobradoPresupuesto / totalPresupuesto) * 100)
  }, [totalCobradoPresupuesto, totalPresupuesto])

  // ─── Reset al abrir ────────────────────────────────────────────────────
  useEffect(() => {
    if (!abierto) return

    if (pago) {
      setImputacion(
        pago.es_adicional
          ? VALOR_ADICIONAL
          : pago.cuota_id || VALOR_A_CUENTA
      )
      setMonto(pago.monto)
      setMontoPercepciones(
        Number(pago.monto_percepciones || 0) > 0 ? String(pago.monto_percepciones) : ''
      )
      setMoneda(pago.moneda)
      setCotizacion(pago.cotizacion_cambio)
      setFechaPago(pago.fecha_pago.slice(0, 10))
      const dp = new Date(pago.fecha_pago)
      setHoraPago(`${String(dp.getHours()).padStart(2, '0')}:${String(dp.getMinutes()).padStart(2, '0')}`)
      setMetodo(pago.metodo)
      setReferencia(pago.referencia || '')
      setDescripcion(pago.descripcion || '')
      setMostrarNotas(!!pago.descripcion)
      setConceptoAdicional(pago.concepto_adicional || '')
      setComprobantesExistentes(pago.comprobantes || [])
      setArchivosLocales([])
      return
    }

    setMoneda(monedaPresupuesto)
    setCotizacion('1')
    setFechaPago(hoyISO)
    {
      const ahora = new Date()
      setHoraPago(`${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`)
    }
    setMetodo('transferencia')
    setReferencia('')
    setDescripcion('')
    setMostrarNotas(false)
    setConceptoAdicional('')
    setMontoPercepciones('')
    setComprobantesExistentes([])
    setArchivosLocales([])
    setTipoSiguienteArchivo('comprobante')

    // Pre-selección de adjuntos del correo origen: si solo hay 1 archivo
    // pdf/imagen, lo marcamos como comprobante automáticamente. Con varios,
    // el usuario tildará a mano para evitar adjuntar firmas/anexos.
    const seleccionInicial: Record<number, TipoComprobantePago> = {}
    if (adjuntosOrigen && adjuntosOrigen.length === 1) {
      const a = adjuntosOrigen[0]
      if (a.tipo.startsWith('image/') || a.tipo === 'application/pdf') {
        seleccionInicial[0] = 'comprobante'
      }
    }
    setTiposAdjuntosOrigen(seleccionInicial)
  }, [abierto, pago, monedaPresupuesto, hoyISO, adjuntosOrigen])

  // ─── Firmar URLs de comprobantes existentes ────────────────────────────
  // Bucket privado: las URLs en BD están vacías para comprobantes nuevos.
  // Resolvemos cada uno via /descargar (signed URL temporal). Para los
  // legacy del bucket público también pasa por el endpoint para unificar.
  useEffect(() => {
    if (!abierto || comprobantesExistentes.length === 0) return
    let cancelado = false
    const faltantes = comprobantesExistentes.filter((c) => !urlsFirmadas[c.id])
    if (faltantes.length === 0) return

    Promise.all(
      faltantes.map(async (c) => {
        try {
          const res = await fetch(
            `/api/presupuestos/${presupuestoId}/pagos/${c.pago_id}/comprobantes/${c.id}/descargar`,
          )
          if (!res.ok) return [c.id, ''] as const
          const data = (await res.json()) as { url: string }
          return [c.id, data.url] as const
        } catch {
          return [c.id, ''] as const
        }
      }),
    ).then((pares) => {
      if (cancelado) return
      setUrlsFirmadas((prev) => {
        const next = { ...prev }
        for (const [id, url] of pares) if (url) next[id] = url
        return next
      })
    })

    return () => {
      cancelado = true
    }
  }, [abierto, comprobantesExistentes, presupuestoId, urlsFirmadas])

  // ─── Pre-relleno inteligente al crear ──────────────────────────────────
  useEffect(() => {
    if (!abierto || modoEditar) return
    if (cargandoResumen) return

    if (adicionalInicial) {
      setImputacion(VALOR_ADICIONAL)
      setMonto('')
      return
    }

    if (cuotaIdInicial !== undefined && cuotaIdInicial !== null) {
      const r = resumenes.find((x) => x.cuota.id === cuotaIdInicial)
      setImputacion(cuotaIdInicial)
      setMonto(r ? String(r.saldo) : '')
      return
    }

    if (proximaCuota) {
      setImputacion(proximaCuota.cuota.id)
      setMonto(String(proximaCuota.saldo))
      return
    }

    if (!tieneCuotas) {
      setImputacion(VALOR_A_CUENTA)
      setMonto(saldoPresupuesto > 0 ? String(saldoPresupuesto) : String(totalPresupuesto))
      return
    }

    setImputacion(VALOR_A_CUENTA)
    setMonto('')
  }, [
    abierto, modoEditar, cargandoResumen, cuotaIdInicial, adicionalInicial,
    proximaCuota, resumenes, tieneCuotas, totalPresupuesto, saldoPresupuesto,
  ])

  // ─── Cambio manual de imputación → re-sugerir saldo ────────────────────
  const cambiarImputacion = useCallback(
    (nuevoValor: string) => {
      setImputacion(nuevoValor)
      if (modoEditar) return

      if (nuevoValor === VALOR_ADICIONAL) {
        setMonto('')
        setMontoPercepciones('')
        return
      }
      if (nuevoValor === VALOR_TOTAL) {
        setMonto(saldoPresupuesto > 0 ? String(saldoPresupuesto) : String(totalPresupuesto))
        return
      }
      if (nuevoValor === VALOR_A_CUENTA) {
        setMonto(saldoPresupuesto > 0 ? String(saldoPresupuesto) : '')
        return
      }
      const r = resumenes.find((x) => x.cuota.id === nuevoValor)
      if (r) setMonto(String(r.saldo > 0 ? r.saldo : r.totalCuota))
    },
    [modoEditar, resumenes, saldoPresupuesto, totalPresupuesto]
  )

  // ─── Cálculos derivados ────────────────────────────────────────────────
  const monedaDistinta = moneda !== monedaPresupuesto

  const montoNum = Number(monto) || 0
  const percepNum = Number(montoPercepciones) || 0
  const totalCobrado = montoNum + percepNum
  const cotizacionNum = Number(cotizacion) || 1
  const totalEnMonedaPresupuesto = totalCobrado * cotizacionNum

  // Saldo esperado según la imputación seleccionada (sin contar este pago en edición)
  const saldoEsperado = useMemo(() => {
    if (modoEditar) return null
    if (esAdicional) return null
    if (esTotal) return saldoPresupuesto > 0 ? saldoPresupuesto : totalPresupuesto
    if (esACuenta) return saldoPresupuesto
    if (cuotaSeleccionada) return cuotaSeleccionada.saldo > 0 ? cuotaSeleccionada.saldo : cuotaSeleccionada.totalCuota
    return null
  }, [modoEditar, esAdicional, esTotal, esACuenta, cuotaSeleccionada, saldoPresupuesto, totalPresupuesto])

  // ¿El total cobrado matchea el saldo esperado? Tolerancia 1 centavo.
  const matchSaldo = useMemo(() => {
    if (saldoEsperado === null || totalCobrado <= 0) return null
    const diff = Math.abs(totalEnMonedaPresupuesto - saldoEsperado)
    if (diff < 0.01) return 'exacto' as const
    if (totalEnMonedaPresupuesto < saldoEsperado) return 'menos' as const
    return 'mas' as const
  }, [saldoEsperado, totalCobrado, totalEnMonedaPresupuesto])

  // ─── Manejo de archivos en modo crear ──────────────────────────────────
  const agregarArchivos = useCallback(
    (files: FileList | File[], tipo: TipoComprobantePago) => {
      const arr = Array.from(files)
      if (arr.length === 0) return
      setArchivosLocales((prev) => [
        ...prev,
        ...arr.map((f) => ({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          file: f,
          tipo,
          previewUrl: URL.createObjectURL(f),
        })),
      ])
    },
    []
  )

  const seleccionarArchivo = useCallback((tipo: TipoComprobantePago) => {
    setTipoSiguienteArchivo(tipo)
    inputArchivoRef.current?.click()
  }, [])

  const onArchivoCambio = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) agregarArchivos(e.target.files, tipoSiguienteArchivo)
    if (e.target) e.target.value = ''
  }, [agregarArchivos, tipoSiguienteArchivo])

  const quitarArchivoLocal = useCallback((id: string) => {
    setArchivosLocales((prev) => {
      const f = prev.find((x) => x.id === id)
      if (f) URL.revokeObjectURL(f.previewUrl)
      return prev.filter((x) => x.id !== id)
    })
  }, [])

  // ─── Drag and drop sobre el dropzone ───────────────────────────────────
  useEffect(() => {
    const node = dropzoneRef.current
    if (!node || !abierto || modoEditar) return

    const enter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setArrastrando(true)
    }
    const leave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Sólo desactivar si salimos del dropzone (no de un hijo)
      if (e.target === node) setArrastrando(false)
    }
    const over = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setArrastrando(true)
    }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setArrastrando(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        agregarArchivos(files, tipoSiguienteArchivo)
      }
    }
    node.addEventListener('dragenter', enter)
    node.addEventListener('dragleave', leave)
    node.addEventListener('dragover', over)
    node.addEventListener('drop', drop)
    return () => {
      node.removeEventListener('dragenter', enter)
      node.removeEventListener('dragleave', leave)
      node.removeEventListener('dragover', over)
      node.removeEventListener('drop', drop)
    }
  }, [abierto, modoEditar, agregarArchivos, tipoSiguienteArchivo])

  // Limpiar URLs de preview al cerrar
  useEffect(() => {
    if (!abierto) {
      archivosLocales.forEach((a) => URL.revokeObjectURL(a.previewUrl))
    }
    return () => {
      archivosLocales.forEach((a) => URL.revokeObjectURL(a.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Pegar imagen/PDF desde el portapapeles
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
          agregarArchivos([f], tipoSiguienteArchivo)
          mostrar('exito', `Comprobante adjuntado${f.name ? `: ${f.name}` : ''}`)
          return
        }
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [abierto, modoEditar, agregarArchivos, mostrar, tipoSiguienteArchivo])

  // ─── Acciones en modo edición sobre comprobantes existentes ────────────
  const eliminarComprobanteExistente = useCallback(
    async (comprobanteId: string) => {
      if (!pago) return
      try {
        const res = await fetch(
          `/api/presupuestos/${presupuestoId}/pagos/${pago.id}/comprobantes/${comprobanteId}`,
          { method: 'DELETE' }
        )
        if (!res.ok) {
          mostrar('error', 'No se pudo eliminar el comprobante')
          return
        }
        setComprobantesExistentes((prev) => prev.filter((c) => c.id !== comprobanteId))
        mostrar('exito', 'Comprobante eliminado')
      } catch {
        mostrar('error', 'Error al eliminar')
      }
    },
    [pago, presupuestoId, mostrar]
  )

  const onArchivoEdicionCambio = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (e.target) e.target.value = ''
      if (files.length === 0 || !pago) return

      setSubiendoExtra(true)
      try {
        const fd = new FormData()
        for (const f of files) fd.append('archivos', f)
        fd.append('tipos_archivos', JSON.stringify(files.map(() => tipoSiguienteArchivo)))

        const res = await fetch(
          `/api/presupuestos/${presupuestoId}/pagos/${pago.id}/comprobantes`,
          { method: 'POST', body: fd }
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          mostrar('error', err.error || 'No se pudo subir el comprobante')
          return
        }
        const data = await res.json() as { comprobantes: PresupuestoPagoComprobante[] }
        setComprobantesExistentes((prev) => [...prev, ...data.comprobantes])
        mostrar('exito', files.length > 1 ? 'Comprobantes agregados' : 'Comprobante agregado')
      } catch {
        mostrar('error', 'Error al subir')
      } finally {
        setSubiendoExtra(false)
      }
    },
    [pago, presupuestoId, mostrar, tipoSiguienteArchivo]
  )

  const seleccionarArchivoEdicion = useCallback((tipo: TipoComprobantePago) => {
    setTipoSiguienteArchivo(tipo)
    inputArchivoEdicionRef.current?.click()
  }, [])

  // ─── Descargar adjuntos del correo origen ──────────────────────────────
  // Toma cada adjunto tildado, hace fetch al storage del correo y lo
  // convierte en un File propio del pago. Esto desacopla el pago del correo:
  // si después se borra el correo, el comprobante sobrevive en el bucket
  // 'comprobantes-pago' del pago.
  const descargarAdjuntosOrigen = useCallback(async (): Promise<{ archivo: File; tipo: TipoComprobantePago }[]> => {
    if (!adjuntosOrigen || adjuntosOrigen.length === 0) return []
    const indices = Object.keys(tiposAdjuntosOrigen).map((k) => Number(k)).filter((i) => !!tiposAdjuntosOrigen[i])
    if (indices.length === 0) return []

    const resultado: { archivo: File; tipo: TipoComprobantePago }[] = []
    for (const idx of indices) {
      const adj = adjuntosOrigen[idx]
      if (!adj?.url) continue
      try {
        const res = await fetch(adj.url)
        if (!res.ok) continue
        const blob = await res.blob()
        const file = new File([blob], adj.nombre, { type: adj.tipo || blob.type })
        resultado.push({ archivo: file, tipo: tiposAdjuntosOrigen[idx] })
      } catch {
        // Si falla un adjunto puntual seguimos con el resto en lugar de abortar
        // — el toast final igualmente avisará si quedó sin comprobante.
      }
    }
    return resultado
  }, [adjuntosOrigen, tiposAdjuntosOrigen])

  // ─── Guardar ───────────────────────────────────────────────────────────
  const handleGuardar = useCallback(async () => {
    if (!isFinite(montoNum) || montoNum <= 0) {
      mostrar('error', 'Ingresá un monto válido')
      return
    }
    if (!isFinite(percepNum) || percepNum < 0) {
      mostrar('error', 'Las percepciones no pueden ser negativas')
      return
    }
    if (!fechaPago) {
      mostrar('error', 'Falta la fecha del pago')
      return
    }
    if (esAdicional && !conceptoAdicional.trim()) {
      mostrar('error', 'Indicá un concepto para el adicional')
      return
    }

    const [hh, mm] = (horaPago || '00:00').split(':').map((n) => parseInt(n, 10) || 0)
    const fechaHoraLocal = new Date(`${fechaPago}T00:00:00`)
    fechaHoraLocal.setHours(hh, mm, 0, 0)
    const fechaPagoISO = fechaHoraLocal.toISOString()

    setGuardando(true)
    try {
      // ──────────────────────────────────────────────────────────────────
      // FLUJO 1: Modo editar — un solo PATCH
      // ──────────────────────────────────────────────────────────────────
      if (modoEditar && pago) {
        const datos = {
          cuota_id: cuotaIdSeleccionada,
          monto: montoNum,
          monto_percepciones: percepNum,
          moneda,
          cotizacion_cambio: cotizacionNum,
          fecha_pago: fechaPagoISO,
          metodo,
          referencia: referencia.trim() || null,
          descripcion: descripcion.trim() || null,
          es_adicional: esAdicional,
          concepto_adicional: esAdicional ? conceptoAdicional.trim() : null,
        }
        const respuesta = await fetch(`/api/presupuestos/${presupuestoId}/pagos/${pago.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
        if (!respuesta.ok) {
          const err = await respuesta.json().catch(() => ({}))
          mostrar('error', err.error || 'Error al guardar el pago')
          return
        }
        const pagoGuardado = await respuesta.json() as PresupuestoPago
        mostrar('exito', 'Pago actualizado')
        onPagoGuardado?.(pagoGuardado)
        onCerrar()
        return
      }

      // Descarga del/los adjunto(s) elegidos del correo origen — se hace
      // una sola vez antes de los POST (incluso si son N pagos en el flujo
      // "total"). Cada blob descargado se trata como un archivo local más.
      const adjuntosDelCorreo = await descargarAdjuntosOrigen()
      const archivosCombinados: { archivo: File; tipo: TipoComprobantePago }[] = [
        ...archivosLocales.map((a) => ({ archivo: a.file, tipo: a.tipo })),
        ...adjuntosDelCorreo,
      ]

      // ──────────────────────────────────────────────────────────────────
      // FLUJO 2: "Pagaron el total" con 2+ cuotas pendientes
      // → genera N pagos imputados a las cuotas con saldo, distribuyendo
      //   monto y percepciones proporcionalmente al saldo de cada cuota.
      //   Comprobantes adjuntos al primer pago.
      // ──────────────────────────────────────────────────────────────────
      const cuotasConSaldo = resumenes.filter((r) => r.saldo > TOLERANCIA_SALDO)
      const expandirTotal = esTotal && hayMultiplesCuotas && cuotasConSaldo.length > 1

      if (expandirTotal) {
        const saldoTotal = cuotasConSaldo.reduce((s, r) => s + r.saldo, 0)

        // Distribución proporcional con redondeo. La última cuota se lleva
        // el remainder para evitar centavos perdidos.
        const distribucion: { cuota_id: string; monto: number; percep: number }[] = []
        let acumMonto = 0
        let acumPercep = 0
        for (let i = 0; i < cuotasConSaldo.length; i++) {
          const r = cuotasConSaldo[i]
          let m: number
          let p: number
          if (i === cuotasConSaldo.length - 1) {
            m = r2(montoNum - acumMonto)
            p = r2(percepNum - acumPercep)
          } else {
            const factor = r.saldo / saldoTotal
            m = r2(montoNum * factor)
            p = r2(percepNum * factor)
            acumMonto += m
            acumPercep += p
          }
          distribucion.push({ cuota_id: r.cuota.id, monto: m, percep: p })
        }

        for (let i = 0; i < distribucion.length; i++) {
          const item = distribucion[i]
          const datos = {
            cuota_id: item.cuota_id,
            monto: item.monto,
            monto_percepciones: item.percep,
            moneda,
            cotizacion_cambio: cotizacionNum,
            fecha_pago: fechaPagoISO,
            metodo,
            referencia: referencia.trim() || null,
            descripcion: descripcion.trim() || null,
            es_adicional: false,
            concepto_adicional: null,
            chatter_origen_id: chatterOrigenId || null,
            mensaje_origen_id: mensajeOrigenId || null,
          }
          let respuesta: Response
          // Sólo el primer pago lleva comprobantes (para evitar duplicar archivos)
          if (i === 0 && archivosCombinados.length > 0) {
            const fd = new FormData()
            for (const a of archivosCombinados) fd.append('archivos', a.archivo)
            fd.append('tipos_archivos', JSON.stringify(archivosCombinados.map((a) => a.tipo)))
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
            mostrar('error', err.error || `Error al guardar la cuota ${i + 1}`)
            return
          }
        }
        mostrar('exito', 'Pago total registrado en todas las cuotas')
        onPagoGuardado?.()
        onCerrar()
        return
      }

      // ──────────────────────────────────────────────────────────────────
      // FLUJO 3: Pago simple — un POST
      // ──────────────────────────────────────────────────────────────────
      const datos = {
        cuota_id: cuotaIdSeleccionada,
        monto: montoNum,
        monto_percepciones: percepNum,
        moneda,
        cotizacion_cambio: cotizacionNum,
        fecha_pago: fechaPagoISO,
        metodo,
        referencia: referencia.trim() || null,
        descripcion: descripcion.trim() || null,
        es_adicional: esAdicional,
        concepto_adicional: esAdicional ? conceptoAdicional.trim() : null,
        chatter_origen_id: chatterOrigenId || null,
        mensaje_origen_id: mensajeOrigenId || null,
      }
      let respuesta: Response
      if (archivosCombinados.length > 0) {
        const fd = new FormData()
        for (const a of archivosCombinados) fd.append('archivos', a.archivo)
        fd.append('tipos_archivos', JSON.stringify(archivosCombinados.map((a) => a.tipo)))
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
      mostrar('exito', esAdicional ? 'Adicional registrado' : 'Pago registrado')
      onPagoGuardado?.(pagoGuardado)
      onCerrar()
    } catch {
      mostrar('error', 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }, [
    montoNum, percepNum, fechaPago, horaPago, cuotaIdSeleccionada, moneda, cotizacionNum, metodo,
    referencia, descripcion, esAdicional, conceptoAdicional, esTotal, hayMultiplesCuotas, resumenes,
    archivosLocales, modoEditar, pago, presupuestoId, chatterOrigenId, mensajeOrigenId,
    descargarAdjuntosOrigen, mostrar, onCerrar, onPagoGuardado,
  ])

  // ─── Etiqueta del botón principal ──────────────────────────────────────
  const etiquetaBoton = modoEditar
    ? 'Guardar cambios'
    : esAdicional
      ? 'Registrar adicional'
      : esTotal && hayMultiplesCuotas
        ? 'Registrar pago total'
        : 'Registrar pago'

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={modoEditar
        ? 'Editar pago'
        : esAdicional
          ? `Registrar adicional · ${presupuestoNumero}`
          : `Registrar pago · ${presupuestoNumero}`}
      tamano="lg"
      accionPrimaria={{
        etiqueta: etiquetaBoton,
        onClick: handleGuardar,
        cargando: guardando,
      }}
      accionSecundaria={{
        etiqueta: 'Cancelar',
        onClick: onCerrar,
        disabled: guardando,
      }}
    >
      <div className="space-y-4">
        {/* ╔═══ CONTEXTO DEL PRESUPUESTO ═══════════════════════════════ */}
        {!modoEditar && (
          <CardContexto
            totalPresupuesto={totalPresupuesto}
            totalCobrado={totalCobradoPresupuesto}
            saldo={saldoPresupuesto}
            porcentaje={porcentajeCobrado}
            moneda={monedaPresupuesto}
            cargando={cargandoResumen}
          />
        )}

        {/* ╔═══ IMPUTACIÓN ═════════════════════════════════════════════ */}
        {!modoEditar && (
          <SeccionImputacion
            resumenes={resumenes}
            cuotasUtiles={cuotasUtiles}
            imputacion={imputacion}
            onCambiar={cambiarImputacion}
            saldoPresupuesto={saldoPresupuesto}
            totalPresupuesto={totalPresupuesto}
            moneda={monedaPresupuesto}
            cargando={cargandoResumen}
          />
        )}

        {/* En modo editar mostramos sólo un select compacto */}
        {modoEditar && (
          <div>
            <label className="block text-xs text-texto-secundario mb-1">Imputado a</label>
            <Select
              opciones={[
                { valor: VALOR_A_CUENTA, etiqueta: 'A cuenta (sin imputar)' },
                ...cuotasUtiles.map((c) => ({
                  valor: c.id,
                  etiqueta: `Cuota ${c.numero}${c.descripcion ? ` — ${c.descripcion}` : ''}`,
                })),
                { valor: VALOR_ADICIONAL, etiqueta: 'Adicional (fuera del presupuesto)' },
              ]}
              valor={imputacion}
              onChange={cambiarImputacion}
            />
          </div>
        )}

        {/* Concepto del adicional (input prominente) */}
        {esAdicional && (
          <div>
            <label className="block text-xs text-texto-secundario mb-1">
              Concepto del adicional
            </label>
            <Input
              value={conceptoAdicional}
              onChange={(e) => setConceptoAdicional(e.target.value)}
              placeholder="Ej: servicio extra de instalación, viático, etc."
            />
          </div>
        )}

        {/* ╔═══ CALCULADORA DE MONTOS ══════════════════════════════════ */}
        <CalculadoraMontos
          monto={monto}
          setMonto={setMonto}
          percepciones={montoPercepciones}
          setPercepciones={setMontoPercepciones}
          moneda={moneda}
          setMoneda={setMoneda}
          monedasDisponibles={monedasDisponibles}
          totalCobrado={totalCobrado}
          saldoEsperado={saldoEsperado}
          saldoEnMonedaPresupuesto={saldoEsperado}
          totalEnMonedaPresupuesto={totalEnMonedaPresupuesto}
          monedaPresupuesto={monedaPresupuesto}
          monedaDistinta={monedaDistinta}
          cotizacion={cotizacion}
          setCotizacion={setCotizacion}
          matchSaldo={matchSaldo}
          esTotal={esTotal && hayMultiplesCuotas}
          esAdicional={esAdicional}
        />

        {/* ╔═══ DETALLES ═══════════════════════════════════════════════ */}
        <SeccionDetalles
          metodo={metodo}
          setMetodo={setMetodo}
          fechaPago={fechaPago}
          setFechaPago={setFechaPago}
          horaPago={horaPago}
          setHoraPago={setHoraPago}
          referencia={referencia}
          setReferencia={setReferencia}
        />

        {/* ╔═══ COMPROBANTES ═══════════════════════════════════════════ */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <label className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
              Comprobantes
            </label>
            {faltaComprobantePago ? (
              <span className="inline-flex items-center gap-1 text-xxs text-insignia-advertencia">
                <AlertCircle className="size-3" />
                {ETIQUETAS_METODO_PAGO[metodo]} suele tener comprobante
              </span>
            ) : (
              <span className="text-xxs text-texto-terciario">opcional · podés adjuntar varios</span>
            )}
          </div>

          {/* Selector de adjuntos del correo origen — sólo en modo crear y
              cuando la entrada del chatter trajo archivos. Permite tomar el
              comprobante directamente del correo sin re-subirlo. */}
          {!modoEditar && adjuntosOrigen && adjuntosOrigen.length > 0 && (
            <SelectorAdjuntosOrigen
              adjuntos={adjuntosOrigen}
              tiposSeleccion={tiposAdjuntosOrigen}
              onCambiar={setTiposAdjuntosOrigen}
              origenDescripcion={origenDescripcion}
            />
          )}

          <input
            ref={inputArchivoRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={onArchivoCambio}
            className="hidden"
          />
          <input
            ref={inputArchivoEdicionRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={onArchivoEdicionCambio}
            className="hidden"
          />

          {/* Dropzone (sólo en crear) */}
          {!modoEditar && (
            <div
              ref={dropzoneRef}
              className={`relative rounded-lg border-2 border-dashed transition-colors ${
                arrastrando
                  ? 'border-texto-marca bg-texto-marca/5'
                  : 'border-borde-sutil bg-superficie-tarjeta/30'
              }`}
            >
              <div className="flex flex-col items-center gap-2 px-4 py-5">
                <div className="size-9 rounded-full bg-white/[0.05] flex items-center justify-center">
                  <Upload className="size-4 text-texto-terciario" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-texto-secundario">
                    Arrastrá los comprobantes acá
                  </p>
                  <p className="text-xxs text-texto-terciario">
                    o pegá con ⌘V · adjuntá manualmente más abajo
                  </p>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => seleccionarArchivo('comprobante')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borde-sutil bg-superficie-tarjeta hover:bg-white/[0.05] text-xs text-texto-secundario"
                  >
                    <Paperclip className="size-3.5" />
                    Comprobante de pago
                  </button>
                  <button
                    type="button"
                    onClick={() => seleccionarArchivo('percepcion')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borde-sutil bg-superficie-tarjeta hover:bg-white/[0.05] text-xs text-texto-secundario"
                  >
                    <ReceiptText className="size-3.5" />
                    Comprobante de retenciones
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* En modo editar: dos botones simples sin dropzone (los archivos
              se suben en vivo al endpoint de comprobantes) */}
          {modoEditar && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => seleccionarArchivoEdicion('comprobante')}
                disabled={subiendoExtra}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-borde-sutil hover:bg-white/[0.03] text-xs text-texto-secundario disabled:opacity-50"
              >
                <Paperclip className="size-3.5" />
                Adjuntar comprobante
              </button>
              <button
                type="button"
                onClick={() => seleccionarArchivoEdicion('percepcion')}
                disabled={subiendoExtra}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-borde-sutil hover:bg-white/[0.03] text-xs text-texto-secundario disabled:opacity-50"
              >
                <ReceiptText className="size-3.5" />
                Adjuntar retenciones
              </button>
            </div>
          )}

          {/* Lista de comprobantes (locales o existentes) */}
          {!modoEditar && archivosLocales.length > 0 && (
            <div className="space-y-1.5">
              {archivosLocales.map((a) => (
                <ChipComprobante
                  key={a.id}
                  url={a.previewUrl}
                  nombre={a.file.name}
                  tipo={a.file.type}
                  tamanoBytes={a.file.size}
                  etiquetaTipo={a.tipo}
                  onQuitar={() => quitarArchivoLocal(a.id)}
                />
              ))}
            </div>
          )}
          {modoEditar && comprobantesExistentes.length > 0 && (
            <div className="space-y-1.5">
              {comprobantesExistentes.map((c) => (
                <ChipComprobante
                  key={c.id}
                  url={urlsFirmadas[c.id] || c.url || ''}
                  nombre={c.nombre}
                  tipo={c.mime_tipo || ''}
                  tamanoBytes={c.tamano_bytes ?? undefined}
                  etiquetaTipo={c.tipo}
                  onQuitar={() => eliminarComprobanteExistente(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ╔═══ NOTA INTERNA (colapsada) ══════════════════════════════ */}
        <div>
          {!mostrarNotas && !descripcion ? (
            <button
              type="button"
              onClick={() => setMostrarNotas(true)}
              className="text-xs text-texto-marca hover:underline"
            >
              + Agregar nota interna
            </button>
          ) : (
            <div>
              <label className="block text-xs text-texto-secundario mb-1">
                Nota interna <span className="text-texto-terciario">· opcional</span>
              </label>
              <TextArea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Concepto, contexto o notas internas"
                rows={2}
              />
            </div>
          )}
        </div>

        {/* Origen del chatter (chip discreto) */}
        {(chatterOrigenId || mensajeOrigenId) && !modoEditar && (
          <div className="flex items-center gap-1.5 text-xs text-texto-terciario pt-1">
            <MessageSquare className="size-3" />
            Quedará vinculado al {origenDescripcion || 'mensaje del chatter'}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ═══════════════════════════════════════════════════════════════════════

// ─── Card de contexto del presupuesto ─────────────────────────────────────
function CardContexto({
  totalPresupuesto,
  totalCobrado,
  saldo,
  porcentaje,
  moneda,
  cargando,
}: {
  totalPresupuesto: number
  totalCobrado: number
  saldo: number
  porcentaje: number
  moneda: string
  cargando: boolean
}) {
  return (
    <div className="rounded-lg border border-borde-sutil bg-superficie-tarjeta px-3.5 py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-texto-secundario">
          <CreditCard className="size-3.5 text-texto-terciario" />
          {cargando ? 'Cargando…' : `Cobrado · ${fmtMoneda(totalCobrado, moneda)} de ${fmtMoneda(totalPresupuesto, moneda)}`}
        </div>
        {!cargando && (
          <span className="text-xs text-texto-terciario tabular-nums">
            {saldo > 0
              ? <>Saldo <strong className="text-texto-primario">{fmtMoneda(saldo, moneda)}</strong></>
              : <span className="text-insignia-exito">✓ Cobrado completo</span>}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            porcentaje >= 99.99
              ? 'bg-insignia-exito'
              : porcentaje > 0
                ? 'bg-texto-marca'
                : 'bg-transparent'
          }`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  )
}

// ─── Sección de imputación con tarjetas seleccionables ────────────────────
function SeccionImputacion({
  resumenes,
  cuotasUtiles,
  imputacion,
  onCambiar,
  saldoPresupuesto,
  totalPresupuesto,
  moneda,
  cargando,
}: {
  resumenes: ResumenCuota[]
  cuotasUtiles: CuotaPago[]
  imputacion: string
  onCambiar: (v: string) => void
  saldoPresupuesto: number
  totalPresupuesto: number
  moneda: string
  cargando: boolean
}) {
  const hayMultiples = cuotasUtiles.length > 1
  const fuente = resumenes.length > 0
    ? resumenes
    : cuotasUtiles.map((c) => ({ cuota: c, totalCuota: Number(c.monto), pagado: 0, saldo: Number(c.monto) }))

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
        ¿A qué imputás?
      </label>

      <div className="grid gap-1.5">
        {/* Cuotas */}
        {fuente.map((r) => {
          const esCobrada = r.cuota.estado === 'cobrada' || r.saldo <= TOLERANCIA_SALDO
          const seleccionada = imputacion === r.cuota.id
          const acento = esCobrada ? 'cobrada' : seleccionada ? 'activa' : 'normal'
          return (
            <BotonImputacion
              key={r.cuota.id}
              seleccionado={seleccionada}
              icono={<CreditCard className="size-3.5" />}
              titulo={`Cuota ${r.cuota.numero}${r.cuota.descripcion ? ` — ${r.cuota.descripcion}` : ''}`}
              detalle={
                esCobrada
                  ? <span className="text-insignia-exito">✓ Cobrada</span>
                  : r.pagado > 0
                    ? <>Saldo <strong>{fmtMoneda(r.saldo, moneda)}</strong> · ya cobrado {fmtMoneda(r.pagado, moneda)} de {fmtMoneda(r.totalCuota, moneda)}</>
                    : <>Saldo <strong>{fmtMoneda(r.saldo, moneda)}</strong> de {fmtMoneda(r.totalCuota, moneda)}</>
              }
              onClick={() => onCambiar(r.cuota.id)}
              tono={acento === 'activa' ? 'marca' : 'neutro'}
            />
          )
        })}

        {/* Pagaron el total — sólo con 2+ cuotas */}
        {hayMultiples && !cargando && (saldoPresupuesto > 0 || totalPresupuesto > 0) && (
          <BotonImputacion
            seleccionado={imputacion === VALOR_TOTAL}
            icono={<span className="text-base">💰</span>}
            titulo={`Pagaron el total · ${fmtMoneda(saldoPresupuesto > 0 ? saldoPresupuesto : totalPresupuesto, moneda)}`}
            detalle="Reparte el cobro entre todas las cuotas pendientes proporcionalmente"
            onClick={() => onCambiar(VALOR_TOTAL)}
            tono={imputacion === VALOR_TOTAL ? 'marca' : 'neutro'}
          />
        )}
      </div>

      {/* Acciones secundarias: A cuenta + Adicional */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onCambiar(VALOR_A_CUENTA)}
          className={`flex-1 px-3 py-2 rounded-lg border text-xs transition-colors ${
            imputacion === VALOR_A_CUENTA
              ? 'border-texto-marca/40 bg-texto-marca/10 text-texto-marca'
              : 'border-borde-sutil text-texto-secundario hover:bg-white/[0.03]'
          }`}
        >
          A cuenta (sin imputar)
        </button>
        <button
          type="button"
          onClick={() => onCambiar(VALOR_ADICIONAL)}
          className={`flex-1 px-3 py-2 rounded-lg border text-xs transition-colors flex items-center justify-center gap-1.5 ${
            imputacion === VALOR_ADICIONAL
              ? 'border-insignia-info/40 bg-insignia-info/10 text-insignia-info'
              : 'border-borde-sutil text-texto-secundario hover:bg-white/[0.03]'
          }`}
        >
          <Sparkles className="size-3.5" />
          Adicional fuera del presupuesto
        </button>
      </div>
    </div>
  )
}

// ─── Botón individual de imputación ──────────────────────────────────────
function BotonImputacion({
  seleccionado,
  icono,
  titulo,
  detalle,
  onClick,
  tono,
}: {
  seleccionado: boolean
  icono: React.ReactNode
  titulo: string
  detalle: React.ReactNode
  onClick: () => void
  tono: 'marca' | 'neutro' | 'info'
}) {
  const colores = seleccionado
    ? tono === 'info'
      ? 'border-insignia-info/40 bg-insignia-info/10'
      : 'border-texto-marca/40 bg-texto-marca/10'
    : 'border-borde-sutil bg-superficie-tarjeta/40 hover:bg-white/[0.03]'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${colores}`}
    >
      <div className={`size-7 rounded-full flex items-center justify-center shrink-0 ${
        seleccionado
          ? tono === 'info' ? 'bg-insignia-info/20 text-insignia-info' : 'bg-texto-marca/20 text-texto-marca'
          : 'bg-white/[0.05] text-texto-terciario'
      }`}>
        {icono}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${seleccionado ? 'text-texto-primario' : 'text-texto-secundario'}`}>
          {titulo}
        </p>
        <p className="text-xxs text-texto-terciario mt-0.5 leading-snug">
          {detalle}
        </p>
      </div>
      {seleccionado && (
        <Check className={`size-4 shrink-0 ${tono === 'info' ? 'text-insignia-info' : 'text-texto-marca'}`} />
      )}
    </button>
  )
}

// ─── Calculadora de montos: Te llegó + Percepciones = Total cobrado ─────
function CalculadoraMontos({
  monto,
  setMonto,
  percepciones,
  setPercepciones,
  moneda,
  setMoneda,
  monedasDisponibles,
  totalCobrado,
  saldoEsperado,
  saldoEnMonedaPresupuesto,
  totalEnMonedaPresupuesto,
  monedaPresupuesto,
  monedaDistinta,
  cotizacion,
  setCotizacion,
  matchSaldo,
  esTotal,
  esAdicional,
}: {
  monto: string
  setMonto: (v: string) => void
  percepciones: string
  setPercepciones: (v: string) => void
  moneda: string
  setMoneda: (v: string) => void
  monedasDisponibles?: Moneda[]
  totalCobrado: number
  saldoEsperado: number | null
  saldoEnMonedaPresupuesto: number | null
  totalEnMonedaPresupuesto: number
  monedaPresupuesto: string
  monedaDistinta: boolean
  cotizacion: string
  setCotizacion: (v: string) => void
  matchSaldo: 'exacto' | 'menos' | 'mas' | null
  esTotal: boolean
  esAdicional: boolean
}) {
  const [popoverAbierto, setPopoverAbierto] = useState(false)

  // Lista de monedas activas configuradas. Si la moneda actual no está
  // en la lista (caso edge: presupuesto cargado en una moneda que después
  // fue desactivada), la incluimos para no perder selección.
  const opcionesMoneda = useMemo(() => {
    if (!monedasDisponibles || monedasDisponibles.length === 0) return null
    const activas = monedasDisponibles.filter((m) => m.activo)
    const tieneMonedaActual = activas.some((m) => m.id === moneda)
    const lista = tieneMonedaActual ? activas : [...activas, { id: moneda, label: moneda, simbolo: moneda, activo: true } as Moneda]
    return lista.map((m) => ({
      valor: m.id,
      etiqueta: m.simbolo === m.id ? m.id : `${m.id} · ${m.simbolo}`,
    }))
  }, [monedasDisponibles, moneda])

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
        Montos
      </label>

      <div className="rounded-lg border border-borde-sutil bg-superficie-tarjeta/40 p-3 space-y-2.5">
        {/* Te llegó al banco */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
          <div className="min-w-0">
            <label className="block text-xxs text-texto-terciario mb-1">
              Te llegó al banco
            </label>
            <InputMoneda value={monto} onChange={setMonto} moneda={moneda} placeholder="0,00" />
          </div>
          <div className="w-28">
            <label className="block text-xxs text-texto-terciario mb-1">Moneda</label>
            {opcionesMoneda ? (
              <Select
                opciones={opcionesMoneda}
                valor={moneda}
                onChange={setMoneda}
              />
            ) : (
              <Input
                value={moneda}
                onChange={(e) => setMoneda(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="ARS"
              />
            )}
          </div>
        </div>

        {/* Símbolo + */}
        <div className="text-center text-texto-terciario text-sm leading-none">+</div>

        {/* Percepciones */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xxs text-texto-terciario flex items-center gap-1">
              <ReceiptText className="size-3" />
              Percepciones / retenciones
            </label>
            {!esAdicional && (
              <Popover
                abierto={popoverAbierto}
                onCambio={setPopoverAbierto}
                ancho={300}
                contenido={
                  <PopoverCalcularPercepciones
                    saldoEsperado={saldoEsperado}
                    moneda={moneda}
                    onAplicar={(neto, percep) => {
                      setMonto(String(neto))
                      setPercepciones(String(percep))
                      setPopoverAbierto(false)
                    }}
                    onCerrar={() => setPopoverAbierto(false)}
                  />
                }
              >
                <button
                  type="button"
                  className="text-xxs text-texto-marca hover:underline flex items-center gap-1"
                  title="Calcular desde el bruto"
                >
                  <Calculator className="size-3" />
                  Calcular
                </button>
              </Popover>
            )}
          </div>
          <InputMoneda value={percepciones} onChange={setPercepciones} moneda={moneda} placeholder="0,00" />
        </div>

        {/* Línea divisoria */}
        <div className="border-t border-borde-sutil" />

        {/* Total cobrado + indicador */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-texto-secundario">= Total cobrado</span>
          <span className="text-base font-semibold text-texto-primario tabular-nums">
            {fmtMoneda(totalCobrado, moneda)}
          </span>
        </div>

        {/* Indicador de match contra el saldo esperado */}
        {!esAdicional && saldoEsperado !== null && totalCobrado > 0 && (
          <div className="flex items-center gap-1.5 text-xxs">
            {matchSaldo === 'exacto' && (
              <span className="text-insignia-exito flex items-center gap-1">
                <Check className="size-3" strokeWidth={3} />
                {esTotal
                  ? 'Cubre el saldo del presupuesto'
                  : 'Cubre el saldo esperado'}
              </span>
            )}
            {matchSaldo === 'menos' && (
              <span className="text-insignia-advertencia flex items-center gap-1">
                <AlertCircle className="size-3" />
                Falta{' '}
                <strong>
                  {fmtMoneda((saldoEnMonedaPresupuesto || 0) - totalEnMonedaPresupuesto, monedaPresupuesto)}
                </strong>{' '}
                para cubrir el saldo
              </span>
            )}
            {matchSaldo === 'mas' && (
              <span className="text-insignia-info flex items-center gap-1">
                <AlertCircle className="size-3" />
                Excede el saldo en{' '}
                <strong>
                  {fmtMoneda(totalEnMonedaPresupuesto - (saldoEnMonedaPresupuesto || 0), monedaPresupuesto)}
                </strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cotización (sólo si difiere) */}
      {monedaDistinta && (
        <div className="rounded-lg border border-texto-marca/30 bg-texto-marca/5 px-3 py-2.5">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-xxs text-texto-terciario mb-1">
                Cotización: 1 {moneda} = X {monedaPresupuesto}
              </label>
              <Input
                value={cotizacion}
                onChange={(e) => setCotizacion(e.target.value)}
                tipo="number"
                formato={null}
                placeholder="1"
              />
            </div>
            <div className="text-xxs text-texto-secundario pb-2">
              ≈ <strong className="text-texto-primario">
                {fmtMoneda(totalEnMonedaPresupuesto, monedaPresupuesto)}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Popover para calcular percepciones desde el bruto ───────────────────
function PopoverCalcularPercepciones({
  saldoEsperado,
  moneda,
  onAplicar,
  onCerrar,
}: {
  saldoEsperado: number | null
  moneda: string
  onAplicar: (neto: number, percep: number) => void
  onCerrar: () => void
}) {
  const [bruto, setBruto] = useState(saldoEsperado ? String(saldoEsperado) : '')
  const [neto, setNeto] = useState('')

  const brutoNum = Number(bruto) || 0
  const netoNum = Number(neto) || 0
  const percepCalculadas = brutoNum > 0 && netoNum > 0 ? Math.max(0, brutoNum - netoNum) : 0

  return (
    <div className="p-3 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-texto-primario mb-1">Calcular percepciones</h3>
        <p className="text-xxs text-texto-terciario">
          Indicá el bruto facturado y lo que llegó al banco. Calculo las percepciones automáticamente.
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-xxs text-texto-terciario mb-1">
            ¿Cuánto te debían pagar (bruto)?
          </label>
          <InputMoneda value={bruto} onChange={setBruto} moneda={moneda} placeholder="0,00" />
        </div>
        <div>
          <label className="block text-xxs text-texto-terciario mb-1">
            ¿Cuánto te llegó efectivamente?
          </label>
          <InputMoneda value={neto} onChange={setNeto} moneda={moneda} placeholder="0,00" />
        </div>
      </div>

      {percepCalculadas > 0 && (
        <div className="rounded-md bg-insignia-advertencia/10 border border-insignia-advertencia/30 px-2.5 py-2 text-xxs text-insignia-advertencia">
          Percepciones calculadas: <strong>{fmtMoneda(percepCalculadas, moneda)}</strong>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCerrar}
          className="px-3 py-1.5 rounded-lg text-xs text-texto-secundario hover:bg-white/[0.05]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            if (brutoNum <= 0 || netoNum <= 0) return
            onAplicar(netoNum, percepCalculadas)
          }}
          disabled={brutoNum <= 0 || netoNum <= 0}
          className="px-3 py-1.5 rounded-lg text-xs bg-texto-marca text-white hover:bg-texto-marca/90 disabled:opacity-50"
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}

// ─── Sección de detalles compacta ────────────────────────────────────────
function SeccionDetalles({
  metodo,
  setMetodo,
  fechaPago,
  setFechaPago,
  horaPago,
  setHoraPago,
  referencia,
  setReferencia,
}: {
  metodo: MetodoPago
  setMetodo: (v: MetodoPago) => void
  fechaPago: string | null
  setFechaPago: (v: string | null) => void
  horaPago: string | null
  setHoraPago: (v: string | null) => void
  referencia: string
  setReferencia: (v: string) => void
}) {
  const [refExpanded, setRefExpanded] = useState(!!referencia)

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
        Detalles
      </label>

      {/* Layout en 3 columnas en sm+: Método 1fr · Fecha 1fr · Hora 96px.
          min-w-0 evita que el contenido fuerce expansión y empuje fuera del modal.
          En mobile colapsa a 1 columna. */}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px] gap-2.5">
        <div className="min-w-0">
          <label className="block text-xxs text-texto-terciario mb-1">Método</label>
          <Select
            opciones={METODOS_PAGO_OPCIONES.map((m) => ({ valor: m.valor, etiqueta: m.etiqueta }))}
            valor={metodo}
            onChange={(v) => setMetodo(v as MetodoPago)}
          />
        </div>
        <div className="min-w-0">
          <label className="block text-xxs text-texto-terciario mb-1">Fecha</label>
          <SelectorFecha valor={fechaPago} onChange={setFechaPago} />
        </div>
        <div className="min-w-0">
          <label className="block text-xxs text-texto-terciario mb-1">Hora</label>
          <SelectorHora valor={horaPago} onChange={setHoraPago} />
        </div>
      </div>

      {refExpanded ? (
        <div>
          <label className="block text-xxs text-texto-terciario mb-1">
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
      ) : (
        <button
          type="button"
          onClick={() => setRefExpanded(true)}
          className="text-xs text-texto-marca hover:underline"
        >
          + Agregar referencia (N° operación / cheque)
        </button>
      )}
    </div>
  )
}

// ─── Chip de comprobante (preview compacto + lightbox) ───────────────────
function ChipComprobante({
  url,
  nombre,
  tipo,
  tamanoBytes,
  etiquetaTipo,
  onQuitar,
}: {
  url: string
  nombre: string
  tipo: string
  tamanoBytes?: number
  etiquetaTipo?: TipoComprobantePago
  onQuitar?: () => void
}) {
  const [lightbox, setLightbox] = useState(false)
  const esImagen = tipo.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|heic|bmp)$/i.test(nombre)
  const esPDF = tipo === 'application/pdf' || /\.pdf$/i.test(nombre)

  const tamano =
    tamanoBytes !== undefined
      ? tamanoBytes < 1024 * 1024
        ? `${(tamanoBytes / 1024).toFixed(0)} KB`
        : `${(tamanoBytes / 1024 / 1024).toFixed(1)} MB`
      : null

  const etiquetaCorta = etiquetaTipo === 'percepcion' ? 'Retenciones' : 'Pago'

  return (
    <>
      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-borde-sutil bg-superficie-tarjeta">
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="flex items-center gap-2.5 flex-1 min-w-0 group cursor-pointer"
          title="Ver comprobante"
        >
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
            <p className="text-xxs text-texto-terciario flex items-center gap-1.5">
              {etiquetaTipo && (
                <span className={`inline-flex items-center px-1.5 py-px rounded-full border ${
                  etiquetaTipo === 'percepcion'
                    ? 'border-insignia-advertencia/30 text-insignia-advertencia'
                    : 'border-borde-sutil text-texto-secundario'
                }`}>
                  {etiquetaCorta}
                </span>
              )}
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
            <Trash2 className="size-3.5" />
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

// ─── Selector de adjuntos del correo origen ──────────────────────────────
// Lista los archivos adjuntos del correo desde donde se invocó "Registrar
// como pago" y permite tildar cuáles tomar (y como qué tipo). Al guardar,
// el modal los descarga del storage del correo y los sube al bucket del
// pago — desacoplando el ciclo de vida de ambos.
function SelectorAdjuntosOrigen({
  adjuntos,
  tiposSeleccion,
  onCambiar,
  origenDescripcion,
}: {
  adjuntos: AdjuntoChatter[]
  tiposSeleccion: Record<number, TipoComprobantePago>
  onCambiar: (next: Record<number, TipoComprobantePago>) => void
  origenDescripcion?: string | null
}) {
  const togglearAdjunto = (idx: number) => {
    const next = { ...tiposSeleccion }
    if (next[idx]) delete next[idx]
    else next[idx] = 'comprobante'
    onCambiar(next)
  }

  const cambiarTipo = (idx: number, tipo: TipoComprobantePago) => {
    onCambiar({ ...tiposSeleccion, [idx]: tipo })
  }

  return (
    <div className="rounded-lg border border-canal-correo/30 bg-canal-correo/[0.04] px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-texto-secundario">
        <Mail className="size-3.5 text-canal-correo" />
        <span className="font-medium">Tomar comprobante del {origenDescripcion || 'correo'}</span>
        <span className="text-xxs text-texto-terciario">· {adjuntos.length} archivo{adjuntos.length === 1 ? '' : 's'}</span>
      </div>
      <div className="space-y-1">
        {adjuntos.map((a, idx) => {
          const tipoElegido = tiposSeleccion[idx] || null
          const tildado = !!tipoElegido
          const esImagen = (a.tipo || '').startsWith('image/')
          const esPDF = a.tipo === 'application/pdf' || /\.pdf$/i.test(a.nombre)
          const tamano = a.tamano !== undefined
            ? a.tamano < 1024 * 1024
              ? `${(a.tamano / 1024).toFixed(0)} KB`
              : `${(a.tamano / 1024 / 1024).toFixed(1)} MB`
            : null

          return (
            <div
              key={`${a.url}-${idx}`}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md border transition-colors ${
                tildado
                  ? 'border-canal-correo/40 bg-canal-correo/[0.06]'
                  : 'border-borde-sutil bg-superficie-tarjeta/30'
              }`}
            >
              <button
                type="button"
                onClick={() => togglearAdjunto(idx)}
                className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  tildado
                    ? 'border-canal-correo bg-canal-correo text-white'
                    : 'border-borde-fuerte hover:border-canal-correo'
                }`}
                aria-label={tildado ? 'Quitar de comprobantes' : 'Agregar como comprobante'}
              >
                {tildado && <Check className="size-3" />}
              </button>
              <div className="size-7 rounded bg-white/[0.05] text-texto-terciario flex items-center justify-center shrink-0">
                {esImagen ? <ImageIcon className="size-3.5" /> : esPDF ? <FileText className="size-3.5 text-insignia-peligro" /> : <Paperclip className="size-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-texto-primario truncate">{a.nombre}</p>
                <p className="text-xxs text-texto-terciario">
                  {tamano ? `${tamano} · ` : ''}{a.tipo || 'archivo'}
                </p>
              </div>
              {tildado && (
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => cambiarTipo(idx, 'comprobante')}
                    className={`px-2 py-0.5 rounded-full border text-xxs transition-colors ${
                      tipoElegido === 'comprobante'
                        ? 'border-texto-marca/40 bg-texto-marca/15 text-texto-marca'
                        : 'border-borde-sutil text-texto-terciario hover:text-texto-secundario'
                    }`}
                  >
                    Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarTipo(idx, 'percepcion')}
                    className={`px-2 py-0.5 rounded-full border text-xxs transition-colors ${
                      tipoElegido === 'percepcion'
                        ? 'border-insignia-advertencia/40 bg-insignia-advertencia/15 text-insignia-advertencia'
                        : 'border-borde-sutil text-texto-terciario hover:text-texto-secundario'
                    }`}
                  >
                    Retención
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


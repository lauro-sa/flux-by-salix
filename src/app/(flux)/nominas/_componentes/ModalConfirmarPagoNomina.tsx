'use client'

/**
 * Modal para confirmar un pago de nómina con todos los datos reales:
 * método, fecha, cuenta destino, referencia, comprobante y notas.
 *
 * Reemplaza al modal inline básico que estaba en
 * `PaginaEditorNominaEmpleado` y que solo pedía monto + notas.
 *
 * Flujo:
 *   1. Al abrir, carga las cuentas bancarias/digitales del empleado
 *      desde `/api/miembros/{id}/info-bancaria`.
 *   2. Preselecciona método según las cuentas: si hay digital y/o
 *      banco, sugiere "transferencia" o "cuenta_digital"; sino,
 *      "efectivo".
 *   3. Si el método requiere cuenta destino, preselecciona la cuenta
 *      con `activa=true` más reciente. El operador puede cambiar.
 *   4. Subida de comprobante: el archivo se sube por separado a
 *      `/api/nominas/pagos/comprobante` (devuelve URL), después se
 *      pasa la URL al POST de confirmación de pago.
 *   5. Confirmación llama a `onConfirmar` con el payload completo.
 *
 * Usado en: `PaginaEditorNominaEmpleado`.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Wallet, Building2, Banknote, FileSignature, Upload,
  FileText, X as IconX, Loader2, Star,
} from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useToast } from '@/componentes/feedback/Toast'
import type { InfoBancaria, MetodoPagoNomina } from '@/tipos/nominas'

interface Props {
  abierto: boolean
  onCerrar: () => void
  /**
   * ID del miembro al que se le paga. Se usa para cargar sus cuentas
   * bancarias y para el endpoint de creación del pago.
   */
  miembroId: string
  /**
   * Neto sugerido por el motor de cálculo, antes de cualquier ajuste
   * del operador. Se muestra como referencia y como prefill del monto.
   */
  netoSugerido: number
  /** Descuento por adelantos ya incluido en el neto. Solo informativo. */
  descuentoAdelanto?: number
  /**
   * Callback con los datos confirmados. El padre llama al endpoint
   * POST /api/nominas/pagos. El modal cierra solo si el padre lo
   * cierra explícitamente — así el padre puede mostrar errores y
   * dejar el modal abierto para reintentar.
   */
  onConfirmar: (datos: {
    monto_abonado: number
    metodo_pago: MetodoPagoNomina
    fecha_pago: string
    referencia: string | null
    info_bancaria_id: string | null
    comprobante_url: string | null
    notas: string | null
  }) => Promise<void> | void
  /** Si está confirmándose (deshabilita los inputs y botones). */
  confirmando?: boolean
}

const METODOS: Array<{ valor: MetodoPagoNomina; etiqueta: string; icono: React.ReactNode; descripcion: string }> = [
  { valor: 'efectivo',       etiqueta: 'Efectivo',         icono: <Banknote size={14} />,      descripcion: 'Pago en mano, sin destino bancario.' },
  { valor: 'transferencia',  etiqueta: 'Transferencia',    icono: <Building2 size={14} />,     descripcion: 'A una cuenta bancaria del empleado.' },
  { valor: 'cuenta_digital', etiqueta: 'Cuenta digital',   icono: <Wallet size={14} />,        descripcion: 'A una billetera virtual (MP, Brubank, etc).' },
  { valor: 'cheque',         etiqueta: 'Cheque',           icono: <FileSignature size={14} />, descripcion: 'Cheque al portador o nominal.' },
  { valor: 'otro',           etiqueta: 'Otro',             icono: <FileText size={14} />,      descripcion: 'Cualquier otro medio de pago.' },
]

const TAMANO_MAXIMO_MB = 10
const TIPOS_ACEPTADOS = 'application/pdf,image/jpeg,image/png,image/webp'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatearMonto(v: number): string {
  return `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function ModalConfirmarPagoNomina({
  abierto, onCerrar, miembroId, netoSugerido, descuentoAdelanto = 0, onConfirmar, confirmando = false,
}: Props) {
  const toast = useToast()
  const inputArchivo = useRef<HTMLInputElement>(null)

  // ─── Estado ───
  const [cuentas, setCuentas] = useState<InfoBancaria[]>([])
  const [cargandoCuentas, setCargandoCuentas] = useState(false)
  const [metodo, setMetodo] = useState<MetodoPagoNomina>('efectivo')
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [monto, setMonto] = useState<string>('')
  const [fecha, setFecha] = useState<string>(hoyISO())
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null)
  const [comprobanteNombre, setComprobanteNombre] = useState<string | null>(null)
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)

  // ─── Carga inicial: cuentas del empleado ───
  useEffect(() => {
    if (!abierto || !miembroId) return
    let cancelado = false
    setCargandoCuentas(true)
    fetch(`/api/miembros/${miembroId}/info-bancaria`)
      .then(r => r.json())
      .then(data => {
        if (cancelado) return
        const lista = (data.cuentas ?? []) as InfoBancaria[]
        setCuentas(lista)
        // Default: priorizamos la cuenta predeterminada del empleado.
        // Si no hay, caemos a la primera activa (ordenada por
        // actualizado_en desc desde el backend). Sin cuentas activas
        // → efectivo.
        const activas = lista.filter(c => c.activa)
        const sugerida = activas.find(c => c.predeterminada) ?? activas[0] ?? null
        if (sugerida) {
          setMetodo(sugerida.tipo_pago === 'digital' ? 'cuenta_digital' : 'transferencia')
          setCuentaId(sugerida.id)
        } else {
          setMetodo('efectivo')
          setCuentaId(null)
        }
      })
      .catch(err => {
        console.error('[ModalConfirmarPagoNomina] error al cargar cuentas:', err)
      })
      .finally(() => {
        if (!cancelado) setCargandoCuentas(false)
      })
    return () => { cancelado = true }
  }, [abierto, miembroId])

  // ─── Reset al cerrar ───
  useEffect(() => {
    if (!abierto) {
      setMonto('')
      setReferencia('')
      setNotas('')
      setComprobanteUrl(null)
      setComprobanteNombre(null)
      setFecha(hoyISO())
    }
  }, [abierto])

  // Prefill del monto con el neto sugerido cada vez que abre.
  useEffect(() => {
    if (abierto && !monto) {
      setMonto(String(netoSugerido.toFixed(2)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, netoSugerido])

  // Cuentas que aplican según el método elegido. Filtramos por el
  // tipo (banco para transferencia, digital para cuenta_digital).
  const cuentasFiltradas = useMemo(() => {
    if (metodo === 'transferencia') return cuentas.filter(c => c.tipo_pago === 'banco' && !c.eliminada)
    if (metodo === 'cuenta_digital') return cuentas.filter(c => c.tipo_pago === 'digital' && !c.eliminada)
    return []
  }, [metodo, cuentas])

  // Si cambia el método y la cuenta seleccionada no aplica más, limpiar.
  useEffect(() => {
    if (!cuentaId) return
    if (cuentasFiltradas.length === 0) {
      setCuentaId(null)
      return
    }
    if (!cuentasFiltradas.some(c => c.id === cuentaId)) {
      // Cuenta actual no aplica al nuevo método: preseleccionar la
      // predeterminada si aplica al método, sino la primera disponible.
      const sugerida = cuentasFiltradas.find(c => c.predeterminada) ?? cuentasFiltradas[0]
      setCuentaId(sugerida?.id ?? null)
    }
  }, [metodo, cuentaId, cuentasFiltradas])

  const requiereCuenta = metodo === 'transferencia' || metodo === 'cuenta_digital'

  // ─── Subir comprobante ───
  const onSeleccionarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      toast.mostrar('error', `El archivo supera ${TAMANO_MAXIMO_MB} MB`)
      return
    }

    setSubiendoComprobante(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/nominas/pagos/comprobante', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo subir el comprobante')
        return
      }
      setComprobanteUrl(data.url)
      setComprobanteNombre(file.name)
      toast.mostrar('exito', 'Comprobante subido')
    } catch (err) {
      console.error('[ModalConfirmarPagoNomina] error al subir:', err)
      toast.mostrar('error', 'Error de red al subir el comprobante')
    } finally {
      setSubiendoComprobante(false)
      // Limpiamos el value para que el mismo archivo pueda re-subirse si se quitó.
      if (inputArchivo.current) inputArchivo.current.value = ''
    }
  }

  const quitarComprobante = () => {
    setComprobanteUrl(null)
    setComprobanteNombre(null)
  }

  // ─── Confirmar ───
  const handleConfirmar = async () => {
    const montoNum = parseFloat(monto) || 0
    if (montoNum <= 0) {
      toast.mostrar('advertencia', 'Ingresá un monto válido')
      return
    }
    if (requiereCuenta && !cuentaId && cuentasFiltradas.length > 0) {
      toast.mostrar('advertencia', 'Elegí la cuenta destino')
      return
    }
    await onConfirmar({
      monto_abonado: montoNum,
      metodo_pago: metodo,
      fecha_pago: fecha,
      referencia: referencia.trim() || null,
      info_bancaria_id: requiereCuenta ? cuentaId : null,
      comprobante_url: comprobanteUrl,
      notas: notas.trim() || null,
    })
  }

  const montoNum = parseFloat(monto) || 0
  const diff = montoNum - netoSugerido
  const labelConfirmar = montoNum > 0 ? `Confirmar ${formatearMonto(montoNum)}` : 'Confirmar pago'
  const requiereReferencia = metodo === 'transferencia' || metodo === 'cuenta_digital' || metodo === 'cheque'

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => { if (!confirmando) onCerrar() }}
      titulo="Registrar pago"
      tamano="2xl"
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
      accionPrimaria={{
        etiqueta: labelConfirmar,
        onClick: handleConfirmar,
        cargando: confirmando,
        disabled: !monto || montoNum <= 0 || subiendoComprobante,
      }}
    >
      <div className="space-y-4">
        {/* ─── Resumen del cálculo: 1 fila compacta ─── */}
        <div className="flex items-baseline justify-between gap-4 px-3 py-2 rounded-lg bg-superficie-elevada/40 border border-borde-sutil">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-texto-terciario">Neto sugerido</span>
            <span className="text-base font-semibold text-texto-primario tabular-nums">{formatearMonto(netoSugerido)}</span>
            {descuentoAdelanto > 0 && (
              <span className="text-[11px] text-texto-terciario truncate">
                incluye <span className="text-insignia-advertencia">-{formatearMonto(descuentoAdelanto)}</span> de adelanto
              </span>
            )}
          </div>
          {montoNum > 0 && Math.abs(diff) > 0.01 && (
            <span className={`text-xs tabular-nums shrink-0 ${diff > 0 ? 'text-insignia-exito' : 'text-insignia-peligro'}`}>
              {diff > 0 ? '+' : ''}{formatearMonto(diff)}
              <span className="opacity-70 ml-1">{diff > 0 ? '(a favor)' : '(queda debiendo)'}</span>
            </span>
          )}
        </div>

        {/* ─── Método de pago: pills compactas en una fila ─── */}
        <div>
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">Método</p>
          <div className="flex gap-1.5 flex-wrap">
            {METODOS.map(m => {
              const activo = metodo === m.valor
              return (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => setMetodo(m.valor)}
                  disabled={confirmando}
                  title={m.descripcion}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activo
                      ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                      : 'border-borde-sutil text-texto-terciario hover:text-texto-primario'
                  }`}
                >
                  {m.icono}
                  {m.etiqueta}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Cuenta destino (compacta, una sola línea por cuenta) ─── */}
        {requiereCuenta && (
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                Cuenta destino
              </p>
              {cargandoCuentas && <Loader2 size={11} className="animate-spin text-texto-terciario" />}
            </div>
            {cuentasFiltradas.length === 0 && !cargandoCuentas ? (
              <div className="rounded-lg border border-dashed border-borde-sutil px-3 py-2 text-xs text-texto-terciario">
                Sin cuentas {metodo === 'transferencia' ? 'bancarias' : 'digitales'} cargadas. Podés seguir y cargarlas
                desde la ficha del empleado más tarde.
              </div>
            ) : (
              <div className="space-y-1">
                {cuentasFiltradas.map(c => {
                  const seleccionada = cuentaId === c.id
                  const titulo = c.etiqueta || c.banco || (c.tipo_pago === 'digital' ? 'Billetera virtual' : 'Cuenta bancaria')
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCuentaId(c.id)}
                      disabled={confirmando}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                        seleccionada
                          ? 'border-texto-marca/40 bg-texto-marca/[0.08]'
                          : 'border-borde-sutil bg-superficie-tarjeta hover:border-borde-fuerte'
                      }`}
                    >
                      <div className={`shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        seleccionada ? 'border-texto-marca' : 'border-borde-fuerte'
                      }`}>
                        {seleccionada && <div className="w-1.5 h-1.5 rounded-full bg-texto-marca" />}
                      </div>
                      <div className="min-w-0 flex-1 flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm text-texto-primario font-medium truncate">{titulo}</span>
                        {c.predeterminada && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-texto-marca/15 text-texto-marca uppercase tracking-wider">
                            <Star size={9} className="fill-current" />
                            Por defecto
                          </span>
                        )}
                        {c.banco && c.etiqueta && (
                          <span className="text-[10px] text-texto-terciario uppercase tracking-wider">{c.banco}</span>
                        )}
                        {(c.alias || c.numero_cuenta) && (
                          <span className="text-xs text-texto-terciario font-mono truncate">
                            · {c.alias || c.numero_cuenta}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Grid principal: monto + fecha + referencia ───
             Aprovecha el ancho del modal 2xl para meter todo en una
             sola fila en desktop. En mobile baja a 1 columna. */}
        <div className={`grid grid-cols-1 gap-3 ${requiereReferencia ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <InputMoneda
            etiqueta="Monto"
            value={monto}
            onChange={setMonto}
            moneda="ARS"
          />
          <SelectorFecha
            etiqueta="Fecha del pago"
            valor={fecha}
            onChange={v => setFecha(v ?? hoyISO())}
            limpiable={false}
            anioMin={2020}
            anioMax={new Date().getFullYear() + 1}
          />
          {requiereReferencia && (
            <div>
              <label className="block text-sm text-texto-secundario mb-1.5">
                {metodo === 'cheque' ? 'N° cheque' : 'N° operación'}
                <span className="text-texto-terciario font-normal"> (opcional)</span>
              </label>
              <input
                type="text"
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
                placeholder={metodo === 'cheque' ? 'Ej: 00012345' : 'Ej: 102938475610'}
                disabled={confirmando}
                className="w-full rounded-md bg-superficie-tarjeta border border-borde-sutil px-3 py-2 text-sm text-texto-primario placeholder:text-texto-terciario/60 focus:outline-none focus:border-texto-marca/50"
              />
            </div>
          )}
        </div>

        {/* ─── Comprobante + notas en grid ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Comprobante */}
          <div>
            <p className="text-sm text-texto-secundario mb-1.5">Comprobante <span className="text-texto-terciario font-normal">(opcional)</span></p>
            {comprobanteUrl ? (
              <div className="flex items-center gap-2 rounded-md border border-borde-sutil bg-superficie-tarjeta px-2.5 py-2">
                <FileText size={14} className="text-texto-terciario shrink-0" />
                <a href={comprobanteUrl} target="_blank" rel="noopener noreferrer"
                   className="text-xs text-texto-marca hover:underline truncate flex-1">
                  {comprobanteNombre || 'Comprobante'}
                </a>
                <button
                  type="button"
                  onClick={quitarComprobante}
                  disabled={confirmando}
                  className="shrink-0 text-texto-terciario hover:text-texto-primario p-0.5"
                  title="Quitar"
                >
                  <IconX size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputArchivo.current?.click()}
                disabled={subiendoComprobante || confirmando}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-borde-fuerte bg-superficie-tarjeta text-sm text-texto-terciario hover:border-texto-marca hover:text-texto-marca transition-colors disabled:opacity-50"
              >
                {subiendoComprobante
                  ? <><Loader2 size={13} className="animate-spin" /> Subiendo…</>
                  : <><Upload size={13} /> Subir PDF o imagen</>}
              </button>
            )}
            <input
              ref={inputArchivo}
              type="file"
              accept={TIPOS_ACEPTADOS}
              onChange={onSeleccionarArchivo}
              className="hidden"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm text-texto-secundario mb-1.5">
              Notas <span className="text-texto-terciario font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones del pago…"
              disabled={confirmando}
              className="w-full rounded-md bg-superficie-tarjeta border border-borde-sutil px-3 py-2 text-sm text-texto-primario placeholder:text-texto-terciario/60 focus:outline-none focus:border-texto-marca/50"
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
